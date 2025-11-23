import { useState, useEffect } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonSpinner, IonText } from '@ionic/react';
import { Dialog, Toast } from 'antd-mobile';
import { syncEngine, type SyncStats, type SyncResult } from '../../services/syncEngine';
import { isOSSConfigured } from '../../services/oss';
import './SyncManagementPage.css';

export const SyncManagementPage: React.FC = () => {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadStats();
    setIsConfigured(isOSSConfigured());
  }, []);

  const loadStats = async () => {
    try {
      const data = await syncEngine.getSyncStats();
      setStats(data);
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  const handleSync = async (syncFn: () => Promise<SyncResult>, actionName: string) => {
    setLoading(true);
    try {
      const result = await syncFn();
      setLastResult(result);
      await loadStats();
      
      if (result.status === 'success') {
        Toast.show({
          icon: 'success',
          content: result.message
        });
      } else {
        Toast.show({
          icon: 'fail',
          content: result.message
        });
      }
    } catch (error) {
      console.error(`${actionName} 失败:`, error);
      Toast.show({
        icon: 'fail',
        content: `${actionName} 失败`
      });
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

  const handleForceFullSync = async () => {
    const confirmed = await Dialog.confirm({
      title: '强制全量同步',
      content: '这将重新上传所有本地数据，并拉取所有远程数据。确定继续？',
    });
    
    if (!confirmed) return;
    
    handleSync(() => syncEngine.forceFullSync(), '强制全量同步');
  };

  const handleForceFullPush = async () => {
    const confirmed = await Dialog.confirm({
      title: '强制全量 Push',
      content: '⚠️ 这将重新上传所有本地数据到云端。适用于 OSS 被清空的恢复场景。确定继续？',
    });
    
    if (!confirmed) return;
    
    handleSync(() => syncEngine.forceFullPush(), '强制全量 Push');
  };

  const handleForceFullPull = async () => {
    const confirmed = await Dialog.confirm({
      title: '强制全量 Pull',
      content: '⚠️ 这将拉取并合并所有远程数据。可能会覆盖本地未同步的修改。确定继续？',
    });
    
    if (!confirmed) return;
    
    handleSync(() => syncEngine.forceFullPull(), '强制全量 Pull');
  };

  const handleResetSyncState = async () => {
    const confirmed = await Dialog.confirm({
      title: '重置同步状态',
      content: '这将清空最后处理的时间戳，下次 Pull 会重新拉取所有文件。确定继续？',
    });
    
    if (!confirmed) return;

    try {
      await syncEngine.resetSyncState();
      await loadStats();
      Toast.show({
        icon: 'success',
        content: '同步状态已重置'
      });
    } catch (error) {
      console.error('重置同步状态失败:', error);
      Toast.show({
        icon: 'fail',
        content: '重置失败'
      });
    }
  };

  const handleCleanupLogs = async () => {
    const confirmed = await Dialog.confirm({
      title: '清理操作日志',
      content: '这将删除 7 天前的已同步操作日志。确定继续？',
    });
    
    if (!confirmed) return;

    try {
      const count = await syncEngine.cleanupSyncedOperations(7);
      await loadStats();
      Toast.show({
        icon: 'success',
        content: `已清理 ${count} 条操作日志`
      });
    } catch (error) {
      console.error('清理操作日志失败:', error);
      Toast.show({
        icon: 'fail',
        content: '清理失败'
      });
    }
  };

  if (!isConfigured) {
    return (
      <div className="sync-management-page">
        <IonCard>
          <IonCardContent>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <IonText color="medium">
                <p>OSS 未配置，无法使用同步功能</p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  请在 .env 文件中配置 OSS 相关环境变量
                </p>
              </IonText>
            </div>
          </IonCardContent>
        </IonCard>
      </div>
    );
  }

  return (
    <div className="sync-management-page">
      {/* 状态显示 */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>同步状态</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {stats ? (
            <div className="sync-stats">
              <div className="stat-item">
                <span className="stat-label">OSS 配置:</span>
                <span className="stat-value">✅ 已配置</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">设备 ID:</span>
                <span className="stat-value">{stats.deviceId.substring(0, 8)}...</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">未同步操作:</span>
                <span className="stat-value">{stats.pendingOps} 条</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">已同步操作:</span>
                <span className="stat-value">{stats.syncedOps} 条</span>
              </div>
            </div>
          ) : (
            <IonSpinner />
          )}
        </IonCardContent>
      </IonCard>

      {/* 增量同步 */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>增量同步（推荐）</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <div className="button-group">
            <IonButton expand="block" onClick={handleIncrementalSync} disabled={loading}>
              {loading ? <IonSpinner name="dots" /> : '增量同步 (Push + Pull)'}
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={handleIncrementalPush} disabled={loading}>
              增量 Push
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={handleIncrementalPull} disabled={loading}>
              增量 Pull
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>

      {/* 强制全量同步 */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>强制全量同步（数据恢复）</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <div className="button-group">
            <IonButton expand="block" color="warning" onClick={handleForceFullSync} disabled={loading}>
              强制全量同步 (Push + Pull)
            </IonButton>
            <IonButton expand="block" fill="outline" color="warning" onClick={handleForceFullPush} disabled={loading}>
              强制全量 Push ⚠️
            </IonButton>
            <IonButton expand="block" fill="outline" color="warning" onClick={handleForceFullPull} disabled={loading}>
              强制全量 Pull ⚠️
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>

      {/* 高级操作 */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>高级操作</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <div className="button-group">
            <IonButton expand="block" fill="outline" onClick={handleResetSyncState} disabled={loading}>
              重置同步状态
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={handleCleanupLogs} disabled={loading}>
              清理操作日志
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>

      {/* 同步结果 */}
      {lastResult && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>最近同步结果</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="sync-result">
              <div className="result-item">
                <span className="result-label">状态:</span>
                <span className={`result-value ${lastResult.status}`}>
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
          </IonCardContent>
        </IonCard>
      )}
    </div>
  );
};
