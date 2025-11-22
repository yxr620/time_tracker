import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type TimeEntry } from '../services/db';
import { syncDb } from '../services/syncDb';

interface EntryStore {
  entries: TimeEntry[];
  currentEntry: TimeEntry | null;
  nextStartTime: Date | null;
  nextEndTime: Date | null;
  
  // 操作方法
  loadEntries: (date?: string) => Promise<void>;
  startTracking: (activity: string, goalId?: string, startTime?: Date, categoryId?: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  addEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setNextStartTime: (time: Date | null) => void;
  setTimeRange: (startTime: Date, endTime: Date) => void;
  getLastEntryEndTime: () => Date | null;
}

export const useEntryStore = create<EntryStore>((set, get) => ({
  entries: [],
  currentEntry: null,
  nextStartTime: null,
  nextEndTime: null,

  loadEntries: async (_date?: string) => {
    const allEntries = await db.entries
      .orderBy('startTime')
      .reverse()
      .toArray();
    
    // 过滤掉软删除的记录
    const entries = allEntries.filter(e => !e.deleted);
    
    // 找出进行中的记录
    const current = entries.find(e => e.endTime === null);
    
    set({ entries, currentEntry: current || null });
  },

  startTracking: async (activity: string, goalId?: string, startTime?: Date, categoryId?: string) => {
    const entry: TimeEntry = {
      id: uuidv4(),
      startTime: startTime || new Date(),
      endTime: null,
      activity,
      categoryId: categoryId || null,
      goalId: goalId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await syncDb.entries.add(entry);
    set({ currentEntry: entry });
    await get().loadEntries();
  },

  stopTracking: async () => {
    const { currentEntry } = get();
    if (!currentEntry?.id) return;

    const endTime = new Date();
    await syncDb.entries.update(currentEntry.id, {
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

    await syncDb.entries.add(newEntry);
    await get().loadEntries();
  },

  updateEntry: async (id, updates) => {
    await syncDb.entries.update(id, {
      ...updates,
      updatedAt: new Date()
    });
    await get().loadEntries();
  },

  deleteEntry: async (id) => {
    await syncDb.entries.delete(id);
    await get().loadEntries();
  },

  setNextStartTime: (time) => {
    set({ nextStartTime: time });
  },

  setTimeRange: (startTime, endTime) => {
    set({ nextStartTime: startTime, nextEndTime: endTime });
  },

  getLastEntryEndTime: () => {
    const { entries } = get();
    // 找到最近的已完成记录（有结束时间的）
    const completedEntries = entries.filter(e => e.endTime !== null);
    if (completedEntries.length === 0) return null;
    
    // 按结束时间排序，取最新的
    const sortedByEndTime = completedEntries.sort((a, b) => 
      new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
    );
    
    return sortedByEndTime[0].endTime;
  }
}));
