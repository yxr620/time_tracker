import { create } from 'zustand';
import { db, type Category } from '../services/db';
import { getCategoryColor, getCategoryName as getConfigCategoryName } from '../config/categoryColors';

interface CategoryStore {
  categories: Category[];
  
  // 操作方法
  loadCategories: () => Promise<void>;
  getCategoryById: (id: string | null) => Category | null;
  getCategoryName: (id: string | null) => string | null;
  getCategoryColor: (id: string | null) => string;
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
    // 优先从配置文件读取名称
    return getConfigCategoryName(id);
  },

  getCategoryColor: (id: string | null) => {
    // 从配置文件读取颜色
    return getCategoryColor(id);
  }
}));
