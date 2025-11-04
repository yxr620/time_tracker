import { create } from 'zustand';
import { db, type Category } from '../services/db';

interface CategoryStore {
  categories: Category[];
  
  // 操作方法
  loadCategories: () => Promise<void>;
  getCategoryById: (id: string | null) => Category | null;
  getCategoryName: (id: string | null) => string | null;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],

  loadCategories: async () => {
    const categories = await db.categories
      .orderBy('order')
      .toArray();
    set({ categories });
  },

  getCategoryById: (id: string | null) => {
    if (!id) return null;
    return get().categories.find(c => c.id === id) || null;
  },

  getCategoryName: (id: string | null) => {
    const category = get().getCategoryById(id);
    return category?.name || null;
  }
}));
