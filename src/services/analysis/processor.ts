/**
 * 数据分析处理器
 * 负责数据加载、清洗、聚合等逻辑
 */
import { format, startOfDay, endOfDay, eachDayOfInterval, differenceInMinutes } from 'date-fns';
import { db } from '../db';
import type { TimeEntry, Goal, Category } from '../db';
import { CATEGORY_COLORS } from '../../config/categoryColors';
import type {
  ProcessedEntry,
  AnalysisMetrics,
  ChartDataPoint,
  TrendDataPoint,
  CategoryTrendDataPoint,
  DateRange,
  AnalysisFilters,
} from '../../types/analysis';

/** 默认时间范围：最近30天 */
export function getDefaultDateRange(): DateRange {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  return { start, end };
}

/** 加载原始数据 */
export async function loadRawData(filters: AnalysisFilters): Promise<{
  entries: TimeEntry[];
  goals: Goal[];
  categories: Category[];
}> {
  const { dateRange, goalIds, categoryIds } = filters;

  // 获取所有记录，然后在内存中过滤
  // 因为 startTime 在数据库中可能存储为字符串或 Date 对象
  let entries = await db.entries.toArray();

  // 转换日期范围为时间戳进行比较
  const startTs = dateRange.start.getTime();
  const endTs = dateRange.end.getTime();

  // 过滤时间范围和软删除
  entries = entries.filter(e => {
    if (e.deleted || !e.endTime) return false;
    const entryTs = new Date(e.startTime).getTime();
    return entryTs >= startTs && entryTs <= endTs;
  });

  // 按目标筛选
  if (goalIds && goalIds.length > 0) {
    entries = entries.filter(e => e.goalId && goalIds.includes(e.goalId));
  }

  // 按类别筛选
  if (categoryIds && categoryIds.length > 0) {
    entries = entries.filter(e => e.categoryId && categoryIds.includes(e.categoryId));
  }

  const goals = await db.goals.toArray();
  const categories = await db.categories.toArray();

  return { entries, goals, categories };
}

