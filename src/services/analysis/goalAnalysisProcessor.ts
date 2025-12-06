/**
 * 目标分析处理器
 * 负责加载数据、聚类、计算统计指标等
 */

import { format, eachDayOfInterval, differenceInDays, startOfDay, endOfDay, subDays } from 'date-fns';
import { db } from '../db';
import type { TimeEntry, Goal } from '../db';
import {
  clusterGoals,
  matchEventToCluster,
  getClusterColor,
  DEFAULT_CLUSTER_SETTINGS,
} from './goalCluster';
import type {
  GoalCluster,
  ClusterStats,
  ClusterDailyData,
  ClusterTrendData,
  UnlinkedEventSuggestion,
  GoalAnalysisResult,
  GoalHealthStatus,
  SubGoalDetail,
  ClusterSettings,
} from '../../types/goalAnalysis';
import type { DateRange } from '../../types/analysis';

/**
 * 加载目标分析所需的原始数据
 */
export async function loadGoalAnalysisData(dateRange: DateRange): Promise<{
  entries: TimeEntry[];
  goals: Goal[];
}> {
  const startTs = dateRange.start.getTime();
  const endTs = dateRange.end.getTime();

  // 加载时间范围内的所有记录
  let entries = await db.entries.toArray();
  entries = entries.filter(e => {
    if (e.deleted || !e.endTime) return false;
    const entryTs = new Date(e.startTime).getTime();
    return entryTs >= startTs && entryTs <= endTs;
  });

  // 加载所有目标（不限制日期范围，因为聚类需要看全局）
  let goals = await db.goals.toArray();
  goals = goals.filter(g => !g.deleted);

  return { entries, goals };
}

/**
 * 计算聚类的统计指标
 */
export function calculateClusterStats(
  cluster: GoalCluster,
  entries: TimeEntry[],
  _dateRange: DateRange
): ClusterStats {
  // 筛选属于该聚类的记录
  const goalIdSet = new Set(cluster.goalIds);
  const clusterEntries = entries.filter(e => e.goalId && goalIdSet.has(e.goalId));

  if (clusterEntries.length === 0) {
    return {
      clusterId: cluster.id,
      clusterName: cluster.name,
      totalDuration: 0,
      activeDays: 0,
      avgDailyDuration: 0,
      lastActiveDate: null,
      firstActiveDate: null,
      longestStreak: 0,
      healthStatus: 'stalled',
      entryCount: 0,
    };
  }

  // 计算总时长
  let totalDuration = 0;
  const activeDates = new Set<string>();
  let lastActiveDate: Date | null = null;
  let firstActiveDate: Date | null = null;

  for (const entry of clusterEntries) {
    const startTime = new Date(entry.startTime);
    const endTime = new Date(entry.endTime!);
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // 分钟
    
    totalDuration += Math.max(0, duration);
    
    const dateStr = format(startTime, 'yyyy-MM-dd');
    activeDates.add(dateStr);

    if (!lastActiveDate || startTime > lastActiveDate) {
      lastActiveDate = startTime;
    }
    if (!firstActiveDate || startTime < firstActiveDate) {
      firstActiveDate = startTime;
    }
  }

  const activeDays = activeDates.size;
  const avgDailyDuration = activeDays > 0 ? totalDuration / activeDays : 0;

  // 计算最长连续天数
  const longestStreak = calculateLongestStreak(activeDates);

  // 计算健康状态
  const healthStatus = calculateHealthStatus(lastActiveDate);

  return {
    clusterId: cluster.id,
    clusterName: cluster.name,
    totalDuration: Math.round(totalDuration),
    activeDays,
    avgDailyDuration: Math.round(avgDailyDuration),
    lastActiveDate,
    firstActiveDate,
    longestStreak,
    healthStatus,
    entryCount: clusterEntries.length,
  };
}

/**
 * 计算最长连续天数
 */
function calculateLongestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0;

  const sortedDates = Array.from(activeDates).sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diff = differenceInDays(currDate, prevDate);

    if (diff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * 计算健康状态
 */
function calculateHealthStatus(lastActiveDate: Date | null): GoalHealthStatus {
  if (!lastActiveDate) return 'stalled';

  const now = new Date();
  const daysSinceActive = differenceInDays(now, lastActiveDate);

  if (daysSinceActive <= 7) {
    return 'active';
  } else if (daysSinceActive <= 14) {
    return 'slowing';
  } else {
    return 'stalled';
  }
}

/**
 * 生成每日聚类时长趋势数据
 */
export function generateClusterTrendData(
  clusters: GoalCluster[],
  entries: TimeEntry[],
  dateRange: DateRange
): ClusterTrendData {
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  
  // 初始化数据结构
  const data: ClusterDailyData[] = days.map(day => {
    const point: ClusterDailyData = {
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MM/dd'),
    };
    // 初始化所有聚类为0
    clusters.forEach(c => {
      point[c.id] = 0;
    });
    return point;
  });

  // 构建日期索引
  const dateIndexMap = new Map(data.map((d, i) => [d.date, i]));

  // 聚合数据
  for (const entry of entries) {
    if (!entry.goalId || !entry.endTime) continue;

    // 找到该目标所属的聚类
    const cluster = clusters.find(c => c.goalIds.includes(entry.goalId!));
    if (!cluster) continue;

    const dateStr = format(new Date(entry.startTime), 'yyyy-MM-dd');
    const idx = dateIndexMap.get(dateStr);
    if (idx === undefined) continue;

    const startTime = new Date(entry.startTime);
    const endTime = new Date(entry.endTime);
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // 小时

    const current = data[idx][cluster.id];
    data[idx][cluster.id] = (typeof current === 'number' ? current : 0) + duration;
  }

  // 四舍五入
  data.forEach(d => {
    clusters.forEach(c => {
      const val = d[c.id];
      if (typeof val === 'number') {
        d[c.id] = Math.round(val * 10) / 10;
      }
    });
  });

  // 生成聚类颜色
  const clusterKeys = clusters.map((c, index) => ({
    id: c.id,
    name: c.name,
    color: getClusterColor(c.id, index),
  }));

  return { data, clusterKeys };
}

/**
 * 查找未关联目标但可能属于某个聚类的事件
 */
export function findUnlinkedEventSuggestions(
  entries: TimeEntry[],
  clusters: GoalCluster[],
  limit: number = 10
): UnlinkedEventSuggestion[] {
  const suggestions: UnlinkedEventSuggestion[] = [];

  // 找出没有目标关联的记录
  const unlinkedEntries = entries.filter(e => !e.goalId && e.endTime);

  for (const entry of unlinkedEntries) {
    const match = matchEventToCluster(entry.activity, clusters);
    
    if (match && match.confidence >= 0.3) {
      const startTime = new Date(entry.startTime);
      const endTime = new Date(entry.endTime!);
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      suggestions.push({
        entryId: entry.id!,
        activity: entry.activity,
        date: format(startTime, 'yyyy-MM-dd'),
        duration: Math.round(duration),
        suggestedClusterId: match.clusterId,
        suggestedClusterName: match.clusterName,
        confidence: match.confidence,
        keywords: match.keywords,
      });
    }
  }

  // 按置信度排序，取前N个
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, limit);
}

