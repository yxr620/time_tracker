/**
 * Sync Store
 * 管理同步状态，供 UI 使用
 */

import { create } from 'zustand';
import { syncEngine, type SyncStatus, type SyncResult, startAutoSync } from '../services/syncEngine';
import { isOSSConfigured } from '../services/oss';

interface SyncStore {
  status: SyncStatus;
  message: string;
  lastSyncTime: number | null;
  pushedCount: number;
  pulledCount: number;
  isConfigured: boolean;
  
  // 方法
  sync: () => Promise<void>;
  checkConfig: () => void;
  startAutoSync: (intervalMinutes?: number) => void;
  stopAutoSync: () => void;
}

let autoSyncCleanup: (() => void) | null = null;

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: 'idle',
  message: '',
  lastSyncTime: null,
  pushedCount: 0,
  pulledCount: 0,
  isConfigured: isOSSConfigured(),

  sync: async () => {
    try {
      set({ status: 'syncing', message: '正在同步...' });
      
      const result: SyncResult = await syncEngine.sync();
      
      set({
        status: result.status,
        message: result.message,
        lastSyncTime: result.status === 'success' ? Date.now() : get().lastSyncTime,
        pushedCount: result.pushedCount || 0,
        pulledCount: result.pulledCount || 0
      });

      // 2秒后重置状态
      if (result.status === 'success') {
        setTimeout(() => {
          set({ status: 'idle', message: '' });
        }, 2000);
      }
    } catch (error) {
      console.error('[SyncStore] 同步失败:', error);
      set({ 
        status: 'error', 
        message: error instanceof Error ? error.message : '同步失败' 
      });
    }
  },

  checkConfig: () => {
    try {
      set({ isConfigured: isOSSConfigured() });
    } catch (error) {
      console.error('[SyncStore] 检查配置失败:', error);
      set({ isConfigured: false });
    }
  },

  startAutoSync: (intervalMinutes = 10) => {
    if (autoSyncCleanup) {
      autoSyncCleanup();
    }
    autoSyncCleanup = startAutoSync(intervalMinutes);
  },

  stopAutoSync: () => {
    if (autoSyncCleanup) {
      autoSyncCleanup();
      autoSyncCleanup = null;
    }
  }
}));
