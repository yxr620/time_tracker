/**
 * Sync Engine
 * 核心同步逻辑：Push（推送）、Pull（拉取）、Merge（合并）
 */

import { db, type SyncOperation, type TimeEntry, type Goal, type Category, getDeviceId } from './db';
import { uploadSyncFile, listSyncFiles, downloadSyncFile, extractTimestamp, isOSSConfigured } from './oss';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncResult {
  status: SyncStatus;
  message: string;
  pushedCount?: number;
  pulledCount?: number;
  error?: Error;
}

export interface SyncStats {
  pendingOps: number;
  syncedOps: number;
  lastSyncTime: Date | null;
  lastProcessedTimestamp: number | null;
  deviceId: string;
}

/**
 * 同步引擎类
 */
export class SyncEngine {
  private isSyncing = false;
  private lastSyncTime = 0;

  /**
   * 执行完整的同步流程
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] 开始同步...');
      
      // 1. Push：上传本地未同步的操作
      const pushedCount = await this.push();
      console.log(`[Sync] Push 完成，上传 ${pushedCount} 条操作`);
      
      // 2. Pull：拉取并合并远程操作
      const pulledCount = await this.pull();
      console.log(`[Sync] Pull 完成，拉取 ${pulledCount} 条操作`);
      
      this.lastSyncTime = Date.now();
      
      return {
        status: 'success',
        message: '同步成功',
        pushedCount,
        pulledCount
      };
    } catch (error) {
      console.error('[Sync] 同步失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '同步失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push：上传本地未同步的操作（公开方法，可用于自动同步）
   */
  async push(): Promise<number> {
    // 查询未同步的操作 - 使用 filter 而不是 where().equals()
    const allOperations = await db.syncOperations.toArray();
    const operations = allOperations.filter(op => !op.synced);

    if (operations.length === 0) {
      console.log('[Sync] 没有需要上传的操作');
      return 0;
    }

    // 上传到 OSS
    await uploadSyncFile(operations);

    // 标记为已同步
    const operationIds = operations.map(op => op.id);
    await Promise.all(
      operationIds.map(id => db.syncOperations.update(id, { synced: true }))
    );

    return operations.length;
  }

  /**
   * Pull：拉取远程操作并合并（公开方法，可用于自动同步）
   */
  async pull(): Promise<number> {
    // 获取上次处理的文件时间戳
    const lastProcessed = await db.syncMetadata.get('lastProcessedTimestamp');
    const afterTimestamp = lastProcessed ? (lastProcessed.value as number) : 0;

    // 列出远程文件
    const files = await listSyncFiles(afterTimestamp);

    if (files.length === 0) {
      console.log('[Sync] 没有需要拉取的文件');
      return 0;
    }

    let totalOperations = 0;

    // 按时间顺序处理每个文件
    for (const file of files) {
      const operations = await downloadSyncFile(file.name);
      
      // 合并操作
      for (const operation of operations) {
        await this.mergeOperation(operation);
        totalOperations++;
      }

      // 更新最后处理的时间戳
      const timestamp = extractTimestamp(file.name);
      await db.syncMetadata.put({
        key: 'lastProcessedTimestamp',
        value: timestamp,
        updatedAt: new Date()
      });
    }

    return totalOperations;
  }

  /**
   * 合并单个操作（Last-Write-Wins）
   */
  private async mergeOperation(operation: SyncOperation): Promise<void> {
    const { tableName, recordId, type, data } = operation;

    try {
      if (tableName === 'entries') {
        await this.mergeEntry(recordId, type, data);
      } else if (tableName === 'goals') {
        await this.mergeGoal(recordId, type, data);
      } else if (tableName === 'categories') {
        await this.mergeCategory(recordId, type, data);
      }
    } catch (error) {
      console.error(`[Sync] 合并操作失败:`, operation, error);
      // 继续处理其他操作，不中断同步
    }
  }

  /**
   * 合并 TimeEntry
   */
  private async mergeEntry(
    id: string,
    type: 'create' | 'update' | 'delete',
    remoteData: TimeEntry
  ): Promise<void> {
    const local = await db.entries.get(id);

    // 如果本地不存在，直接写入（除非是删除操作）
    if (!local) {
      if (type !== 'delete' && !remoteData.deleted) {
        await db.entries.put({
          ...remoteData,
          syncStatus: 'synced'
        });
      }
      return;
    }

    // Last-Write-Wins：比较 updatedAt
    const remoteTime = new Date(remoteData.updatedAt).getTime();
    const localTime = new Date(local.updatedAt).getTime();

    if (remoteTime > localTime) {
      // 远程更新，覆盖本地
      // 无论是删除还是更新，都使用 put 来保持数据一致性
      await db.entries.put({
        ...remoteData,
        syncStatus: 'synced'
      });
      if (remoteData.deleted) {
        console.log(`[Sync] Entry ${id} 已标记删除（远程删除）`);
      } else {
        console.log(`[Sync] Entry ${id} 已更新（远程更新）`);
      }
    } else {
      console.log(`[Sync] Entry ${id} 跳过（本地更新）`);
    }
  }