/**
 * 获取聚类的子目标详情
 */
export function getSubGoalDetails(
  cluster: GoalCluster,
  entries: TimeEntry[]
): SubGoalDetail[] {
  const goalIdSet = new Set(cluster.goalIds);
  const goalStats = new Map<string, { duration: number; entryCount: number }>();

  // 聚合每个目标的数据
  for (const entry of entries) {
    if (!entry.goalId || !goalIdSet.has(entry.goalId) || !entry.endTime) continue;

    const startTime = new Date(entry.startTime);
    const endTime = new Date(entry.endTime);
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    if (!goalStats.has(entry.goalId)) {
      goalStats.set(entry.goalId, { duration: 0, entryCount: 0 });
    }
    const stat = goalStats.get(entry.goalId)!;
    stat.duration += duration;
    stat.entryCount++;
  }

  // 构建结果
  const details: SubGoalDetail[] = cluster.goals.map(goal => {
    const stat = goalStats.get(goal.id!) || { duration: 0, entryCount: 0 };
    return {
      goalId: goal.id!,
      goalName: goal.name,
      date: goal.date,
      duration: Math.round(stat.duration),
      entryCount: stat.entryCount,
    };
  });

  // 按时长排序
  details.sort((a, b) => b.duration - a.duration);
  return details;
}

/**
 * 主分析函数：执行完整的目标分析
 */
export async function analyzeGoals(
  dateRange: DateRange,
  settings: ClusterSettings = DEFAULT_CLUSTER_SETTINGS
): Promise<GoalAnalysisResult> {
  // 1. 加载数据
  const { entries, goals } = await loadGoalAnalysisData(dateRange);

  // 2. 执行聚类
  const clusters = clusterGoals(goals, settings);

  // 3. 计算每个聚类的统计指标
  const stats = clusters.map(cluster => calculateClusterStats(cluster, entries, dateRange));

  // 4. 按总时长排序 stats 和 clusters（保持对应关系）
  const sortedIndices = stats
    .map((s, i) => ({ stat: s, index: i }))
    .sort((a, b) => b.stat.totalDuration - a.stat.totalDuration)
    .map(item => item.index);
  
  const sortedStats = sortedIndices.map(i => stats[i]);
  const sortedClusters = sortedIndices.map(i => clusters[i]);

  // 5. 生成趋势数据（使用排序后的聚类）
  const trendData = generateClusterTrendData(sortedClusters, entries, dateRange);

  // 6. 查找未关联事件建议
  const unlinkedSuggestions = findUnlinkedEventSuggestions(entries, sortedClusters);

  // 7. 计算健康度统计
  const healthSummary = {
    active: sortedStats.filter(s => s.healthStatus === 'active').length,
    slowing: sortedStats.filter(s => s.healthStatus === 'slowing').length,
    stalled: sortedStats.filter(s => s.healthStatus === 'stalled').length,
  };

  return {
    clusters: sortedClusters,
    stats: sortedStats,
    trendData,
    unlinkedSuggestions,
    healthSummary,
  };
}

/**
 * 获取默认的分析日期范围（最近30天）
 */
export function getDefaultGoalAnalysisDateRange(): DateRange {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, 30));
  return { start, end };
}

/**
 * 格式化时长显示（分钟 -> 小时分钟）
 */
export function formatGoalDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

/**
 * 格式化时长显示（简短版）
 */
export function formatGoalHours(minutes: number): string {
  const hours = Math.round(minutes / 60 * 10) / 10;
  return `${hours}h`;
}

/**
 * 获取健康状态的显示信息
 */
export function getHealthStatusInfo(status: GoalHealthStatus): {
  label: string;
  color: string;
  emoji: string;
} {
  switch (status) {
    case 'active':
      return { label: '活跃中', color: '#10b981', emoji: '🟢' };
    case 'slowing':
      return { label: '放缓', color: '#f59e0b', emoji: '🟡' };
    case 'stalled':
      return { label: '停滞', color: '#ef4444', emoji: '🔴' };
  }
}

/**
 * 计算相对时间描述
 */
export function getRelativeTimeDesc(date: Date | null): string {
  if (!date) return '从未';
  
  const now = new Date();
  const days = differenceInDays(now, date);
  
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}月前`;
}
