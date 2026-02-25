/**
 * 工具调用循环引擎
 *
 * 阶段设计（每个阶段对应 UI/CLI 中的一行指示器）：
 *
 *   [preparing]  构建 system prompt（纯本地，无模型调用）
 *   [thinking]   非流式调用 LLM（带 tools 声明）
 *     ├─ 返回 tool_calls → 进入 [toolCall] 本地执行 → 结果回填 → 回到 [thinking]
 *     ├─ 返回文本内容   → 直接输出，流程结束（无额外 answering 阶段）
 *     └─ 返回空 / 异常  → 跳到 [answering]
 *   [toolCall]   本地执行工具函数（查询 IndexedDB 等）
 *   [answering]  流式调用 LLM 兜底（仅当 thinking 循环未产出文本时触发）
 *
 * 关键原则：一次模型调用 = 一个阶段。
 * thinking 阶段的模型调用如果直接返回了回答，就不会产生 answering 阶段，
 * 避免「同一内容看起来经历了两个阶段」的困惑。
 */

import dayjs from 'dayjs';
import { db } from '../db';
import { chatWithTools, chatStream, type ChatMessage, type LLMConfig } from './llmClient';
import { TOOL_DEFINITIONS, executeTool } from './toolDefinitions';

const MAX_TOOL_ROUNDS = 5;

export interface ToolCallInfo {
    name: string;
    args: Record<string, unknown>;
    result: string;
}

export interface ToolCallEngineCallbacks {
    onPhase: (phase: string, detail?: string, debugInfo?: string) => void;
    onChunk: (delta: string) => void;
    onThinking?: (delta: string) => void;
    onToolCall?: (info: ToolCallInfo) => void;
}

/**
 * 构建轻量 system prompt（不含数据，数据由工具调用按需获取）
 */
async function buildSystemPrompt(): Promise<string> {
    const today = dayjs().format('YYYY-MM-DD（dddd）');

    // 预加载类别列表，让 LLM 了解可用的筛选维度
    const categories = await db.categories.toArray();
    const categoryList = categories
        .filter(c => !(c as any).deleted)
        .map(c => c.name)
        .join(', ');

    return `你是用户的个人时间管理助手。你可以通过工具函数查询用户的时间记录数据来回答问题。

## 当前日期
${today}

## 用户的活动类别
${categoryList || '（暂无类别）'}

## 工具使用指南
1. 用户询问时间相关问题时，使用 query_time_entries 工具查询数据
2. 如果用户的问题涉及多个时间段（如"1月和2月"），请分别查询每个时间段
3. 如果需要按类别或目标筛选，使用对应的筛选参数
4. 如果不确定用户有哪些目标，先用 list_goals 查询

## 回答规则
1. 用中文回答，语气自然简洁
2. 时长用"X小时Y分钟"格式
3. 给出有洞察的总结和分析，不要只是复述数据
4. 数据为空时如实告知
5. 如果用户的问题与时间记录无关，礼貌地引导回时间管理话题
6. 当用户请求"报告"或"总结"时，按以下结构组织回答：
   a) **时间分配摘要**：各类别时间占比、与往期对比
   b) **目标回顾**：投入最多的目标、连续坚持的目标
   c) **洞察与发现**：值得注意的行为模式、作息规律变化、改进建议`;
}

/**
 * 主入口：执行工具调用循环
 */
