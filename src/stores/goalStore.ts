import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type Goal } from '../services/db';
import { syncDb } from '../services/syncDb';
import { autoPush } from '../utils/autoPush';

interface GoalStore {
  goals: Goal[];
  
  loadGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getGoalsByDate: (date: string) => Goal[];
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],

  loadGoals: async () => {
    const allGoals = await db.goals.toArray();
    // 过滤掉软删除的记录
    const goals = allGoals.filter(g => !g.deleted);
    set({ goals });
  },

  addGoal: async (goal) => {
    const newGoal: Goal = {
      ...goal,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await syncDb.goals.add(newGoal);
    await get().loadGoals();
    autoPush('添加目标后');
  },

  updateGoal: async (id, updates) => {
    await syncDb.goals.update(id, {
      ...updates,
      updatedAt: new Date()
    });
    await get().loadGoals();
  },

  deleteGoal: async (id) => {
    await syncDb.goals.delete(id);
    await get().loadGoals();
    autoPush('删除目标后');
  },

  getGoalsByDate: (date: string) => {
    return get().goals.filter(g => g.date === date);
  }
}));
