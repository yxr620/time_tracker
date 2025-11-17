import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type TimeEntry } from '../services/db';

interface EntryStore {
  entries: TimeEntry[];
  currentEntry: TimeEntry | null;
  nextStartTime: Date | null;
  
  // 操作方法
  loadEntries: (date?: string) => Promise<void>;
  startTracking: (activity: string, goalId?: string, startTime?: Date, categoryId?: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  addEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setNextStartTime: (time: Date | null) => void;
}

export const useEntryStore = create<EntryStore>((set, get) => ({
  entries: [],
  currentEntry: null,
  nextStartTime: null,

  loadEntries: async (_date?: string) => {
    const entries = await db.entries
      .orderBy('startTime')
      .reverse()
      .toArray();
    
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

    await db.entries.add(entry);
    set({ currentEntry: entry });
    await get().loadEntries();
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
  },

  setNextStartTime: (time) => {
    set({ nextStartTime: time });
  }
}));
