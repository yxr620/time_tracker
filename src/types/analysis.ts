// 分析模块类型定义

/** 处理后的时间条目（用于分析） */
export interface ProcessedEntry {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;       // 时长（分钟）
  activity: string;
  categoryId: string | null;
  categoryName: string;
  goalId: string | null;
  goalName: string;
  date: string;           // YYYY-MM-DD 格式
  hour: number;           // 0-23
  weekday: number;        // 0-6 (周日-周六)
}

/** 分析指标 */
export interface AnalysisMetrics {
  totalTime: number;      // 总时长（分钟）
  totalEntries: number;   // 记录数
  avgDuration: number;    // 平均时长（分钟）
  activeDays: number;     // 活跃天数
  topGoal: string | null;
  topCategory: string | null;
}

/** 图表数据点（通用） */
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  extra?: Record<string, unknown>;
}

/** 趋势数据点 */
export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

/** 分类别趋势数据点 */
export interface CategoryTrendDataPoint {
  date: string;
  label: string;
  [categoryId: string]: number | string; // 各类别的时长
}

/** 热力图数据点 */
export interface HeatmapDataPoint {
  hour: number;
  weekday: number;
  value: number;
}

/** 日期范围筛选 */
export interface DateRange {
  start: Date;
  end: Date;
}

/** 筛选条件 */
export interface AnalysisFilters {
  dateRange: DateRange;
  goalIds?: string[];
  categoryIds?: string[];
}