  /**
   * 合并 Goal
   */
  private async mergeGoal(
    id: string,
    type: 'create' | 'update' | 'delete',
    remoteData: Goal
  ): Promise<void> {
    const local = await db.goals.get(id);

    if (!local) {
      if (type !== 'delete' && !remoteData.deleted) {
        await db.goals.put({
          ...remoteData,
          syncStatus: 'synced'
        });
      }
      return;
    }

    const remoteTime = new Date(remoteData.updatedAt).getTime();
    const localTime = new Date(local.updatedAt).getTime();

    if (remoteTime > localTime) {
      await db.goals.put({
        ...remoteData,
        syncStatus: 'synced'
      });
      if (remoteData.deleted) {
        console.log(`[Sync] Goal ${id} 已标记删除（远程删除）`);
      } else {
        console.log(`[Sync] Goal ${id} 已更新（远程更新）`);
      }
    } else {
      console.log(`[Sync] Goal ${id} 跳过（本地更新）`);
    }
  }

  /**
   * 合并 Category
   */
  private async mergeCategory(
    id: string,
    type: 'create' | 'update' | 'delete',
    remoteData: Category
  ): Promise<void> {
    const local = await db.categories.get(id);

    if (!local) {
      if (type !== 'delete' && !remoteData.deleted) {
        await db.categories.put({
          ...remoteData,
          syncStatus: 'synced'
        });
      }
      return;
    }

    const remoteTime = new Date(remoteData.updatedAt).getTime();
    const localTime = new Date(local.updatedAt).getTime();

    if (remoteTime > localTime) {
      await db.categories.put({
        ...remoteData,
        syncStatus: 'synced'
      });
      if (remoteData.deleted) {
        console.log(`[Sync] Category ${id} 已标记删除（远程删除）`);
      } else {
        console.log(`[Sync] Category ${id} 已更新（远程更新）`);
      }
    } else {
      console.log(`[Sync] Category ${id} 跳过（本地更新）`);
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): { isSyncing: boolean; lastSyncTime: number } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * 强制全量 Push
   * 忽略 synced 状态，上传所有当前数据
   */
  async forceFullPush(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] 开始强制全量 Push...');
      
      const deviceId = await getDeviceId();
      
      // 获取所有非删除的数据
      const entries = await db.entries.filter(e => !e.deleted).toArray();
      const goals = await db.goals.filter(g => !g.deleted).toArray();
      const categories = await db.categories.filter(c => !c.deleted).toArray();
      
      // 创建操作日志
      const operations: SyncOperation[] = [];
      
      for (const entry of entries) {
        operations.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          deviceId,
          tableName: 'entries',
          recordId: entry.id!,
          type: 'create',
          data: entry,
          synced: false
        });
      }
      
      for (const goal of goals) {
        operations.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          deviceId,
          tableName: 'goals',
          recordId: goal.id!,
          type: 'create',
          data: goal,
          synced: false
        });
      }
      
      for (const category of categories) {
        operations.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          deviceId,
          tableName: 'categories',
          recordId: category.id,
          type: 'create',
          data: category,
          synced: false
        });
      }
      
      // 直接上传（不写入 syncOperations 表）
      if (operations.length > 0) {
        await uploadSyncFile(operations);
      }
      
      console.log(`[Sync] 强制全量 Push 完成，上传 ${operations.length} 条记录`);
      
      return {
        status: 'success',
        message: '强制全量 Push 完成',
        pushedCount: operations.length,
        pulledCount: 0
      };
    } catch (error) {
      console.error('[Sync] 强制全量 Push 失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '强制全量 Push 失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 强制全量 Pull
   * 忽略 lastProcessedTimestamp，拉取所有远程文件
   */
  async forceFullPull(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] 开始强制全量 Pull...');
      
      // 列出所有远程文件（afterTimestamp = 0）
      const files = await listSyncFiles(0);

      if (files.length === 0) {
        console.log('[Sync] OSS 上没有文件');
        return {
          status: 'success',
          message: 'OSS 上没有文件',
          pushedCount: 0,
          pulledCount: 0
        };
      }

      let totalOperations = 0;

      // 按时间顺序处理每个文件
      for (const file of files) {
        const operations = await downloadSyncFile(file.name);
        
        for (const operation of operations) {
          await this.mergeOperation(operation);
          totalOperations++;
        }
      }

      // 更新 lastProcessedTimestamp
      if (files.length > 0) {
        const lastFile = files[files.length - 1];
        const timestamp = extractTimestamp(lastFile.name);
        await db.syncMetadata.put({
          key: 'lastProcessedTimestamp',
          value: timestamp,
          updatedAt: new Date()
        });
      }

      console.log(`[Sync] 强制全量 Pull 完成，拉取 ${totalOperations} 条操作`);

      return {
        status: 'success',
        message: '强制全量 Pull 完成',
        pushedCount: 0,
        pulledCount: totalOperations
      };
    } catch (error) {
      console.error('[Sync] 强制全量 Pull 失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '强制全量 Pull 失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 强制全量同步（Push + Pull）
   */
  async forceFullSync(): Promise<SyncResult> {
    const pushResult = await this.forceFullPush();
    if (pushResult.status === 'error') {
      return pushResult;
    }

    const pullResult = await this.forceFullPull();
    if (pullResult.status === 'error') {
      return pullResult;
    }

    return {
      status: 'success',
      message: '强制全量同步完成',
      pushedCount: pushResult.pushedCount,
      pulledCount: pullResult.pulledCount
    };
  }

  /**
   * 增量 Push
   */
  async incrementalPush(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      const pushedCount = await this.push();
      return {
        status: 'success',
        message: '增量 Push 完成',
        pushedCount,
        pulledCount: 0
      };
    } catch (error) {
      console.error('[Sync] 增量 Push 失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '增量 Push 失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 增量 Pull
   */
  async incrementalPull(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      const pulledCount = await this.pull();
      return {
        status: 'success',
        message: '增量 Pull 完成',
        pushedCount: 0,
        pulledCount
      };
    } catch (error) {
      console.error('[Sync] 增量 Pull 失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '增量 Pull 失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 增量同步（Push + Pull）
   */
  async incrementalSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: 'error',
        message: '正在同步中，请稍候'
      };
    }

    if (!isOSSConfigured()) {
      return {
        status: 'error',
        message: 'OSS 未配置，无法同步'
      };
    }

    this.isSyncing = true;

    try {
      const pushedCount = await this.push();
      const pulledCount = await this.pull();
      return {
        status: 'success',
        message: '增量同步完成',
        pushedCount,
        pulledCount
      };
    } catch (error) {
      console.error('[Sync] 增量同步失败:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '增量同步失败',
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStats(): Promise<SyncStats> {
    const pendingOps = await db.syncOperations.filter(op => !op.synced).count();
    const syncedOps = await db.syncOperations.filter(op => op.synced).count();
    
    const lastSync = await db.syncMetadata.get('lastSyncTime');
    const lastProcessed = await db.syncMetadata.get('lastProcessedTimestamp');
    const deviceId = await getDeviceId();
    
    return {
      pendingOps,
      syncedOps,
      lastSyncTime: lastSync?.value as Date | null,
      lastProcessedTimestamp: lastProcessed?.value as number | null,
      deviceId
    };
  }

  /**
   * 重置同步状态
   */
  async resetSyncState(): Promise<void> {
    await db.syncMetadata.delete('lastProcessedTimestamp');
    console.log('[Sync] 同步状态已重置');
  }

  /**
   * 清理已同步的操作日志
   */
  async cleanupSyncedOperations(daysAgo = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    
    const toDelete = await db.syncOperations
      .filter(op => op.synced && op.timestamp < cutoffDate)
      .toArray();
    
    await Promise.all(
      toDelete.map(op => db.syncOperations.delete(op.id))
    );
    
    console.log(`[Sync] 清理了 ${toDelete.length} 条已同步的操作日志`);
    return toDelete.length;
  }
}

// 导出单例
export const syncEngine = new SyncEngine();

/**
 * 自动同步（可选）
 * 在应用启动时调用，或定期调用
 */
export function startAutoSync(intervalMinutes = 10): () => void {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // 立即执行一次
  syncEngine.sync().catch(err => {
    console.error('[AutoSync] 自动同步失败:', err);
  });

  // 定期执行
  const timer = setInterval(() => {
    syncEngine.sync().catch(err => {
      console.error('[AutoSync] 自动同步失败:', err);
    });
  }, intervalMs);

  // 返回清理函数
  return () => clearInterval(timer);
}
