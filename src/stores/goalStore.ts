import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, type Goal } from '../services/db';
import { syncDb } from '../services/syncDb';
import { syncEngine } from '../services/syncEngine';
import { isOSSConfigured } from '../services/oss';

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

    // 方案 1：添加目标后自动 Push
    if (isOSSConfigured()) {
      syncEngine.push()
        .then(pushedCount => {
          if (pushedCount > 0) {
            console.log(`[AutoSync] 添加目标后自动 Push，上传 ${pushedCount} 条操作`);
          }
        })
        .catch(error => {
          console.error('[AutoSync] 添加目标后 Push 失败:', error);
        });
    }
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

    // 方案 1：删除目标后自动 Push
    if (isOSSConfigured()) {
      syncEngine.push()
        .then(pushedCount => {
          if (pushedCount > 0) {
            console.log(`[AutoSync] 删除目标后自动 Push，上传 ${pushedCount} 条操作`);
          }
        })
        .catch(error => {
          console.error('[AutoSync] 删除目标后 Push 失败:', error);
        });
    }
  },

  getGoalsByDate: (date: string) => {
    return get().goals.filter(g => g.date === date);
  }
}));