/** 处理原始数据，生成可分析的结构 */
export function processEntries(
  entries: TimeEntry[],
  goals: Goal[],
  categories: Category[]
): ProcessedEntry[] {
  const goalMap = new Map(goals.map(g => [g.id, g.name]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  return entries
    .filter(e => e.endTime) // 确保有结束时间
    .map(entry => {
      const startTime = new Date(entry.startTime);
      const endTime = new Date(entry.endTime!);
      const duration = differenceInMinutes(endTime, startTime);

      return {
        id: entry.id!,
        startTime,
        endTime,
        duration: Math.max(0, duration),
        activity: entry.activity,
        categoryId: entry.categoryId,
        categoryName: entry.categoryId ? (categoryMap.get(entry.categoryId) || '未分类') : '未分类',
        goalId: entry.goalId,
        goalName: entry.goalId ? (goalMap.get(entry.goalId) || '无目标') : '无目标',
        date: format(startTime, 'yyyy-MM-dd'),
        hour: startTime.getHours(),
        weekday: startTime.getDay(),
      };
    })
    .filter(e => e.duration > 0); // 过滤无效记录
}

/** 计算分析指标 */
export function calculateMetrics(entries: ProcessedEntry[]): AnalysisMetrics {
  if (entries.length === 0) {
    return {
      totalTime: 0,
      totalEntries: 0,
      avgDuration: 0,
      activeDays: 0,
      topGoal: null,
      topCategory: null,
    };
  }

  const totalTime = entries.reduce((sum, e) => sum + e.duration, 0);
  const uniqueDates = new Set(entries.map(e => e.date));

  // 按目标分组计算
  const goalTimes = groupByGoal(entries);
  const topGoal = goalTimes.length > 0 ? goalTimes[0].name : null;

  // 按类别分组计算
  const categoryTimes = groupByCategory(entries);
  const topCategory = categoryTimes.length > 0 ? categoryTimes[0].name : null;

  return {
    totalTime,
    totalEntries: entries.length,
    avgDuration: Math.round(totalTime / entries.length),
    activeDays: uniqueDates.size,
    topGoal,
    topCategory,
  };
}

/** 按目标分组聚合 */
export function groupByGoal(entries: ProcessedEntry[]): ChartDataPoint[] {
  const groups = new Map<string, number>();

  entries.forEach(e => {
    const key = e.goalName || '无目标';
    groups.set(key, (groups.get(key) || 0) + e.duration);
  });

  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** 按类别分组聚合 */
export function groupByCategory(entries: ProcessedEntry[]): ChartDataPoint[] {
  const groups = new Map<string, { value: number; categoryId: string | null }>();

  entries.forEach(e => {
    const key = e.categoryName || '未分类';
    const existing = groups.get(key);
    if (existing) {
      existing.value += e.duration;
    } else {
      groups.set(key, { value: e.duration, categoryId: e.categoryId });
    }
  });

  return Array.from(groups.entries())
    .map(([name, data]) => ({
      name,
      value: data.value,
      color: data.categoryId ? CATEGORY_COLORS[data.categoryId]?.color : '#999',
    }))
    .sort((a, b) => b.value - a.value);
}

/** 按日期分组（趋势图） */
export function groupByDay(entries: ProcessedEntry[], dateRange: DateRange): TrendDataPoint[] {
  const groups = new Map<string, number>();

  // 初始化日期范围内所有日期为0
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  days.forEach(day => {
    groups.set(format(day, 'yyyy-MM-dd'), 0);
  });

  // 聚合数据
  entries.forEach(e => {
    groups.set(e.date, (groups.get(e.date) || 0) + e.duration);
  });

  return Array.from(groups.entries())
    .map(([date, value]) => ({
      date,
      value: Math.round(value / 60 * 10) / 10, // 转换为小时，保留1位小数
      label: format(new Date(date), 'MM/dd'),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 按日期+类别分组（分类别趋势图） */
export function groupByDayAndCategory(
  entries: ProcessedEntry[],
  dateRange: DateRange
): { data: CategoryTrendDataPoint[]; categoryKeys: { id: string; name: string; color: string }[] } {
  // 获取所有出现的类别
  const categorySet = new Map<string, { name: string; color: string }>();
  entries.forEach(e => {
    const id = e.categoryId || 'uncategorized';
    if (!categorySet.has(id)) {
      categorySet.set(id, {
        name: e.categoryName || '未分类',
        color: e.categoryId ? (CATEGORY_COLORS[e.categoryId]?.color || '#999') : '#e0e0e0',
      });
    }
  });

  // 初始化日期范围内所有日期
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  const data: CategoryTrendDataPoint[] = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const point: CategoryTrendDataPoint = {
      date: dateStr,
      label: format(day, 'MM/dd'),
    };
    // 初始化所有类别为0
    categorySet.forEach((_, id) => {
      point[id] = 0;
    });
    return point;
  });

  // 聚合数据
  const dateIndexMap = new Map(data.map((d, i) => [d.date, i]));
  entries.forEach(e => {
    const idx = dateIndexMap.get(e.date);
    if (idx !== undefined) {
      const categoryId = e.categoryId || 'uncategorized';
      const current = data[idx][categoryId];
      data[idx][categoryId] = (typeof current === 'number' ? current : 0) + e.duration / 60;
    }
  });

  // 四舍五入保留1位小数
  data.forEach(d => {
    categorySet.forEach((_, id) => {
      const val = d[id];
      if (typeof val === 'number') {
        d[id] = Math.round(val * 10) / 10;
      }
    });
  });

  // 构建类别列表，未分类放最后
  const categoryKeys = Array.from(categorySet.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => {
      if (a.id === 'uncategorized') return 1;
      if (b.id === 'uncategorized') return -1;
      const orderA = CATEGORY_COLORS[a.id]?.order ?? 999;
      const orderB = CATEGORY_COLORS[b.id]?.order ?? 999;
      return orderA - orderB;
    });

  return { data, categoryKeys };
}

/** 按小时分组（分布图） */
export function groupByHour(entries: ProcessedEntry[]): ChartDataPoint[] {
  const groups = new Map<number, number>();

  // 初始化24小时
  for (let i = 0; i < 24; i++) {
    groups.set(i, 0);
  }

  entries.forEach(e => {
    groups.set(e.hour, (groups.get(e.hour) || 0) + e.duration);
  });

  return Array.from(groups.entries())
    .map(([hour, value]) => ({
      name: `${hour}:00`,
      value: Math.round(value / 60 * 10) / 10, // 转换为小时
    }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));
}

/** 按星期分布（热力图） */
export function groupByWeekday(entries: ProcessedEntry[]): ChartDataPoint[] {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const groups = new Map<number, number>();

  // 初始化
  for (let i = 0; i < 7; i++) {
    groups.set(i, 0);
  }

  entries.forEach(e => {
    groups.set(e.weekday, (groups.get(e.weekday) || 0) + e.duration);
  });

  return Array.from(groups.entries())
    .map(([weekday, value]) => ({
      name: weekdays[weekday],
      value: Math.round(value / 60 * 10) / 10,
    }));
}

/** 格式化时长显示 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

/** 格式化时长为小时 */
export function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60 * 10) / 10;
  return `${hours}h`;
}
