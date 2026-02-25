/**
 * AI Store
 * 管理 AI 配置和对话状态
 * 支持多 Provider 配置独立保存与切换
 */

import { create } from 'zustand';
import { AI_PROVIDERS } from '../services/ai/providers';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  loading?: boolean;
  error?: boolean;
  /** 已完成的处理阶段列表（顺序累积，最后一项为当前阶段） */
  phases?: Array<{
    key: string;
    detail?: string;
    level?: number;
    failed?: boolean;
    /** 可折叠的详细调试信息（JSON、prompt 文本等） */
    debugInfo?: string;
  }>;
  /** thinking 模型输出的推理过程（流式累积） */
  thinking?: string;
}

/** 当前生效的配置（对外接口不变） */
export interface AIConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

/** 每个 Provider 独立保存的配置 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseURL: string;
}

/** localStorage 中的持久化结构 */
interface AIConfigStorage {
  activeProviderId: string;
  providers: Record<string, ProviderConfig>;
}

interface AIStore {
  // 配置
  config: AIConfig;
  /** 所有 provider 的独立配置 */
  providerConfigs: Record<string, ProviderConfig>;
  isConfigured: () => boolean;
  updateConfig: (partial: Partial<AIConfig>) => void;
  setProvider: (providerId: string) => void;

  // 对话
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  clearMessages: () => void;
}

const STORAGE_KEY = 'ai-config';

/** 为指定 provider 生成默认配置 */
function defaultProviderConfig(providerId: string): ProviderConfig {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  return {
    apiKey: '',
    model: provider?.models[0] || '',
    baseURL: provider?.baseURL || '',
  };
}

/** 从 localStorage 恢复配置（兼容旧版单配置格式） */
function loadStorage(): AIConfigStorage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // 新格式：含 activeProviderId + providers 字典
      if (parsed.activeProviderId && parsed.providers) {
        return parsed as AIConfigStorage;
      }

      // 旧格式迁移：{ providerId, baseURL, apiKey, model }
      if (parsed.providerId) {
        const old = parsed as AIConfig;
        const storage: AIConfigStorage = {
          activeProviderId: old.providerId,
          providers: {
            [old.providerId]: {
              apiKey: old.apiKey,
              model: old.model,
              baseURL: old.baseURL,
            },
          },
        };
        // 立即写回新格式
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
        return storage;
      }
    }
  } catch { /* ignore */ }

  const defaultId = AI_PROVIDERS[0].id;
  return {
    activeProviderId: defaultId,
    providers: { [defaultId]: defaultProviderConfig(defaultId) },
  };
}

function resolveConfig(storage: AIConfigStorage): AIConfig {
  const id = storage.activeProviderId;
  const pc = storage.providers[id] || defaultProviderConfig(id);
  return { providerId: id, baseURL: pc.baseURL, apiKey: pc.apiKey, model: pc.model };
}

function saveStorage(storage: AIConfigStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch { /* ignore */ }
}

const initialStorage = loadStorage();

export const useAIStore = create<AIStore>((set, get) => ({
  config: resolveConfig(initialStorage),
  providerConfigs: initialStorage.providers,
  messages: [],

  isConfigured: () => {
    const { apiKey, baseURL, model } = get().config;
    return !!(apiKey && baseURL && model);
  },

  updateConfig: (partial) => {
    const prev = get();
    const config = { ...prev.config, ...partial };
    const providerId = config.providerId;

    // 同步更新 providerConfigs
    const prevPc = prev.providerConfigs[providerId] || defaultProviderConfig(providerId);
    const updatedPc: ProviderConfig = {
      apiKey: partial.apiKey ?? prevPc.apiKey,
      model: partial.model ?? prevPc.model,
      baseURL: partial.baseURL ?? prevPc.baseURL,
    };
    const providerConfigs = { ...prev.providerConfigs, [providerId]: updatedPc };

    set({ config, providerConfigs });
    saveStorage({ activeProviderId: providerId, providers: providerConfigs });
  },

  setProvider: (providerId) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const prev = get();

    // 先保存当前 provider 的最新配置
    const currentId = prev.config.providerId;
    const currentPc: ProviderConfig = {
      apiKey: prev.config.apiKey,
      model: prev.config.model,
      baseURL: prev.config.baseURL,
    };
    const providerConfigs = { ...prev.providerConfigs, [currentId]: currentPc };

    // 恢复目标 provider 的配置（若无则用默认值）
    const targetPc = providerConfigs[providerId] || defaultProviderConfig(providerId);
    const config: AIConfig = {
      providerId,
      baseURL: targetPc.baseURL,
      apiKey: targetPc.apiKey,
      model: targetPc.model,
    };

    providerConfigs[providerId] = targetPc;

    set({ config, providerConfigs });
    saveStorage({ activeProviderId: providerId, providers: providerConfigs });
  },

  addMessage: (msg) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = { ...msg, id, timestamp: Date.now() };
    set(s => ({ messages: [...s.messages, message] }));
    return id;
  },

  updateMessage: (id, partial) => {
    set(s => ({
      messages: s.messages.map(m => m.id === id ? { ...m, ...partial } : m),
    }));
  },

  clearMessages: () => set({ messages: [] }),
}));
