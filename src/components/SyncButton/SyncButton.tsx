/**
 * SyncButton Component
 * 同步按钮，显示同步状态和触发同步
 */

import { useEffect } from 'react';
import { Button, Toast } from 'antd-mobile';
import { useSyncStore } from '../../stores/syncStore';
import { UploadOutline, CheckCircleOutline, CloseCircleOutline } from 'antd-mobile-icons';

export const SyncButton: React.FC = () => {
  const { status, message, lastSyncTime, pushedCount, pulledCount, isConfigured, sync } = useSyncStore();

  useEffect(() => {
    // 如果有成功或错误消息，显示 Toast
    if (status === 'success' && message) {
      Toast.show({
        icon: <CheckCircleOutline />,
        content: `${message} (↑${pushedCount} ↓${pulledCount})`,
        duration: 2000
      });
    } else if (status === 'error' && message) {
      Toast.show({
        icon: <CloseCircleOutline />,
        content: message,
        duration: 3000
      });
    }
  }, [status, message, pushedCount, pulledCount]);

  const handleSync = async () => {
    if (status === 'syncing') return;
    await sync();
  };

  if (!isConfigured) {
    return null; // OSS 未配置时不显示按钮
  }

  const getIcon = () => {
    if (status === 'syncing') return null; // Loading 状态由 Button 的 loading 属性处理
    
    switch (status) {
      case 'success':
        return <CheckCircleOutline />;
      case 'error':
        return <CloseCircleOutline />;
      default:
        return <UploadOutline />;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return '未同步';
    
    const now = Date.now();
    const diff = now - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div className="sync-button-container">
      <Button
        color={getColor()}
        fill="outline"
        size="small"
        loading={status === 'syncing'}
        onClick={handleSync}
        disabled={status === 'syncing'}
      >
        {getIcon()}
        <span style={{ marginLeft: '4px' }}>
          {status === 'syncing' ? '同步中' : '同步'}
        </span>
      </Button>
      
      {lastSyncTime && (
        <div className="sync-time-info" style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
          最后同步: {formatLastSyncTime()}
        </div>
      )}
    </div>
  );
};
