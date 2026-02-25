/**
 * AI 时间助手 - 主面板
 * 桌面端对话界面：快捷问题 + 消息列表 + 输入框
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IonIcon } from '@ionic/react';
import { sendOutline, trashOutline, stopCircleOutline, settingsOutline, addOutline, closeCircleOutline } from 'ionicons/icons';
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
  '生成本周汇报',
  '昨天做了什么',
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
 * - 含 debugInfo 的阶段可折叠展开查看详情
 */
/** 复制文本到剪贴板 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

const PhasesIndicator: React.FC<{
  phases: Array<{ key: string; detail?: string; level?: number; failed?: boolean; debugInfo?: string }>;
  loading?: boolean;
}> = ({ phases, loading }) => (
  <div className="ai-phases">
    {phases.map((p, i) => {
      const cfg = PHASE_CONFIG[p.key] || { icon: '⏳', label: '处理中' };
      const isActive = loading && i === phases.length - 1;
      const level = p.level || 0;
      const hasDebug = !!p.debugInfo && !isActive;

      const statusIcon = isActive
        ? <span className="ai-phase-spinner" />
        : p.failed
          ? <span className="ai-phase-cross">✗</span>
          : <span className="ai-phase-check">✓</span>;

      const labelText = p.detail || (isActive ? `${cfg.label}...` : cfg.label);

      return (
        <div
          key={i}
          className={`ai-phase ${isActive ? 'ai-phase-active' : p.failed ? 'ai-phase-failed' : 'ai-phase-done'}`}
          style={level > 0 ? { paddingLeft: `${level * 20}px` } : undefined}
        >
          {statusIcon}
          <span className="ai-phase-icon">{cfg.icon}</span>
          {hasDebug ? (
            <details className="ai-phase-debug">
              <summary className="ai-phase-debug-summary">
                {labelText}
              </summary>
              <pre className="ai-phase-debug-content">{p.debugInfo}</pre>
            </details>
          ) : (
            <span className="ai-phase-label">
              {labelText}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

export const AIAssistant: React.FC = () => {
  const { config, providerConfigs, customModels, messages, addMessage, updateMessage, clearMessages, isConfigured, updateConfig, setProvider, addCustomModel, removeCustomModel } = useAIStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  /** 自定义模型：是否处于手动输入新模型模式 */
  const [customModelInput, setCustomModelInput] = useState(false);
  const [customModelDraft, setCustomModelDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentProvider = AI_PROVIDERS.find(p => p.id === config.providerId);
  /** 当前 provider 的用户自定义模型 */
  const providerCustomModels = customModels[config.providerId] || [];
  /** 预设模型 + 用户添加的模型合并列表 */
  const presetModels = currentProvider?.models || [];
  const allModels = [...presetModels, ...providerCustomModels.filter(m => !presetModels.includes(m))];
  // 阶段累积：每次发送前重置，onPhase 调用时追加
  const phasesRef = useRef<Array<{ key: string; detail?: string; level?: number; failed?: boolean; debugInfo?: string }>>([]);

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

    // 构建消息历史（在添加新消息前获取，避免当前问题被重复发送）
    const existingMessages = useAIStore.getState().messages;
    const recentHistory: LLMMessage[] = existingMessages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && !m.loading && !m.error))
      .slice(-6)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.replace(/<think>[\s\S]*?<\/think>\n?/g, '').trim(),
      }));

    // 添加用户消息
    addMessage({ role: 'user', content: query });

    // 添加 AI 占位消息
    const aiMsgId = addMessage({ role: 'assistant', content: '', loading: true });
    // 每次发送前重置阶段列表
    phasesRef.current = [];

    const abort = new AbortController();
    abortRef.current = abort;

    try {

      let accumulated = '';
      let thinkingAccum = '';

      const { content, thinking } = await runToolCallLoop(
        { baseURL: config.baseURL, apiKey: config.apiKey, model: config.model },
        query,
        recentHistory,
        {
          onPhase: (phase, detail, debugInfo) => {
            const prev = phasesRef.current;
            // 如果最后一项 key 相同且当前带 debugInfo，则更新最后一项（补充调试信息）
            if (debugInfo && prev.length > 0 && prev[prev.length - 1].key === phase) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], detail: detail ?? updated[updated.length - 1].detail, debugInfo };
              phasesRef.current = updated;
            } else {
              phasesRef.current = [...prev, { key: phase, detail, debugInfo }];
            }
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

  const buildAssistantCopyText = useCallback((msg: {
    phases?: Array<{ key: string; detail?: string; debugInfo?: string }>;
    thinking?: string;
    content: string;
  }) => {
    const sections: string[] = [];

    if (msg.phases?.length) {
      const phaseText = msg.phases.map((phase, index) => {
        const phaseName = PHASE_CONFIG[phase.key]?.label || phase.key;
        const title = phase.detail || phaseName;
        const debug = phase.debugInfo ? `\n${phase.debugInfo}` : '';
        return `${index + 1}. ${title}${debug}`;
      }).join('\n\n');
      sections.push(`过程日志\n${phaseText}`);
    }

    if (msg.thinking) {
      sections.push(`思考过程\n${msg.thinking}`);
    }

    if (msg.content) {
      sections.push(`最终回答\n${msg.content}`);
    }

    return sections.join('\n\n');
  }, []);

  const handleCopyAssistantMessage = useCallback((msgId: string, msg: {
    phases?: Array<{ key: string; detail?: string; debugInfo?: string }>;
    thinking?: string;
    content: string;
  }) => {
    const fullText = buildAssistantCopyText(msg);
    if (!fullText) return;
    copyToClipboard(fullText);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(prev => (prev === msgId ? null : prev)), 1500);
  }, [buildAssistantCopyText]);

  return (
    <div className="ai-assistant">
      {/* 头部：内联 API 配置 */}
      <div className="ai-header">
        <div className="ai-header-config">
          <select
            className="ai-config-select ai-config-provider"
            value={config.providerId}
            onChange={e => { setProvider(e.target.value); setCustomModelInput(false); setCustomModelDraft(''); }}
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
          {/* 模型选择：预设 + 用户添加，所有服务商通用 */}
          {!customModelInput ? (
            <div className="ai-custom-model-group">
              <select
                className="ai-config-select ai-config-model"
                value={config.model}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    setCustomModelInput(true);
                    setCustomModelDraft('');
                  } else {
                    updateConfig({ model: e.target.value });
                  }
                }}
                title="选择模型"
              >
                {/* 当前值不在列表中时也要显示 */}
                {!allModels.includes(config.model) && config.model && (
                  <option value={config.model}>{config.model}</option>
                )}
                {allModels.map(m => (
                  <option key={m} value={m}>
                    {m}{providerCustomModels.includes(m) ? ' ★' : ''}
                  </option>
                ))}
                <option value="__new__">+ 输入新模型</option>
              </select>
              {/* 仅用户添加的模型可删除 */}
              {providerCustomModels.includes(config.model) && (
                <button
                  className="ai-icon-btn ai-custom-model-del"
                  title="删除当前自定义模型"
                  onClick={() => {
                    removeCustomModel(config.model);
                    const fallback = presetModels[0] || providerCustomModels.filter(m => m !== config.model)[0] || '';
                    updateConfig({ model: fallback });
                  }}
                  style={{ width: 26, height: 26, fontSize: 14 }}
                >
                  <IonIcon icon={closeCircleOutline} />
                </button>
              )}
            </div>
          ) : (
            <div className="ai-custom-model-group">
              <input
                className="ai-config-input ai-config-model"
                type="text"
                value={customModelDraft}
                onChange={e => setCustomModelDraft(e.target.value)}
                placeholder="输入模型名称，回车保存"
                title="模型"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && customModelDraft.trim()) {
                    addCustomModel(customModelDraft.trim());
                    updateConfig({ model: customModelDraft.trim() });
                    setCustomModelInput(false);
                    setCustomModelDraft('');
                  } else if (e.key === 'Escape') {
                    setCustomModelInput(false);
                    setCustomModelDraft('');
                  }
                }}
              />
              <button
                className="ai-icon-btn ai-custom-model-save"
                title="保存模型"
                onClick={() => {
                  if (customModelDraft.trim()) {
                    addCustomModel(customModelDraft.trim());
                    updateConfig({ model: customModelDraft.trim() });
                    setCustomModelInput(false);
                    setCustomModelDraft('');
                  }
                }}
                style={{ width: 26, height: 26, fontSize: 14 }}
              >
                <IonIcon icon={addOutline} />
              </button>
              <button
                className="ai-icon-btn"
                title="取消"
                onClick={() => { setCustomModelInput(false); setCustomModelDraft(''); }}
                style={{ width: 26, height: 26, fontSize: 14 }}
              >
                <IonIcon icon={closeCircleOutline} />
              </button>
            </div>
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
                      {!msg.loading && (msg.content || msg.phases?.length || msg.thinking) && (
                        <button
                          className="ai-msg-copy-btn"
                          onClick={() => handleCopyAssistantMessage(msg.id, {
                            phases: msg.phases,
                            thinking: msg.thinking,
                            content: msg.content,
                          })}
                          title="复制完整过程与回答"
                        >
                          {copiedMsgId === msg.id ? '已复制' : '复制全部'}
                        </button>
                      )}
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
          {QUICK_PROMPTS.map((prompt, i) => (
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
