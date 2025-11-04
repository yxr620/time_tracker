import Dexie, { type Table } from 'dexie';

export interface TimeEntry {
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

export interface Goal {
  id?: string;
  name: string;
  date: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  createdAt: Date;
}

export interface SyncMetadata {
  key: string;
  value: string | number | Date;
  updatedAt: Date;
}

export class TimeTrackerDB extends Dexie {
  entries!: Table<TimeEntry, string>;
  goals!: Table<Goal, string>;
  categories!: Table<Category, string>;
  syncMetadata!: Table<SyncMetadata, string>;

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
      // 初始化预设类别
      const categories: Category[] = [
        { id: 'study', name: '学习', color: '#1677ff', order: 1, createdAt: new Date() },
        { id: 'work', name: '工作', color: '#52c41a', order: 2, createdAt: new Date() },
        { id: 'exercise', name: '运动', color: '#fa8c16', order: 3, createdAt: new Date() },
        { id: 'entertainment', name: '娱乐', color: '#eb2f96', order: 4, createdAt: new Date() },
        { id: 'daily', name: '日常', color: '#13c2c2', order: 5, createdAt: new Date() },
        { id: 'rest', name: '休息', color: '#722ed1', order: 6, createdAt: new Date() }
      ];
      
      await tx.table('categories').bulkAdd(categories);
    });
  }
}

export const db = new TimeTrackerDB();
