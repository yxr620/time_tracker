/**
 * AI 时间助手 - 主面板
 * 桌面端对话界面：快捷问题 + 消息列表 + 输入框
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IonIcon } from '@ionic/react';
import { sendOutline, settingsOutline, trashOutline, stopCircleOutline } from 'ionicons/icons';
import { useAIStore } from '../../stores/aiStore';
import { buildTimeContext } from '../../services/ai/contextBuilder';
import { chatStream, type ChatMessage as LLMMessage } from '../../services/ai/llmClient';
import { AISettings } from './AISettings';
import './AIAssistant.css';

// 快捷问题预设
const QUICK_PROMPTS = [
  '昨天做了什么？',
  '上周时间总结',
  '本月哪个类别花的时间最多？',
  '最近7天的工作效率如何？',
  '对比本周和上周',
];

/** 简单 Markdown→HTML（加粗、列表、换行） */
function renderMarkdown(text: string): string {
  return text
    // 加粗
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 无序列表
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // 连续 <li> 包裹 <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // 换行
    .replace(/\n/g, '<br/>');
}

// 阶段配置：label 和 icon
const PHASE_CONFIG: Record<string, { label: string; icon: string }> = {
  parsing: { icon: '🔍', label: '解析时间范围' },
  'parsing.regex': { icon: '📝', label: '正则匹配' },
  'parsing.llm': { icon: '🤔', label: 'AI 理解时间表达' },
  loading: { icon: '📂', label: '检索数据' },
  thinking: { icon: '💭', label: '生成回答' },
};

/**
 * 阶段列表指示器
 * - loading=true 时，最后一项显示 spinner；其余显示 ✓
 * - loading=false 时，全部显示 ✓（流程结束）
 * - level>0 的步骤缩进显示，表示子步骤
 */
