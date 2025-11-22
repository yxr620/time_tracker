/**
 * Sync-aware database operations
 * 封装数据库操作，自动记录同步日志
 */

import { db, getDeviceId, logSyncOperation, updateSyncMetadata, type TimeEntry, type Goal, type Category } from './db';

export const syncDb = {
  entries: {
    async add(entry: TimeEntry): Promise<string> {
      const deviceId = await getDeviceId();
      const entryWithSync = updateSyncMetadata(entry, deviceId);
      
      const id = await db.entries.add(entryWithSync);
      await logSyncOperation('entries', id as string, 'create', entryWithSync);
      
      return id as string;
    },

    async update(id: string, updates: Partial<TimeEntry>): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.entries.get(id);
      
      if (!existing) {
        throw new Error(`Entry ${id} not found`);
      }

      const updatesWithSync = updateSyncMetadata(
        { ...existing, ...updates },
        deviceId
      );
      
      await db.entries.update(id, updatesWithSync);
      await logSyncOperation('entries', id, 'update', updatesWithSync);
    },

    async delete(id: string): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.entries.get(id);
      
      if (!existing) {
        return; // 已删除，忽略
      }

      // 软删除：标记为已删除而不是真正删除
      const deletedEntry = updateSyncMetadata(
        { ...existing, deleted: true },
        deviceId
      );
      
      await db.entries.update(id, deletedEntry);
      await logSyncOperation('entries', id, 'delete', deletedEntry);
    }
  },

  goals: {
    async add(goal: Goal): Promise<string> {
      const deviceId = await getDeviceId();
      const goalWithSync = updateSyncMetadata(goal, deviceId);
      
      const id = await db.goals.add(goalWithSync);
      await logSyncOperation('goals', id as string, 'create', goalWithSync);
      
      return id as string;
    },

    async update(id: string, updates: Partial<Goal>): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.goals.get(id);
      
      if (!existing) {
        throw new Error(`Goal ${id} not found`);
      }

      const updatesWithSync = updateSyncMetadata(
        { ...existing, ...updates },
        deviceId
      );
      
      await db.goals.update(id, updatesWithSync);
      await logSyncOperation('goals', id, 'update', updatesWithSync);
    },

    async delete(id: string): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.goals.get(id);
      
      if (!existing) {
        return;
      }

      const deletedGoal = updateSyncMetadata(
        { ...existing, deleted: true },
        deviceId
      );
      
      await db.goals.update(id, deletedGoal);
      await logSyncOperation('goals', id, 'delete', deletedGoal);
    }
  },

  categories: {
    async add(category: Category): Promise<string> {
      const deviceId = await getDeviceId();
      const categoryWithSync = updateSyncMetadata(category, deviceId);
      
      await db.categories.add(categoryWithSync);
      await logSyncOperation('categories', category.id, 'create', categoryWithSync);
      
      return category.id;
    },

    async update(id: string, updates: Partial<Category>): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.categories.get(id);
      
      if (!existing) {
        throw new Error(`Category ${id} not found`);
      }

      const updatesWithSync = updateSyncMetadata(
        { ...existing, ...updates },
        deviceId
      );
      
      await db.categories.update(id, updatesWithSync);
      await logSyncOperation('categories', id, 'update', updatesWithSync);
    },

    async delete(id: string): Promise<void> {
      const deviceId = await getDeviceId();
      const existing = await db.categories.get(id);
      
      if (!existing) {
        return;
      }

      const deletedCategory = updateSyncMetadata(
        { ...existing, deleted: true },
        deviceId
      );
      
      await db.categories.update(id, deletedCategory);
      await logSyncOperation('categories', id, 'delete', deletedCategory);
    }
  }
};
