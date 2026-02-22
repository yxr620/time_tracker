/**
 * 上下文构建器
 * 从 IndexedDB 检索时间记录，格式化为 LLM 可理解的 prompt 上下文
 * 复用 processor.ts 现有逻辑
 *
 * 时间解析两阶段策略：
 * 1. 本地正则（零延迟）
 * 2. 正则未匹配时，调 LLM 做轻量时间提取（非流式，~300-500ms）
 */

import { format } from 'date-fns';
import { loadRawData, processEntries, formatDuration } from '../analysis/processor';
import { parseTimeRange } from './intentParser';
import { chatOnce, type LLMConfig } from './llmClient';
import type { DateRange } from '../../types/analysis';

const MAX_ENTRIES = 200;

/**
 * 用 LLM 提取用户问题中的时间范围
 * 返回 { range, raw }，raw 为 LLM 原始回复（用于调试展示）
 */
async function extractTimeWithLLM(
  query: string,
  config: LLMConfig,
): Promise<{ range: DateRange | null; raw: string }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const systemPrompt = `你是时间范围解析工具。当前日期：${today}。
从用户的问题中提取需要查询的时间范围，只返回 JSON，不包含其他内容：
{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}
规则：某一天→start=end=该日；某一周→周一到周日；某个月→月初到月末；无法确定→返回 null`;

  try {
    const raw = await chatOnce(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]);
    // 兼容 LLM 可能包裹 ```json 等格式
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return { range: null, raw };
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && parsed.start && parsed.end) {
      const start = new Date(parsed.start);
      const end = new Date(parsed.end);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { range: { start, end }, raw };
      }
    }
    return { range: null, raw };
  } catch (e) {
    // 静默降级，不影响主流程
    return { range: null, raw: String(e) };
  }
}

/**
 * 根据用户提问构建 system prompt
 * 1. 本地正则解析时间范围（零成本）
 * 2. 正则未匹配 → LLM 轻量提取时间范围（可选，~300ms）
 * 3. 从 DB 检索数据并格式化
 */
export async function buildTimeContext(
  userQuery: string,
  llmConfig?: LLMConfig,
  onPhase?: (phase: 'parsing' | 'resolving' | 'loading' | 'thinking', detail?: string) => void,
): Promise<{
  systemPrompt: string;
  dateRange: DateRange;
}> {
  // 1. 本地正则（快速路径）
  onPhase?.('parsing');
  const { range: regexRange, matched } = parseTimeRange(userQuery);

  // 2. 正则未命中 → 尝试 LLM 提取（慢速路径，静默降级）
  let dateRange = regexRange;
  if (!matched && llmConfig) {
    onPhase?.('resolving'); // 先触发以显示 spinner
    const { range: llmRange, raw } = await extractTimeWithLLM(userQuery, llmConfig);
    onPhase?.('resolving', raw); // 再次触发携带原始回复用于调试展示
    if (llmRange) dateRange = llmRange;
  }

  // 3. 检索数据
  const rangeLabel = `${format(dateRange.start, 'MM月dd日')} 至 ${format(dateRange.end, 'MM月dd日')}`;
  onPhase?.('loading', rangeLabel);
  const { entries: rawEntries, goals, categories } = await loadRawData({ dateRange });
  const processed = processEntries(rawEntries, goals, categories);

  // 3. 按日期排序
  const sorted = [...processed].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // 4. 截断（保留摘要完整性）
  const truncated = sorted.length > MAX_ENTRIES;
  const display = truncated ? sorted.slice(-MAX_ENTRIES) : sorted;

  // 5. 格式化详细记录
  const entriesText = display
    .map(e => {
      const start = format(e.startTime, 'MM-dd HH:mm');
      const end = format(e.endTime, 'HH:mm');
      return `${start}~${end} | ${e.activity} | ${e.categoryName} | ${e.goalName} | ${formatDuration(e.duration)}`;
    })
    .join('\n');

  // 6. 摘要统计
  const totalMinutes = processed.reduce((s, e) => s + e.duration, 0);

  const categoryAgg: Record<string, number> = {};
  const goalAgg: Record<string, number> = {};
  processed.forEach(e => {
    categoryAgg[e.categoryName] = (categoryAgg[e.categoryName] || 0) + e.duration;
    goalAgg[e.goalName] = (goalAgg[e.goalName] || 0) + e.duration;
  });

  const categoryStats = Object.entries(categoryAgg)
    .sort((a, b) => b[1] - a[1])
    .map(([name, min]) => `${name}: ${formatDuration(min)}`)
    .join(', ');

  const goalStats = Object.entries(goalAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, min]) => `${name}: ${formatDuration(min)}`)
    .join(', ');

  // 7. 组装 System Prompt
  const systemPrompt = `你是用户的个人时间管理助手。根据以下时间记录数据回答用户的问题。

## 时间范围
${format(dateRange.start, 'yyyy-MM-dd')} 至 ${format(dateRange.end, 'yyyy-MM-dd')}

## 统计摘要
- 记录数：${processed.length} 条${truncated ? `（仅展示最近 ${MAX_ENTRIES} 条详情）` : ''}
- 总时长：${formatDuration(totalMinutes)}
- 类别分布：${categoryStats || '无'}
- 目标分布（Top 10）：${goalStats || '无'}

## 详细记录
日期时间 | 活动 | 类别 | 目标 | 时长
${entriesText || '（无记录）'}

## 回答规则
1. 用中文回答，语气自然简洁
2. 时长用"X小时Y分钟"格式
3. 给出有洞察的总结和分析，不要只是复述数据
4. 数据为空时如实告知
5. 如果用户的问题与时间记录无关，礼貌地引导回时间管理话题`;

  // 数据准备完毕，通知进入生成阶段
  onPhase?.('thinking');

  return { systemPrompt, dateRange };
}