const PhasesIndicator: React.FC<{
  phases: Array<{ key: string; detail?: string; level?: number; failed?: boolean }>;
  loading?: boolean;
}> = ({ phases, loading }) => (
  <div className="ai-phases">
    {phases.map((p, i) => {
      const cfg = PHASE_CONFIG[p.key] || { icon: '⏳', label: '处理中' };
      const isActive = loading && i === phases.length - 1;
      const level = p.level || 0;
      const isExpandable = p.key === 'parsing.llm' && !!p.detail && !isActive;
      return (
        <div
          key={i}
          className={`ai-phase ${isActive ? 'ai-phase-active' : p.failed ? 'ai-phase-failed' : 'ai-phase-done'}`}
          style={level > 0 ? { paddingLeft: `${level * 20}px` } : undefined}
        >
          {isActive
            ? <span className="ai-phase-spinner" />
            : p.failed
              ? <span className="ai-phase-cross">✗</span>
              : <span className="ai-phase-check">✓</span>
          }
          <span className="ai-phase-icon">{cfg.icon}</span>
          {isExpandable ? (
            <details className="ai-phase-expandable">
              <summary className="ai-phase-label ai-phase-expandable-summary">
                {cfg.label}
              </summary>
              <pre className="ai-phase-expand-content">{p.detail}</pre>
            </details>
          ) : (
            <span className="ai-phase-label">
              {isActive ? `${cfg.label}...` : cfg.label}
              {p.detail && !isExpandable && <span className="ai-phase-detail">{p.detail}</span>}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

export const AIAssistant: React.FC = () => {
  const { config, messages, addMessage, updateMessage, clearMessages, isConfigured } = useAIStore();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 阶段累积：每次发送前重置，onPhase 调用时追加
  const phasesRef = useRef<Array<{ key: string; detail?: string; level?: number; failed?: boolean }>>([]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 自适应输入框高度
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  // 发送消息
  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    if (!query || sending) return;

    if (!isConfigured()) {
      setShowSettings(true);
      return;
    }

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setSending(true);

    // 添加用户消息
    addMessage({ role: 'user', content: query });

    // 添加 AI 占位消息
    const aiMsgId = addMessage({ role: 'assistant', content: '', loading: true });
    // 每次发送前重置阶段列表
    phasesRef.current = [];

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // onPhase 回调：追加到阶段列表，不覆盖已有阶段
      // parsing 是父阶段；parsing.regex / parsing.llm 是子步骤（level=1）
      const onPhase = (phase: 'parsing' | 'resolving' | 'loading' | 'thinking', detail?: string) => {
        if (phase === 'parsing') {
          // 父阶段 + 子步骤 "正则匹配"（先标记为进行中，结果待定）
          phasesRef.current = [
            ...phasesRef.current,
            { key: 'parsing', detail },
            { key: 'parsing.regex', detail, level: 1 },
          ];
        } else if (phase === 'resolving') {
          if (phasesRef.current.some(p => p.key === 'parsing.llm')) {
            // 第二次调用：更新已有 parsing.llm 的 detail（LLM 回复内容）
            phasesRef.current = phasesRef.current.map(p =>
              p.key === 'parsing.llm' ? { ...p, detail } : p
            );
          } else {
            // 第一次调用：正则未命中，标记 regex 为 failed，追加 LLM 子步骤
            phasesRef.current = phasesRef.current.map(p =>
              p.key === 'parsing.regex' ? { ...p, failed: true } : p
            );
            phasesRef.current = [
              ...phasesRef.current,
              { key: 'parsing.llm', detail, level: 1 },
            ];
          }
        } else {
          phasesRef.current = [
            ...phasesRef.current,
            { key: phase, detail },
          ];
        }
        updateMessage(aiMsgId, { phases: [...phasesRef.current] });
      };

      // 构建上下文（传入 config 以支持 LLM 二次时间解析）
      const { systemPrompt } = await buildTimeContext(query, {
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        model: config.model,
      }, onPhase);

      // 构建消息历史（最多保留最近 6 条对话 + system）
      const historyMessages = useAIStore.getState().messages;
      const recentHistory: LLMMessage[] = historyMessages
        .filter(m => m.id !== aiMsgId) // 排除当前占位
        .slice(-6)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
      ];

      // 流式调用
      let accumulated = '';
      let thinkingAccum = '';
      await chatStream(
        { baseURL: config.baseURL, apiKey: config.apiKey, model: config.model },
        llmMessages,
        (delta) => {
          accumulated += delta;
          updateMessage(aiMsgId, { content: accumulated, loading: true });
        },
        abort.signal,
        (thinkingDelta) => {
          thinkingAccum += thinkingDelta;
          updateMessage(aiMsgId, { thinking: thinkingAccum, loading: true });
        },
      );

      updateMessage(aiMsgId, { content: accumulated, thinking: thinkingAccum || undefined, loading: false });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateMessage(aiMsgId, { loading: false });
      } else {
        const errorMsg = err.message || '请求失败';
        updateMessage(aiMsgId, { content: `❌ ${errorMsg}`, loading: false, error: true });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, sending, config, addMessage, updateMessage, isConfigured]);

  // 中断生成
  const handleStop = () => {
    abortRef.current?.abort();
  };

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-assistant">
      {/* 头部 */}
      <div className="ai-header">
        <h1>AI 时间助手</h1>
        <div className="ai-header-actions">
          {messages.length > 0 && (
            <button className="ai-icon-btn" onClick={clearMessages} title="清空对话">
              <IonIcon icon={trashOutline} />
            </button>
          )}
          <button className="ai-icon-btn" onClick={() => setShowSettings(true)} title="设置">
            <IonIcon icon={settingsOutline} />
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">✨</div>
            <h2>AI 时间助手</h2>
            <p>向我提问关于你的时间记录的任何问题</p>
            <div className="ai-quick-prompts">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="ai-quick-btn"
                  onClick={() => handleSend(prompt)}
                  disabled={sending}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
                <div className={`ai-msg-bubble ${msg.error ? 'ai-msg-error' : ''}`}>
                  {msg.role === 'assistant' ? (
                    <>
                      {/* 执行阶段列表 */}
                      {msg.phases && msg.phases.length > 0 && (
                        <PhasesIndicator phases={msg.phases} loading={msg.loading} />
                      )}
                      {/* Thinking 模型推理过程 */}
                      {msg.thinking && (
                        <details className="ai-thinking" open={!msg.content}>
                          <summary className="ai-thinking-summary">思考过程</summary>
                          <div className="ai-thinking-content">{msg.thinking}</div>
                        </details>
                      )}
                      {/* 主回答 */}
                      {msg.content ? (
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                      ) : !msg.phases?.length && msg.loading ? (
                        <div className="ai-typing"><span /><span /><span /></div>
                      ) : null}
                      {msg.loading && msg.content && <span className="ai-cursor" />}
                    </>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 快捷问题（对话中也显示） */}
      {messages.length > 0 && !sending && (
        <div className="ai-quick-bar">
          {QUICK_PROMPTS.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              className="ai-quick-btn ai-quick-btn-sm"
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="ai-input-bar">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder={isConfigured() ? '问我任何关于你时间的问题...' : '请先配置 AI 服务商 →'}
          value={input}
          onChange={(e) => { setInput(e.target.value); adjustTextareaHeight(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        {sending ? (
          <button className="ai-send-btn ai-stop-btn" onClick={handleStop} title="停止生成">
            <IonIcon icon={stopCircleOutline} />
          </button>
        ) : (
          <button
            className="ai-send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            title="发送"
          >
            <IonIcon icon={sendOutline} />
          </button>
        )}
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <AISettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
