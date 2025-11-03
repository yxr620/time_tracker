import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type Goal } from '../services/db';

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
    const goals = await db.goals.toArray();
    set({ goals });
  },

  addGoal: async (goal) => {
    const newGoal: Goal = {
      ...goal,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.goals.add(newGoal);
    await get().loadGoals();
  },

  updateGoal: async (id, updates) => {
    await db.goals.update(id, {
      ...updates,
      updatedAt: new Date()
    });
    await get().loadGoals();
  },

  deleteGoal: async (id) => {
    await db.goals.delete(id);
    await get().loadGoals();
  },

  getGoalsByDate: (date: string) => {
    return get().goals.filter(g => g.date === date);
  }
}));
