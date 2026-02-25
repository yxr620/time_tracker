/**
 * AI 设置弹窗
 * 选择服务商、填写 API Key、选择模型
 */

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { closeOutline, chevronDownOutline, chevronForwardOutline, addOutline, trashOutline } from 'ionicons/icons';
import { useAIStore } from '../../stores/aiStore';
import { AI_PROVIDERS } from '../../services/ai/providers';

interface AISettingsProps {
  onClose: () => void;
}

export const AISettings: React.FC<AISettingsProps> = ({ onClose }) => {
  const { config, providerConfigs, customModels, updateConfig, setProvider, addCustomModel, removeCustomModel } = useAIStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  const currentProvider = AI_PROVIDERS.find(p => p.id === config.providerId);
  /** 当前 provider 的用户自定义模型 */
  const providerCustomModels = customModels[config.providerId] || [];
  const presetModels = currentProvider?.models || [];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvider(e.target.value);
  };

  /** 判断某 provider 是否已配置了 API Key */
  const isProviderConfigured = (id: string) => {
    return !!(providerConfigs[id]?.apiKey);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="ai-settings-overlay" onClick={handleOverlayClick}>
      <div className="ai-settings-modal">
        {/* 头部 */}
        <div className="ai-settings-header">
          <h2>AI 设置</h2>
          <button className="ai-settings-close" onClick={onClose}>
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        {/* 服务商选择 */}
        <div className="ai-field">
          <label className="ai-field-label">服务商</label>
          <select value={config.providerId} onChange={handleProviderChange}>
            {AI_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{isProviderConfigured(p.id) ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div className="ai-field">
          <label className="ai-field-label">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={e => updateConfig({ apiKey: e.target.value })}
            placeholder={currentProvider?.placeholder || '输入 API Key'}
          />
          <div className="ai-field-hint">密钥仅存储在本地，不会上传到任何服务器</div>
        </div>

        {/* 模型选择 */}
        <div className="ai-field">
          <label className="ai-field-label">模型</label>
          {/* 预设模型（如有） */}
          {presetModels.length > 0 && (
            <select
              value={presetModels.includes(config.model) ? config.model : ''}
              onChange={e => {
                if (e.target.value) updateConfig({ model: e.target.value });
              }}
            >
              {!presetModels.includes(config.model) && (
                <option value="" disabled>预设模型</option>
              )}
              {presetModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {/* 用户添加的自定义模型列表 */}
          {providerCustomModels.length > 0 && (
            <>
              <div className="ai-field-sublabel">自定义模型</div>
              <div className="ai-custom-models-list">
                {providerCustomModels.map(m => (
                  <div
                    key={m}
                    className={`ai-custom-model-chip ${m === config.model ? 'active' : ''}`}
                    onClick={() => updateConfig({ model: m })}
                  >
                    <span className="ai-custom-model-chip-name">{m}</span>
                    <button
                      className="ai-custom-model-chip-del"
                      onClick={e => {
                        e.stopPropagation();
                        removeCustomModel(m);
                        if (m === config.model) {
                          const fallback = presetModels[0] || providerCustomModels.filter(x => x !== m)[0] || '';
                          if (fallback) updateConfig({ model: fallback });
                        }
                      }}
                      title="删除"
                    >
                      <IonIcon icon={trashOutline} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* 输入新模型名称 */}
          <div className="ai-custom-model-add">
            <input
              type="text"
              value={newModelName}
              onChange={e => setNewModelName(e.target.value)}
              placeholder="输入模型名称并保存"
              onKeyDown={e => {
                if (e.key === 'Enter' && newModelName.trim()) {
                  addCustomModel(newModelName.trim());
                  updateConfig({ model: newModelName.trim() });
                  setNewModelName('');
                }
              }}
            />
            <button
              className="ai-custom-model-add-btn"
              onClick={() => {
                if (newModelName.trim()) {
                  addCustomModel(newModelName.trim());
                  updateConfig({ model: newModelName.trim() });
                  setNewModelName('');
                }
              }}
              title="保存模型"
              disabled={!newModelName.trim()}
            >
              <IonIcon icon={addOutline} />
              保存
            </button>
          </div>
          <div className="ai-field-hint">添加自定义模型后可在下拉列表中快速切换</div>
        </div>

        {/* 高级设置 */}
        <button
          className="ai-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <IonIcon icon={showAdvanced ? chevronDownOutline : chevronForwardOutline} />
          高级设置
        </button>

        {showAdvanced && (
          <div className="ai-field">
            <label className="ai-field-label">Base URL</label>
            <input
              type="text"
              value={config.baseURL}
              onChange={e => updateConfig({ baseURL: e.target.value })}
              placeholder="https://..."
            />
            <div className="ai-field-hint">
              修改此项可接入 Ollama 本地模型或其他 OpenAI 兼容代理
            </div>
          </div>
        )}

        {/* 保存 */}
        <button className="ai-save-btn" onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
};
