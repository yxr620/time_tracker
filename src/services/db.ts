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
      // 初始化预设类别（按色系分组）
      const categories: Category[] = [
        // 蓝绿色系：学习、工作
        { id: 'study', name: '学习', color: '#1677ff', order: 1, createdAt: new Date() },
        { id: 'work', name: '工作', color: '#13c2c2', order: 2, createdAt: new Date() },
        // 橙黄色系：日常、运动
        { id: 'daily', name: '日常', color: '#faad14', order: 3, createdAt: new Date() },
        { id: 'exercise', name: '运动', color: '#fa8c16', order: 4, createdAt: new Date() },
        // 紫红色系：休息、娱乐
        { id: 'rest', name: '休息', color: '#722ed1', order: 5, createdAt: new Date() },
        { id: 'entertainment', name: '娱乐', color: '#eb2f96', order: 6, createdAt: new Date() }
      ];
      
      await tx.table('categories').bulkAdd(categories);
    });

    // 更新类别颜色（色系分组优化）
    this.version(4).stores({
      entries: 'id, startTime, endTime, activity, categoryId, goalId, createdAt',
      goals: 'id, name, date, createdAt',
      categories: 'id, name, order',
      syncMetadata: 'key, updatedAt'
    }).upgrade(async tx => {
      // 更新现有类别的颜色
      const colorUpdates = [
        { id: 'study', color: '#1677ff' },      // 蓝色（学习）
        { id: 'work', color: '#13c2c2' },       // 青色（工作）- 蓝绿色系
        { id: 'daily', color: '#faad14' },      // 金黄色（日常）
        { id: 'exercise', color: '#fa8c16' },   // 橙色（运动）- 橙黄色系
        { id: 'rest', color: '#722ed1' },       // 紫色（休息）
        { id: 'entertainment', color: '#eb2f96' } // 洋红色（娱乐）- 紫红色系
      ];

      for (const update of colorUpdates) {
        await tx.table('categories').update(update.id, { color: update.color });
      }
    });
  }
}

export const db = new TimeTrackerDB();
