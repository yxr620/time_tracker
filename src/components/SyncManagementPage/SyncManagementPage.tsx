import { useState, useEffect } from 'react';
import {
  IonButton,
  IonSpinner,
  IonToggle,
  useIonAlert,
  useIonToast,
  IonAccordionGroup,
  IonAccordion,
  IonItem,
  IonLabel
} from '@ionic/react';
import { syncEngine, type SyncStats, type SyncResult } from '../../services/syncEngine';
import { isOSSConfigured } from '../../services/oss';
import { useSyncStore } from '../../stores/syncStore';
import {
  getSavedOSSConfig,
  saveOSSConfig as persistOSSConfig,
  clearOSSConfig as removeOSSConfig,
  type OSSConfig,
} from '../../services/syncConfig';
import './SyncManagementPage.css';

export const SyncManagementPage: React.FC = () => {
  const { autoSyncEnabled, setAutoSyncEnabled, checkConfig } = useSyncStore();
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showOSSForm, setShowOSSForm] = useState(false);
  const [ossForm, setOSSForm] = useState<OSSConfig>({
    region: '', bucket: '', accessKeyId: '', accessKeySecret: ''
  });
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  useEffect(() => {
    loadStats();
    const configured = isOSSConfigured();
    setIsConfigured(configured);
    // 如果未配置，自动显示配置表单
    if (!configured) setShowOSSForm(true);
    // 加载已保存的配置到表单
    const saved = getSavedOSSConfig();
    if (saved) {
      setOSSForm(saved);
    }
  }, []);

  const loadStats = async () => {
    try {
      const data = await syncEngine.getSyncStats();
      setStats(data);
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  const showToast = (message: string, color: 'success' | 'danger') => {
    presentToast({
      message,
      duration: 2000,
      position: 'top',
      color
    });
  };

  const handleSync = async (syncFn: () => Promise<SyncResult>, actionName: string) => {
    setLoading(true);
    try {
      const result = await syncFn();
      setLastResult(result);
      await loadStats();

      if (result.status === 'success') {
        showToast(result.message, 'success');
      } else {
        showToast(`${actionName} 失败，详情请查看设置页`, 'danger');
      }
    } catch (error) {
      console.error(`${actionName} 失败:`, error);
      showToast(`${actionName} 失败`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleIncrementalSync = () => {
    handleSync(() => syncEngine.incrementalSync(), '增量同步');
  };

  const handleIncrementalPush = () => {
    handleSync(() => syncEngine.incrementalPush(), '增量 Push');
  };

  const handleIncrementalPull = () => {
    handleSync(() => syncEngine.incrementalPull(), '增量 Pull');
  };

  const handleForceFullSync = () => {
    presentAlert({
      header: '强制全量同步',
      message: '这将重新上传所有本地数据，并拉取所有远程数据。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: () => {
            handleSync(() => syncEngine.forceFullSync(), '强制全量同步');
          }
        }
      ]
    });
  };

  const handleForceFullPush = () => {
    presentAlert({
      header: '强制全量 Push',
      message: '⚠️ 这将重新上传所有本地数据到云端。适用于 OSS 被清空的恢复场景。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: () => {
            handleSync(() => syncEngine.forceFullPush(), '强制全量 Push');
          }
        }
      ]
    });
  };

  const handleForceFullPull = () => {
    presentAlert({
      header: '强制全量 Pull',
      message: '⚠️ 这将拉取并合并所有远程数据。可能会覆盖本地未同步的修改。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: () => {
            handleSync(() => syncEngine.forceFullPull(), '强制全量 Pull');
          }
        }
      ]
    });
  };

  const handleResetSyncState = () => {
    presentAlert({
      header: '重置同步状态',
      message: '这将清空最后处理的时间戳，下次 Pull 会重新拉取所有文件。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: async () => {
            try {
              await syncEngine.resetSyncState();
              await loadStats();
              showToast('同步状态已重置', 'success');
            } catch (error) {
              console.error('重置同步状态失败:', error);
              showToast('重置失败', 'danger');
            }
          }
        }
      ]
    });
  };

  const handleCleanupLogs = () => {
    presentAlert({
      header: '清理操作日志',
      message: '这将删除 7 天前的已同步操作日志。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: async () => {
            try {
              const count = await syncEngine.cleanupSyncedOperations(7);
              await loadStats();
              showToast(`已清理 ${count} 条操作日志`, 'success');
            } catch (error) {
              console.error('清理操作日志失败:', error);
              showToast('清理失败', 'danger');
            }
          }
        }
      ]
    });
  };

  const handlePurgeDeletedRecords = () => {
    presentAlert({
      header: '清理已删除数据',
      message: '这将物理删除 30 天前已软删除的记录。确保所有设备都已同步后再执行。确定继续？',
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '确定',
          handler: async () => {
            setLoading(true);
            try {
              const result = await syncEngine.purgeDeletedRecords(30);
              const total = result.entries + result.goals + result.categories;
              await loadStats();
              showToast(`已清理 ${total} 条软删除记录`, 'success');
            } catch (error) {
              console.error('清理已删除数据失败:', error);
              showToast('清理失败', 'danger');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    });
  };

  return (
    <div className="sync-management-page">
      <div className="sync-panel sync-panel--hero">
        <div>
          <div className="sync-panel-title">云端同步中心</div>
          <div className="sync-panel-desc">统一管理 OSS 配置、自动同步与数据恢复操作</div>
        </div>
        <span className={`sync-status-pill ${isConfigured ? 'is-ok' : 'is-warning'}`}>
          {isConfigured ? '已连接 OSS' : '未配置 OSS'}
        </span>
      </div>

      {isConfigured && !showOSSForm && (
        <div className="sync-panel sync-panel--toggle">
          <div>
            <div className="sync-panel-title">自动同步</div>
            <div className="sync-panel-desc">数据变更自动推送，启动时自动拉取</div>
          </div>
          <IonToggle checked={autoSyncEnabled} onIonChange={(e) => setAutoSyncEnabled(e.detail.checked)} />
        </div>
      )}

      {(!isConfigured || showOSSForm) && (
        <div className="sync-panel">
          <div className="sync-panel-title">{isConfigured ? '修改 OSS 配置' : 'OSS 配置'}</div>
          {!isConfigured && (
            <div className="sync-panel-desc">请输入阿里云 OSS 配置信息以启用同步功能</div>
          )}

          <div className="sync-form-grid">
            <div className="sync-form-item">
              <label className="sync-form-label">Region</label>
              <input
                className="sync-form-input"
                type="text"
                value={ossForm.region}
                onChange={(e) => setOSSForm(f => ({ ...f, region: e.target.value }))}
                placeholder="oss-cn-hangzhou"
              />
            </div>
            <div className="sync-form-item">
              <label className="sync-form-label">Bucket</label>
              <input
                className="sync-form-input"
                type="text"
                value={ossForm.bucket}
                onChange={(e) => setOSSForm(f => ({ ...f, bucket: e.target.value }))}
                placeholder="your-bucket-name"
              />
            </div>
            <div className="sync-form-item">
              <label className="sync-form-label">AccessKey ID</label>
              <input
                className="sync-form-input"
                type="password"
                value={ossForm.accessKeyId}
                onChange={(e) => setOSSForm(f => ({ ...f, accessKeyId: e.target.value }))}
                placeholder="your-access-key-id"
              />
            </div>
            <div className="sync-form-item">
              <label className="sync-form-label">AccessKey Secret</label>
              <input
                className="sync-form-input"
                type="password"
                value={ossForm.accessKeySecret}
                onChange={(e) => setOSSForm(f => ({ ...f, accessKeySecret: e.target.value }))}
                placeholder="your-access-key-secret"
              />
            </div>
          </div>

          <div className="sync-inline-actions">
            <IonButton
              expand="block"
              onClick={() => {
                if (!ossForm.bucket || !ossForm.accessKeyId || !ossForm.accessKeySecret) {
                  showToast('请填写 Bucket、AccessKey ID 和 AccessKey Secret', 'danger');
                  return;
                }
                const config: OSSConfig = {
                  region: ossForm.region || 'oss-cn-hangzhou',
                  bucket: ossForm.bucket,
                  accessKeyId: ossForm.accessKeyId,
                  accessKeySecret: ossForm.accessKeySecret,
                };
                persistOSSConfig(config);
                setIsConfigured(true);
                setShowOSSForm(false);
                checkConfig();
                loadStats();
                showToast('OSS 配置已保存', 'success');
              }}
              style={{ '--border-radius': '10px', height: '42px', margin: '0', flex: 1 }}
            >
              💾 保存配置
            </IonButton>
            {isConfigured && (
              <IonButton
                fill="outline"
                onClick={() => setShowOSSForm(false)}
                style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
              >
                取消
              </IonButton>
            )}
          </div>

          {isConfigured && (
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={() => {
                presentAlert({
                  header: '清除 OSS 配置',
                  message: '清除后将回退到 .env 环境变量配置。如果 .env 中没有配置，同步功能将被禁用。确定继续？',
                  buttons: [
                    { text: '取消', role: 'cancel' },
                    {
                      text: '确定清除',
                      handler: () => {
                        removeOSSConfig();
                        setOSSForm({ region: '', bucket: '', accessKeyId: '', accessKeySecret: '' });
                        const nowConfigured = isOSSConfigured();
                        setIsConfigured(nowConfigured);
                        if (!nowConfigured) setShowOSSForm(true);
                        checkConfig();
                        showToast('OSS 配置已清除', 'success');
                      }
                    }
                  ]
                });
              }}
              style={{ '--border-radius': '10px', height: '42px', margin: '12px 0 0' }}
            >
              🗑️ 清除应用内配置
            </IonButton>
          )}
        </div>
      )}

      {isConfigured && !showOSSForm && (
        <>
          <div className="sync-panel">
            <div className="sync-panel-title">增量同步（推荐）</div>
            <div className="sync-panel-desc">建议优先使用增量同步来降低冲突与耗时</div>

            <div className="sync-action-group">
              <IonButton
                expand="block"
                onClick={handleIncrementalSync}
                disabled={loading}
                style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
              >
                {loading ? <IonSpinner name="dots" /> : '🔄 增量同步 (Push + Pull)'}
              </IonButton>
              <div className="sync-action-hint">同步本地和云端的增量数据</div>

              <IonButton
                expand="block"
                fill="outline"
                onClick={handleIncrementalPush}
                disabled={loading}
                style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
              >
                ⬆️ 增量 Push
              </IonButton>
              <div className="sync-action-hint">上传本地未同步的数据到云端</div>

              <IonButton
                expand="block"
                fill="outline"
                onClick={handleIncrementalPull}
                disabled={loading}
                style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
              >
                ⬇️ 增量 Pull
              </IonButton>
              <div className="sync-action-hint">下载云端的增量数据到本地</div>
            </div>
          </div>

          <div className="sync-panel">
            <div className="sync-panel-title">同步状态</div>
            {stats ? (
              <div className="sync-stats">
                <div className="stat-item">
                  <span className="stat-label">OSS 配置:</span>
                  <span className="stat-value stat-value--link" onClick={() => setShowOSSForm(true)}>
                    ✅ 已配置（点击修改）
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">设备 ID:</span>
                  <span className="stat-value stat-value--mono">{stats.deviceId.substring(0, 8)}...</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">未同步操作:</span>
                  <span className={`stat-value ${stats.pendingOps > 0 ? 'is-danger' : 'is-warning'}`}>{stats.pendingOps} 条</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已同步操作:</span>
                  <span className="stat-value">{stats.syncedOps} 条</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">数据记录:</span>
                  <span className="stat-value">
                    {stats.totalEntries} 条目 / {stats.totalGoals} 目标 / {stats.totalCategories} 分类
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已删除记录:</span>
                  <span className={`stat-value ${(stats.deletedEntries + stats.deletedGoals + stats.deletedCategories) > 0 ? 'is-danger' : ''}`}>
                    {stats.deletedEntries + stats.deletedGoals + stats.deletedCategories} 条
                  </span>
                </div>
              </div>
            ) : (
              <div className="sync-loading-wrap">
                <IonSpinner />
              </div>
            )}
          </div>

          <div className="sync-panel">
            <IonAccordionGroup>
              <IonAccordion value="advanced" style={{ background: 'transparent' }}>
                <IonItem slot="header" style={{ '--border-radius': '8px', '--padding-start': '0', '--background': 'transparent' }}>
                  <IonLabel style={{ fontWeight: 'bold', color: 'hsl(var(--foreground))' }}>高级与数据恢复操作</IonLabel>
                </IonItem>
                <div className="sync-advanced" slot="content">
                  <div>
                    <div className="sync-subsection-title">强制全量同步（数据恢复）</div>
                    <div className="sync-subsection-desc">⚠️ 适用于数据恢复或重建同步状态的场景</div>
                    <div className="sync-action-group">
                      <IonButton
                        expand="block"
                        color="warning"
                        onClick={handleForceFullSync}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        ⚠️ 强制全量同步 (Push + Pull)
                      </IonButton>
                      <div className="sync-action-hint">重新上传并拉取所有数据</div>

                      <IonButton
                        expand="block"
                        fill="outline"
                        color="warning"
                        onClick={handleForceFullPush}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        强制全量 Push ⚠️
                      </IonButton>
                      <div className="sync-action-hint">重新上传所有本地数据到云端</div>

                      <IonButton
                        expand="block"
                        fill="outline"
                        color="warning"
                        onClick={handleForceFullPull}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        强制全量 Pull ⚠️
                      </IonButton>
                      <div className="sync-action-hint">拉取并合并所有远程数据</div>
                    </div>
                  </div>

                  <div className="sync-maintenance">
                    <div className="sync-subsection-title">高级维护</div>
                    <div className="sync-action-group">
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={handleResetSyncState}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        🔄 重置同步状态
                      </IonButton>
                      <div className="sync-action-hint">清空时间戳，下次 Pull 会重新拉取所有文件</div>

                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={handleCleanupLogs}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        🗑️ 清理操作日志
                      </IonButton>
                      <div className="sync-action-hint">删除 7 天前的已同步操作日志</div>

                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={handlePurgeDeletedRecords}
                        disabled={loading}
                        style={{ '--border-radius': '10px', height: '42px', margin: '0' }}
                      >
                        🗑️ 清理已删除数据
                      </IonButton>
                      <div className="sync-action-hint">物理删除 30 天前已软删除的记录</div>
                    </div>
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>

          {lastResult && (
            <div className="sync-panel">
              <div className="sync-panel-title">最近同步结果</div>
              <div className="sync-result">
                <div className="result-item">
                  <span className="result-label">状态:</span>
                  <span className={`result-value ${lastResult.status === 'success' ? 'is-success' : 'is-danger'}`}>
                    {lastResult.status === 'success' ? '✅ 成功' : '❌ 失败'}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">消息:</span>
                  <span className="result-value">{lastResult.message}</span>
                </div>
                {lastResult.pushedCount !== undefined && (
                  <div className="result-item">
                    <span className="result-label">上传:</span>
                    <span className="result-value">↑ {lastResult.pushedCount} 条</span>
                  </div>
                )}
                {lastResult.pulledCount !== undefined && (
                  <div className="result-item">
                    <span className="result-label">下载:</span>
                    <span className="result-value">↓ {lastResult.pulledCount} 条</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
