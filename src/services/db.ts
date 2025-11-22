import Dexie, { type Table } from 'dexie';

// === Sync-related interfaces ===
export interface Syncable {
  version?: number;                // 版本号，每次修改 +1
  deviceId?: string;               // 修改设备的 ID
  syncStatus?: 'synced' | 'pending'; // 同步状态
  deleted?: boolean;               // 软删除标记
}

export interface TimeEntry extends Syncable {
  id?: string;
  startTime: Date;
  endTime: Date | null;
  activity: string;
  categoryId: string | null;  // 活动类别（可选，兼容旧数据）
  goalId: string | null;
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Goal extends Syncable {
  id?: string;
  name: string;
  date: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category extends Syncable {
  id: string;
  name: string;
  // color 不再存储在数据库中，从配置文件读取
  icon?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncMetadata {
  key: string;
  value: string | number | Date;
  updatedAt: Date;
}

export interface SyncOperation {
  id: string;                      // UUID
  timestamp: Date;                 // 操作发生时间
  deviceId: string;                // 操作设备
  tableName: 'entries' | 'goals' | 'categories';
  recordId: string;                // 记录 ID
  type: 'create' | 'update' | 'delete';
  data: any;                       // 变更后的完整数据
  synced: boolean;                 // 是否已上传
}

export class TimeTrackerDB extends Dexie {
  entries!: Table<TimeEntry, string>;
  goals!: Table<Goal, string>;
  categories!: Table<Category, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  syncOperations!: Table<SyncOperation, string>;

  constructor() {
    super('TimeTrackerDB');
    this.version(1).stores({
      entries: 'id, startTime, endTime, activity, goalId, createdAt',
      goals: 'id, name, date, createdAt'
    });
    
    // 添加同步元数据表
    this.version(2).stores({
      entries: 'id, startTime, endTime, activity, goalId, createdAt',
      goals: 'id, name, date, createdAt',
      syncMetadata: 'key, updatedAt'
    });

    // 添加类别表和更新entries表
    this.version(3).stores({
      entries: 'id, startTime, endTime, activity, categoryId, goalId, createdAt',
      goals: 'id, name, date, createdAt',
      categories: 'id, name, order',
      syncMetadata: 'key, updatedAt'
    }).upgrade(async tx => {
      // 初始化预设类别（颜色从配置文件读取，不存储在数据库）
      const now = new Date();
      const categories: Category[] = [
        { id: 'study', name: '学习', order: 1, createdAt: now, updatedAt: now },
        { id: 'work', name: '工作', order: 2, createdAt: now, updatedAt: now },
        { id: 'daily', name: '日常', order: 3, createdAt: now, updatedAt: now },
        { id: 'exercise', name: '运动', order: 4, createdAt: now, updatedAt: now },
        { id: 'rest', name: '休息', order: 5, createdAt: now, updatedAt: now },
        { id: 'entertainment', name: '娱乐', order: 6, createdAt: now, updatedAt: now }
      ];
      
      await tx.table('categories').bulkAdd(categories);
    });

    // 添加同步支持（Version 4）
    this.version(4).stores({
      entries: 'id, startTime, endTime, activity, categoryId, goalId, createdAt',
      goals: 'id, name, date, createdAt',
      categories: 'id, name, order',
      syncMetadata: 'key, updatedAt',
      syncOperations: 'id, timestamp, deviceId, tableName, synced'
    }).upgrade(async tx => {
      // 为现有数据添加默认值（向后兼容）
      const entries = await tx.table('entries').toArray();
      for (const entry of entries) {
        if (!entry.version) {
          await tx.table('entries').update(entry.id!, {
            version: 1,
            syncStatus: 'synced'
          });
        }
      }

      const goals = await tx.table('goals').toArray();
      for (const goal of goals) {
        if (!goal.version) {
          await tx.table('goals').update(goal.id!, {
            version: 1,
            syncStatus: 'synced'
          });
        }
      }

      const categories = await tx.table('categories').toArray();
      for (const category of categories) {
        if (!category.version) {
          await tx.table('categories').update(category.id, {
            version: 1,
            syncStatus: 'synced',
            updatedAt: new Date()
          });
        }
      }

      // 初始化 deviceId
      const existingDeviceId = await tx.table('syncMetadata').get('deviceId');
      if (!existingDeviceId) {
        await tx.table('syncMetadata').add({
          key: 'deviceId',
          value: crypto.randomUUID(),
          updatedAt: new Date()
        });
      }
    });
  }
}

export const db = new TimeTrackerDB();

// === Sync helper functions ===

/**
 * 获取当前设备 ID
 */
export async function getDeviceId(): Promise<string> {
  const metadata = await db.syncMetadata.get('deviceId');
  if (metadata) {
    return metadata.value as string;
  }
  
  // 如果没有设备 ID，创建一个新的
  const deviceId = crypto.randomUUID();
  await db.syncMetadata.add({
    key: 'deviceId',
    value: deviceId,
    updatedAt: new Date()
  });
  return deviceId;
}

/**
 * 记录同步操作
 */
export async function logSyncOperation(
  tableName: 'entries' | 'goals' | 'categories',
  recordId: string,
  type: 'create' | 'update' | 'delete',
  data: any
): Promise<void> {
  const deviceId = await getDeviceId();
  
  const operation: SyncOperation = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    deviceId,
    tableName,
    recordId,
    type,
    data,
    synced: false
  };
  
  await db.syncOperations.add(operation);
}

/**
 * 更新记录的同步元数据
 */
export function updateSyncMetadata(data: any, deviceId: string): any {
  return {
    ...data,
    version: (data.version || 0) + 1,
    deviceId,
    syncStatus: 'pending' as const,
    updatedAt: new Date()
  };
}