export async function runToolCallLoop(
    config: LLMConfig,
    userQuery: string,
    history: ChatMessage[],
    callbacks: ToolCallEngineCallbacks,
    signal?: AbortSignal,
): Promise<{ content: string; thinking?: string }> {
    // 1. 构建 system prompt
    callbacks.onPhase('preparing', '构建上下文');
    const systemPrompt = await buildSystemPrompt();
    // 准备完毕后，补充 debugInfo
    callbacks.onPhase('preparing', undefined, systemPrompt);

    // 组装消息列表（system + 历史 + 当前问题）
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userQuery },
    ];

    // 2. 工具调用循环
    let round = 0;
    while (round < MAX_TOOL_ROUNDS) {
        round++;
        signal?.throwIfAborted();

        // 将当前发送给模型的消息列表作为 debugInfo
        const thinkingLabel = round === 1 ? '分析问题' : '综合分析';
        const thinkingDebug = formatMessagesDebug(messages);
        callbacks.onPhase('thinking', thinkingLabel, thinkingDebug);

        try {
            // 非流式调用（带 tools）
            const response = await chatWithTools(config, messages, TOOL_DEFINITIONS, signal);

            // 没有 tool_calls → 本轮 thinking 的模型调用已经给出了最终回答
            if (!response.tool_calls || response.tool_calls.length === 0) {
                if (response.content) {
                    // 内容由本轮 thinking 直接产出，无需额外 answering 阶段
                    if (response.thinking) {
                        callbacks.onThinking?.(response.thinking);
                    }
                    callbacks.onChunk(response.content);
                    return { content: response.content, thinking: response.thinking };
                }
                // 空内容 → 跳出循环，由下方 answering 兜底流式生成
                break;
            }

            // 有 tool_calls → 执行工具
            // 将 assistant 的 tool_calls 消息加入历史
            messages.push({
                role: 'assistant',
                content: response.content || '',
                tool_calls: response.tool_calls,
            } as any);

            // 逐个执行工具
            for (const tc of response.tool_calls) {
                signal?.throwIfAborted();

                let args: Record<string, unknown> = {};
                try {
                    args = JSON.parse(tc.function.arguments);
                } catch {
                    args = {};
                }

                const toolLabel = formatToolLabel(tc.function.name, args);
                callbacks.onPhase('toolCall', toolLabel);

                const result = await executeTool(tc.function.name, args);

                // 构建工具调用的详细调试信息
                const toolDebug = JSON.stringify({ tool: tc.function.name, args, result }, null, 2);
                callbacks.onPhase('toolCall', toolLabel, toolDebug);

                // 通知 UI
                callbacks.onToolCall?.({
                    name: tc.function.name,
                    args,
                    result,
                });

                // 将工具结果以 role: 'tool' 追加
                messages.push({
                    role: 'tool',
                    content: result,
                    tool_call_id: tc.id,
                } as any);
            }
        } catch (err: any) {
            // function calling 不支持 → 跳出循环，由 answering 兜底
            if (isFunctionCallingUnsupported(err)) {
                callbacks.onPhase('thinking', thinkingLabel + '（不支持工具调用，切换为直接对话）');
                break;
            }
            throw err;
        }
    }

    // 3. 兜底：流式输出（仅当 thinking 循环未产出内容时到达此处）
    const answeringDebug = formatMessagesDebug(messages);
    callbacks.onPhase('answering', '流式生成', answeringDebug);
    signal?.throwIfAborted();

    let accumulated = '';
    let thinkingAccum = '';

    await chatStream(
        config,
        messages,
        (delta) => {
            accumulated += delta;
            callbacks.onChunk(delta);
        },
        signal,
        (thinkingDelta) => {
            thinkingAccum += thinkingDelta;
            callbacks.onThinking?.(thinkingDelta);
        },
    );

    return { content: accumulated, thinking: thinkingAccum || undefined };
}

/**
 * 为工具调用生成可读标签
 */
function formatToolLabel(name: string, args: Record<string, unknown>): string {
    switch (name) {
        case 'query_time_entries': {
            const parts = [`${args.start_date} ~ ${args.end_date}`];
            if (args.category) parts.push(`类别: ${args.category}`);
            if (args.goal) parts.push(`目标: ${args.goal}`);
            return `查询记录 (${parts.join(', ')})`;
        }
        case 'list_categories':
            return '获取类别列表';
        case 'list_goals':
            return `获取目标 (${args.start_date} ~ ${args.end_date})`;
        default:
            return name;
    }
}

/**
 * 格式化消息列表为可读的调试文本
 */
function formatMessagesDebug(messages: ChatMessage[]): string {
    return messages.map((m, i) => {
        const msg = m as any;
        const role = msg.role.toUpperCase();
        const parts: string[] = [];

        // 主内容
        const content = msg.content || '';
        if (content) {
            const display = content.length > 2000
                ? content.slice(0, 2000) + `\n... (${content.length} chars total)`
                : content;
            parts.push(display);
        }

        // assistant 的 tool_calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            const calls = msg.tool_calls.map((tc: any) => {
                const name = tc.function?.name || 'unknown';
                let argsStr = tc.function?.arguments || '{}';
                try { argsStr = JSON.stringify(JSON.parse(argsStr), null, 2); } catch { /* keep raw */ }
                return `  → ${name}(${argsStr})`;
            }).join('\n');
            parts.push(`[tool_calls]\n${calls}`);
        }

        // tool 消息的 tool_call_id
        const suffix = msg.tool_call_id ? ` (tool_call_id: ${msg.tool_call_id})` : '';

        return `── [${i + 1}] ${role}${suffix} ──\n${parts.join('\n') || '(empty)'}`;
    }).join('\n\n');
}

/**
 * 简单检测 API 是否不支持 function calling
 */
function isFunctionCallingUnsupported(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    return (
        msg.includes('tools') ||
        msg.includes('function') ||
        msg.includes('not supported') ||
        msg.includes('invalid parameter')
    );
}
