/**
 * Sync Engine
 * 核心同步逻辑：Push（推送）、Pull（拉取）、Merge（合并）
 */

import { db, type SyncOperation, getDeviceId } from './db';
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
      
      // 3. 清理过期的已同步操作日志
      await this.cleanupSyncedOperations();

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
      const tableMap = {
        entries: db.entries,
        goals: db.goals,
        categories: db.categories,
      } as const;

      const table = tableMap[tableName as keyof typeof tableMap];
      if (table) {
        await this.mergeRecord(table, tableName, recordId, type, data);
      }
    } catch (error) {
      console.error(`[Sync] 合并操作失败:`, operation, error);
    }
  }

  /**
   * 通用合并记录（Last-Write-Wins），替代原来的 mergeEntry/mergeGoal/mergeCategory
   */
  private async mergeRecord(
    table: typeof db.entries | typeof db.goals | typeof db.categories,
    tableName: string,
    id: string,
    type: 'create' | 'update' | 'delete',
    remoteData: any
  ): Promise<void> {
    const local = await (table as any).get(id);

    if (!local) {
      if (type !== 'delete' && !remoteData.deleted) {
        await (table as any).put({ ...remoteData, syncStatus: 'synced' });
      }
      return;
    }

    const remoteTime = new Date(remoteData.updatedAt).getTime();
    const localTime = new Date(local.updatedAt).getTime();

    if (remoteTime > localTime) {
      await (table as any).put({ ...remoteData, syncStatus: 'synced' });
      const action = remoteData.deleted ? '已标记删除（远程删除）' : '已更新（远程更新）';
      console.log(`[Sync] ${tableName} ${id} ${action}`);
    } else {
      console.log(`[Sync] ${tableName} ${id} 跳过（本地更新）`);
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
   * 同步操作守卫：统一处理 isSyncing/isOSSConfigured 检查和 try/catch/finally
   */
  private async withSyncGuard(
    operationName: string,
    fn: () => Promise<Omit<SyncResult, 'status' | 'error'>>
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return { status: 'error', message: '正在同步中，请稍候' };
    }
    if (!isOSSConfigured()) {
      return { status: 'error', message: 'OSS 未配置，无法同步' };
    }
    this.isSyncing = true;
    try {
      console.log(`[Sync] 开始${operationName}...`);
      const partial = await fn();
      console.log(`[Sync] ${operationName}完成`);
      return { status: 'success', ...partial };
    } catch (error) {
      console.error(`[Sync] ${operationName}失败:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : `${operationName}失败`,
        error: error as Error
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 强制全量 Push
   */
  async forceFullPush(): Promise<SyncResult> {
    return this.withSyncGuard('强制全量 Push', async () => {
      const deviceId = await getDeviceId();

      const entries = await db.entries.filter(e => !e.deleted).toArray();
      const goals = await db.goals.filter(g => !g.deleted).toArray();
      const categories = await db.categories.filter(c => !c.deleted).toArray();

      const operations: SyncOperation[] = [
        ...entries.map(entry => this.createSyncOp(deviceId, 'entries', entry.id!, entry)),
        ...goals.map(goal => this.createSyncOp(deviceId, 'goals', goal.id!, goal)),
        ...categories.map(cat => this.createSyncOp(deviceId, 'categories', cat.id, cat)),
      ];

      if (operations.length > 0) {
        await uploadSyncFile(operations);
      }

      return { message: '强制全量 Push 完成', pushedCount: operations.length, pulledCount: 0 };
    });
  }

  /**
   * 强制全量 Pull
   */
  async forceFullPull(): Promise<SyncResult> {
    return this.withSyncGuard('强制全量 Pull', async () => {
      const files = await listSyncFiles(0);

      if (files.length === 0) {
        return { message: 'OSS 上没有文件', pushedCount: 0, pulledCount: 0 };
      }

      let totalOperations = 0;
      for (const file of files) {
        const operations = await downloadSyncFile(file.name);
        for (const operation of operations) {
          await this.mergeOperation(operation);
          totalOperations++;
        }
      }

      if (files.length > 0) {
        const lastFile = files[files.length - 1];
        const timestamp = extractTimestamp(lastFile.name);
        await db.syncMetadata.put({
          key: 'lastProcessedTimestamp',
          value: timestamp,
          updatedAt: new Date()
        });
      }

      return { message: '强制全量 Pull 完成', pushedCount: 0, pulledCount: totalOperations };
    });
  }

  /**
   * 强制全量同步（Push + Pull）
   */
  async forceFullSync(): Promise<SyncResult> {
    const pushResult = await this.forceFullPush();
    if (pushResult.status === 'error') return pushResult;

    const pullResult = await this.forceFullPull();
    if (pullResult.status === 'error') return pullResult;

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
    return this.withSyncGuard('增量 Push', async () => {
      const pushedCount = await this.push();
      return { message: '增量 Push 完成', pushedCount, pulledCount: 0 };
    });
  }

  /**
   * 增量 Pull
   */
  async incrementalPull(): Promise<SyncResult> {
    return this.withSyncGuard('增量 Pull', async () => {
      const pulledCount = await this.pull();
      return { message: '增量 Pull 完成', pushedCount: 0, pulledCount };
    });
  }

  /**
   * 增量同步（Push + Pull）
   */
  async incrementalSync(): Promise<SyncResult> {
    return this.withSyncGuard('增量同步', async () => {
      const pushedCount = await this.push();
      const pulledCount = await this.pull();
      return { message: '增量同步完成', pushedCount, pulledCount };
    });
  }

  /** 创建同步操作记录的辅助方法 */
  private createSyncOp(deviceId: string, tableName: 'entries' | 'goals' | 'categories', recordId: string, data: any): SyncOperation {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      deviceId,
      tableName,
      recordId,
      type: 'create',
      data,
      synced: false
    };
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
