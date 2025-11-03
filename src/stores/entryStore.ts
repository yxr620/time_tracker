import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type TimeEntry } from '../services/db';

interface EntryStore {
  entries: TimeEntry[];
  currentEntry: TimeEntry | null;
  
  // 操作方法
  loadEntries: (date?: string) => Promise<void>;
  startTracking: (activity: string, goalId?: string, startTime?: Date) => Promise<void>;
  stopTracking: () => Promise<void>;
  addEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getLastEndTime: () => Date | null;
}

export const useEntryStore = create<EntryStore>((set, get) => ({
  entries: [],
  currentEntry: null,

  loadEntries: async (_date?: string) => {
    const entries = await db.entries
      .orderBy('startTime')
      .reverse()
      .toArray();
    
    // 找出进行中的记录
    const current = entries.find(e => e.endTime === null);
    
    set({ entries, currentEntry: current || null });
  },

  startTracking: async (activity: string, goalId?: string, startTime?: Date) => {
    const entry: TimeEntry = {
      id: uuidv4(),
      startTime: startTime || new Date(),
      endTime: null,
      activity,
      goalId: goalId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.entries.add(entry);
    set({ currentEntry: entry });
    await get().loadEntries();
  },

  getLastEndTime: () => {
    const { entries } = get();
    // 找到最近完成的任务（有结束时间的）
    const completedEntries = entries.filter(e => e.endTime !== null);
    if (completedEntries.length === 0) return null;
    
    // 按结束时间排序，取最近的
    const lastEntry = completedEntries.sort((a, b) => 
      (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0)
    )[0];
    
    return lastEntry.endTime;
  },

  stopTracking: async () => {
    const { currentEntry } = get();
    if (!currentEntry?.id) return;

    const endTime = new Date();
    await db.entries.update(currentEntry.id, {
      endTime,
      updatedAt: new Date()
    });

    set({ currentEntry: null });
    await get().loadEntries();
  },

  addEntry: async (entry) => {
    const newEntry: TimeEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.entries.add(newEntry);
    await get().loadEntries();
  },

  updateEntry: async (id, updates) => {
    await db.entries.update(id, {
      ...updates,
      updatedAt: new Date()
    });
    await get().loadEntries();
  },

  deleteEntry: async (id) => {
    await db.entries.delete(id);
    await get().loadEntries();
  }
}));
