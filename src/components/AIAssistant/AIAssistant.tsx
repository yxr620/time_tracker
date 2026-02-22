/**
 * AI 时间助手 - 主面板
 * 桌面端对话界面：快捷问题 + 消息列表 + 输入框
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IonIcon } from '@ionic/react';
import { sendOutline, trashOutline, stopCircleOutline, settingsOutline } from 'ionicons/icons';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAIStore } from '../../stores/aiStore';
import { runToolCallLoop } from '../../services/ai/toolCallEngine';
import type { ChatMessage as LLMMessage } from '../../services/ai/llmClient';
import { AI_PROVIDERS } from '../../services/ai/providers';
import './AIAssistant.css';

// 配置 marked：关闭 mangle/headerIds 避免不必要的输出
marked.setOptions({
  breaks: true,       // 换行符 → <br>
  gfm: true,          // GitHub Flavored Markdown（表格、删除线等）
});

// 快捷问题预设
const QUICK_PROMPTS = [
  '📊 生成本周报告',
  '📊 生成本月报告',
  '昨天做了什么？',
  '上周时间总结',
  '本月哪个类别花的时间最多？',
  '最近7天的工作效率如何？',
  '对比本周和上周',
];

/** Markdown → 安全 HTML */
function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

// 阶段配置：label 和 icon
const PHASE_CONFIG: Record<string, { label: string; icon: string }> = {
  preparing: { icon: '📋', label: '准备上下文' },
  thinking: { icon: '💭', label: '分析问题' },
  toolCall: { icon: '🔧', label: '查询数据' },
  answering: { icon: '✍️', label: '生成回答' },
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
  const { config, providerConfigs, messages, addMessage, updateMessage, clearMessages, isConfigured, updateConfig, setProvider } = useAIStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentProvider = AI_PROVIDERS.find(p => p.id === config.providerId);
  const isCustom = config.providerId === 'custom';
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
      // 构建消息历史（最多保留最近 6 条对话）
      const historyMessages = useAIStore.getState().messages;
      const recentHistory: LLMMessage[] = historyMessages
        .filter(m => m.id !== aiMsgId && m.role !== 'assistant' || (m.role === 'assistant' && m.content && !m.loading))
        .filter(m => m.id !== aiMsgId)
        .slice(-6)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let accumulated = '';
      let thinkingAccum = '';

      const { content, thinking } = await runToolCallLoop(
        { baseURL: config.baseURL, apiKey: config.apiKey, model: config.model },
        query,
        recentHistory,
        {
          onPhase: (phase, detail) => {
            phasesRef.current = [
              ...phasesRef.current,
              { key: phase, detail },
            ];
            updateMessage(aiMsgId, { phases: [...phasesRef.current] });
          },
          onChunk: (delta) => {
            accumulated += delta;
            updateMessage(aiMsgId, { content: accumulated, loading: true });
          },
          onThinking: (thinkingDelta) => {
            thinkingAccum += thinkingDelta;
            updateMessage(aiMsgId, { thinking: thinkingAccum, loading: true });
          },
          onToolCall: () => {
            // 工具调用信息已通过 onPhase 显示
          },
        },
        abort.signal,
      );

      updateMessage(aiMsgId, {
        content: content || accumulated,
        thinking: thinking || thinkingAccum || undefined,
        loading: false,
      });
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
      {/* 头部：内联 API 配置 */}
      <div className="ai-header">
        <div className="ai-header-config">
          <select
            className="ai-config-select ai-config-provider"
            value={config.providerId}
            onChange={e => setProvider(e.target.value)}
            title="选择服务商"
          >
            {AI_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{providerConfigs[p.id]?.apiKey ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <input
            className="ai-config-input ai-config-key"
            type="password"
            value={config.apiKey}
            onChange={e => updateConfig({ apiKey: e.target.value })}
            placeholder={currentProvider?.placeholder || 'API Key'}
            title="API Key（仅存储在本地）"
          />
          {isCustom || (currentProvider?.models.length === 0) ? (
            <input
              className="ai-config-input ai-config-model"
              type="text"
              value={config.model}
              onChange={e => updateConfig({ model: e.target.value })}
              placeholder="模型名称"
              title="模型"
            />
          ) : (
            <select
              className="ai-config-select ai-config-model"
              value={config.model}
              onChange={e => updateConfig({ model: e.target.value })}
              title="选择模型"
            >
              {currentProvider?.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
        <div className="ai-header-actions">
          {messages.length > 0 && (
            <button className="ai-icon-btn" onClick={clearMessages} title="清空对话">
              <IonIcon icon={trashOutline} />
            </button>
          )}
          <button
            className={`ai-icon-btn ${showAdvanced ? 'ai-icon-btn-active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="高级设置"
          >
            <IonIcon icon={settingsOutline} />
          </button>
        </div>
      </div>

      {/* 高级设置：Base URL */}
      {showAdvanced && (
        <div className="ai-advanced-bar">
          <label className="ai-advanced-label">Base URL</label>
          <input
            className="ai-config-input ai-config-baseurl"
            type="text"
            value={config.baseURL}
            onChange={e => updateConfig({ baseURL: e.target.value })}
            placeholder="https://..."
          />
          <span className="ai-advanced-hint">可接入 Ollama 本地模型或 OpenAI 兼容代理</span>
        </div>
      )}

      {/* 消息区 */}
      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">✨</div>
            <h2>你好！</h2>
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

    </div>
  );
};
