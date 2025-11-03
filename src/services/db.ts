import Dexie, { type Table } from 'dexie';

export interface TimeEntry {
  id?: string;
  startTime: Date;
  endTime: Date | null;
  activity: string;
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

export interface SyncMetadata {
  key: string;
  value: string | number | Date;
  updatedAt: Date;
}

export class TimeTrackerDB extends Dexie {
  entries!: Table<TimeEntry, string>;
  goals!: Table<Goal, string>;
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
  }
}

export const db = new TimeTrackerDB();
