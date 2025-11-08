// 类别颜色配置（硬编码，不存储在数据库中）
// 修改这里的颜色后，重新编译部署即可生效

export interface CategoryConfig {
  id: string;
  name: string;
  color: string;
  order: number;
}

export const CATEGORY_COLORS: Record<string, CategoryConfig> = {
  study: {
    id: 'study',
    name: '学习',
    color: '#1890FF', // 标准蓝
    order: 1
  },
  work: {
    id: 'work',
    name: '工作',
    color: '#40A9FF', // 浅蓝
    order: 2
  },
  daily: {
    id: 'daily',
    name: '日常',
    color: '#FFA940', // 亮橙
    order: 3
  },
  exercise: {
    id: 'exercise',
    name: '运动',
    color: '#FF7A45', // 深橙
    order: 4
  },
  rest: {
    id: 'rest',
    name: '休息',
    color: '#9254DE', // 标准紫
    order: 5
  },
  entertainment: {
    id: 'entertainment',
    name: '娱乐',
    color: '#B37FEB', // 浅紫
    order: 6
  }
};

// 获取类别颜色
export const getCategoryColor = (categoryId: string | null): string => {
  if (!categoryId) return '#d9d9d9'; // 默认灰色
  return CATEGORY_COLORS[categoryId]?.color || '#d9d9d9';
};

// 获取类别名称
export const getCategoryName = (categoryId: string | null): string | null => {
  if (!categoryId) return null;
  return CATEGORY_COLORS[categoryId]?.name || null;
};

// 获取所有类别配置（用于初始化）
export const getAllCategories = (): CategoryConfig[] => {
  return Object.values(CATEGORY_COLORS).sort((a, b) => a.order - b.order);
};
