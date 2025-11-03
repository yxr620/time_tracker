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
  targetMinutes?: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TimeTrackerDB extends Dexie {
  entries!: Table<TimeEntry, string>;
  goals!: Table<Goal, string>;

  constructor() {
    super('TimeTrackerDB');
    this.version(1).stores({
      entries: 'id, startTime, endTime, activity, goalId, createdAt',
      goals: 'id, name, date, createdAt'
    });
  }
}

export const db = new TimeTrackerDB();
