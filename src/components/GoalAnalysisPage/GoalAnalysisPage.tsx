/**
 * 目标分析页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { IonSpinner, IonIcon } from '@ionic/react';
import { 
  arrowBackOutline, 
  calendarOutline,
  flagOutline,
  chevronForwardOutline,
  checkmarkOutline,
  closeOutline,
} from 'ionicons/icons';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import dayjs from 'dayjs';
import {
  analyzeGoals,
  getDefaultGoalAnalysisDateRange,
  formatGoalDuration,
  formatGoalHours,
  getRelativeTimeDesc,
  getSubGoalDetails,
} from '../../services/analysis/goalAnalysisProcessor';
import { DEFAULT_CLUSTER_SETTINGS } from '../../services/analysis/goalCluster';
import type {
  GoalAnalysisResult,
  ClusterStats,
  GoalCluster,
  UnlinkedEventSuggestion,
  SubGoalDetail,
  ClusterSettings,
  OverviewStats,
  GoalDistributionItem,
} from '../../types/goalAnalysis';
import type { DateRange } from '../../types/analysis';
import { db } from '../../services/db';
import { syncDb } from '../../services/syncDb';
import './GoalAnalysisPage.css';

// 图表样式常量
const CHART_STYLES = {
  axis: {
    tick: { fill: 'hsl(var(--muted-foreground))' },
    stroke: 'hsl(var(--border))'
  },
  grid: {
    stroke: 'hsl(var(--border))',
    strokeDasharray: '3 3',
    vertical: false as const
  }
} as const;

// 预设时间范围选项
const DATE_RANGES = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '自定义', days: -1 },
];

interface GoalAnalysisPageProps {
  onBack?: () => void;
  dateRange?: DateRange;
  selectedRange?: number;
  onDateRangeChange?: (range: DateRange, selected: number) => void;
}

export const GoalAnalysisPage: React.FC<GoalAnalysisPageProps> = ({
  onBack,
  dateRange: dateRangeProp,
  selectedRange: selectedRangeProp,
  onDateRangeChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(dateRangeProp ?? getDefaultGoalAnalysisDateRange());
  const [selectedRange, setSelectedRange] = useState(selectedRangeProp ?? 30);
  const [settings] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  
  // 分析结果
  const [analysisResult, setAnalysisResult] = useState<GoalAnalysisResult | null>(null);
  
  // 展开的聚类详情
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [subGoalDetails, setSubGoalDetails] = useState<SubGoalDetail[]>([]);
  
  // 是否显示全部聚类
  const [showAllClusters, setShowAllClusters] = useState(false);
  const INITIAL_CLUSTER_COUNT = 10; // 初始显示的聚类数量

  useEffect(() => {
    if (dateRangeProp) {
      setDateRange(dateRangeProp);
    }
  }, [dateRangeProp]);

  useEffect(() => {
    if (selectedRangeProp !== undefined) {
      setSelectedRange(selectedRangeProp);
    }
  }, [selectedRangeProp]);

  // 加载分析数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await analyzeGoals(dateRange, settings);
      setAnalysisResult(result);
    } catch (error) {
      console.error('加载目标分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, settings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 加载聚类的子目标详情
  const loadSubGoalDetails = useCallback(async (cluster: GoalCluster) => {
    const { entries } = await db.entries.toArray().then(entries => ({
      entries: entries.filter(e => !e.deleted && e.endTime),
    }));
    const details = getSubGoalDetails(cluster, entries);
    setSubGoalDetails(details);
  }, []);

  // 处理聚类展开/收起
  const handleClusterClick = (cluster: GoalCluster) => {
    if (expandedClusterId === cluster.id) {
      setExpandedClusterId(null);
      setSubGoalDetails([]);
    } else {
      setExpandedClusterId(cluster.id);
      loadSubGoalDetails(cluster);
    }
  };

  // 处理时间范围变更（不含今天）
  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    if (days > 0) {
      const today = new Date();
      const end = dayjs(today).subtract(1, 'day').toDate(); // 昨天
      const start = dayjs(today).subtract(days, 'day').toDate(); // N天前
      const range = { start, end };
      setDateRange(range);
      onDateRangeChange?.(range, days);
    } else {
      onDateRangeChange?.(dateRange, days);
    }
  };

  // 处理自定义日期范围变更
  const handleCustomRangeChange = (range: DateRange) => {
    setDateRange(range);
    onDateRangeChange?.(range, selectedRange);
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="goal-analysis-loading">
        <IonSpinner name="crescent" />
        <span style={{ marginLeft: 12 }}>加载目标分析数据...</span>
      </div>
    );
  }

  // 空数据状态
  if (!analysisResult || analysisResult.clusters.length === 0) {
    return (
      <div className="goal-analysis-container">
        <div className="goal-analysis-header">
          {onBack && (
            <button className="goal-back-btn" onClick={onBack}>
              <IonIcon icon={arrowBackOutline} />
            </button>
          )}
          <h1>目标分析</h1>
          <DateRangeSelector
            selected={selectedRange}
            onChange={handleRangeChange}
            customRange={dateRange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
        <div className="goal-analysis-empty">
          <IonIcon icon={flagOutline} className="goal-analysis-empty-icon" />
          <p className="goal-analysis-empty-text">
            选定时间范围内暂无目标数据<br />
            开始设置目标后，这里将显示分析结果
          </p>
        </div>
      </div>
    );
  }

  const { clusters, stats, unlinkedSuggestions, overviewStats, distribution } = analysisResult;

  return (
    <div className="goal-analysis-container">
      {/* 头部 */}
      <div className="goal-analysis-header">
        {onBack && (
          <button className="goal-back-btn" onClick={onBack}>
            <IonIcon icon={arrowBackOutline} />
          </button>
        )}
        <h1>目标分析</h1>
        <DateRangeSelector
          selected={selectedRange}
          onChange={handleRangeChange}
          customRange={dateRange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* 时间投入概览 */}
      <OverviewStatsCard stats={overviewStats} />

      {/* 目标时间分布 */}
      <GoalDistributionChart distribution={distribution} />

      {/* 聚类列表 */}
      <div className="goal-cluster-section">
        <div className="section-header">
          <h2>📦 目标聚类</h2>
          <span className="section-subtitle">
            共 {clusters.length} 个聚类，{clusters.reduce((sum, c) => sum + c.goals.length, 0)} 个原始目标
          </span>
        </div>
        <div className="cluster-list">
          {(showAllClusters ? stats : stats.slice(0, INITIAL_CLUSTER_COUNT)).map((stat, index) => {
            const cluster = clusters.find(c => c.id === stat.clusterId)!;
            const isExpanded = expandedClusterId === cluster.id;
            
            return (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                stat={stat}
                index={index}
                isExpanded={isExpanded}
                subGoalDetails={isExpanded ? subGoalDetails : []}
                onClick={() => handleClusterClick(cluster)}
              />
            );
          })}
        </div>
        {stats.length > INITIAL_CLUSTER_COUNT && (
          <button 
            className="show-more-btn"
            onClick={() => setShowAllClusters(!showAllClusters)}
          >
            {showAllClusters 
              ? '收起' 
              : `显示更多 (${stats.length - INITIAL_CLUSTER_COUNT} 个)`
            }
          </button>
        )}
      </div>

      {/* 未关联事件推荐 */}
      {unlinkedSuggestions.length > 0 && (
        <UnlinkedEventSection 
            suggestions={unlinkedSuggestions} 
            clusters={clusters}
            onRefresh={fetchData}
          />
      )}
    </div>
  );
};

// === 子组件 ===

/** 时间范围选择器 */
const DateRangeSelector: React.FC<{
  selected: number;
  onChange: (days: number) => void;
  customRange: DateRange;
  onCustomRangeChange: (range: DateRange) => void;
}> = ({ selected, onChange, customRange, onCustomRangeChange }) => {
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="goal-filters">
      <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
      {DATE_RANGES.map(range => (
        <button
          key={range.days}
          className={`goal-range-btn ${selected === range.days ? 'active' : ''}`}
          onClick={() => onChange(range.days)}
        >
          {range.label}
        </button>
      ))}
      {selected === -1 && (
        <div className="goal-custom-range">
          <input
            type="date"
            value={formatDateForInput(customRange.start)}
            onChange={(e) => {
              const newStart = new Date(e.target.value);
              if (!isNaN(newStart.getTime()) && newStart <= customRange.end) {
                onCustomRangeChange({ ...customRange, start: newStart });
              }
            }}
          />
          <span>至</span>
          <input
            type="date"
            value={formatDateForInput(customRange.end)}
            onChange={(e) => {
              const newEnd = new Date(e.target.value);
              if (!isNaN(newEnd.getTime()) && newEnd >= customRange.start) {
                onCustomRangeChange({ ...customRange, end: newEnd });
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

/** 时间投入概览卡片 */
const OverviewStatsCard: React.FC<{
  stats: OverviewStats;
}> = ({ stats }) => {
  const formatHours = (minutes: number): string => {
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours}h`;
  };

  const items = [
    {
      icon: '⏱️',
      value: formatHours(stats.totalDuration),
      label: '总投入',
      desc: `${stats.totalEntries} 条记录`,
    },
    {
      icon: '📅',
      value: formatHours(stats.dailyAvgDuration),
      label: '日均投入',
      desc: `${stats.daysInRange} 天内`,
    },
    {
      icon: '🎯',
      value: `${Math.round(stats.goalCoverageRate * 100)}%`,
      label: '目标覆盖率',
      desc: '有目标的时间占比',
    },
    {
      icon: '📦',
      value: `${stats.activeClusters}`,
      label: '活跃聚类',
      desc: '有时间记录的',
    },
  ];

  return (
    <div className="overview-stats-card">
      <h3>📋 时间投入概览</h3>
      <div className="overview-stats-row">
        {items.map((item, i) => (
          <div className="overview-stat" key={i}>
            <span className="overview-icon">{item.icon}</span>
            <span className="overview-value">{item.value}</span>
            <span className="overview-label">{item.label}</span>
            <span className="overview-desc">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 目标时间分布图 */
const GoalDistributionChart: React.FC<{
  distribution: GoalDistributionItem[];
}> = ({ distribution }) => {
  if (distribution.length === 0) return null;

  const TOP_N = 10;
  const sortedItems = [...distribution].sort((a, b) => b.totalDuration - a.totalDuration);
  const topItems = sortedItems.slice(0, TOP_N);
  const otherItems = sortedItems.slice(TOP_N);

  // Build chart data
  const chartData: { name: string; hours: number; percentage: number; color: string }[] = [];

  for (const item of topItems) {
    chartData.push({
      name: item.clusterName.length > 8 ? item.clusterName.slice(0, 8) + '…' : item.clusterName,
      hours: Math.round(item.totalDuration / 60 * 10) / 10,
      percentage: item.percentage,
      color: item.color,
    });
  }

  if (otherItems.length > 0) {
    const otherDuration = otherItems.reduce((sum, i) => sum + i.totalDuration, 0);
    const otherPercentage = otherItems.reduce((sum, i) => sum + i.percentage, 0);
    chartData.push({
      name: `其他 (${otherItems.length}个)`,
      hours: Math.round(otherDuration / 60 * 10) / 10,
      percentage: otherPercentage,
      color: '#9ca3af',
    });
  }

  return (
    <div className="goal-chart-card">
      <div className="goal-chart-header">
        <div className="goal-chart-title">📊 目标时间分布</div>
        <span className="goal-chart-subtitle">显示前{TOP_N}个聚类</span>
      </div>
      <div className="goal-chart-wrapper" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 40, right: 16, left: 6, bottom: 40 }}
          >
            <CartesianGrid {...CHART_STYLES.grid} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, ...CHART_STYLES.axis.tick }}
              stroke={CHART_STYLES.axis.stroke}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, ...CHART_STYLES.axis.tick }}
              stroke={CHART_STYLES.axis.stroke}
              tickFormatter={(val) => `${val}h`}
            />
            <Tooltip
              content={(props) => {
                const { active, payload } = props;
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload as typeof chartData[0];
                return (
                  <div className="goal-tooltip">
                    <div className="tooltip-header">{d.name}</div>
                    <div className="tooltip-row">
                      <span className="tooltip-dot" style={{ backgroundColor: d.color }} />
                      <span className="tooltip-name">时长</span>
                      <span className="tooltip-value">{d.hours}h</span>
                    </div>
                    <div className="tooltip-row">
                      <span className="tooltip-dot" style={{ backgroundColor: 'transparent' }} />
                      <span className="tooltip-name">占比</span>
                      <span className="tooltip-value">{(d.percentage * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="hours"
              radius={[4, 4, 0, 0]}
              barSize={28}
              label={({ x, y, width, value, index }: any) => {
                const item = chartData[index];
                return (
                  <text x={x + width / 2} y={y - 12} fontSize={11} fill="hsl(var(--muted-foreground))" textAnchor="middle">
                    <tspan x={x + width / 2} dy="0">
                      {value}h
                    </tspan>
                    <tspan x={x + width / 2} dy="12">
                      {(item.percentage * 100).toFixed(1)}%
                    </tspan>
                  </text>
                );
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** 单个聚类卡片 */
const ClusterCard: React.FC<{
  cluster: GoalCluster;
  stat: ClusterStats;
  index: number;
  isExpanded: boolean;
  subGoalDetails: SubGoalDetail[];
  onClick: () => void;
}> = ({ cluster, stat, index, isExpanded, subGoalDetails, onClick }) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const color = colors[index % colors.length];

  return (
    <div className={`cluster-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="cluster-card-main" onClick={onClick}>
        <div className="cluster-color-bar" style={{ backgroundColor: color }} />
        <div className="cluster-info">
          <div className="cluster-name-row">
            <span className="cluster-name">{cluster.name}</span>
          </div>
          <div className="cluster-stats">
            <span className="cluster-stat">
              <strong>{formatGoalHours(stat.totalDuration)}</strong>
            </span>
            <span className="cluster-stat-divider">·</span>
            <span className="cluster-stat">{stat.activeDays}天</span>
            <span className="cluster-stat-divider">·</span>
            <span className="cluster-stat">{cluster.goals.length}个目标</span>
          </div>
          <div className="cluster-meta">
            <span>最近: {getRelativeTimeDesc(stat.lastActiveDate)}</span>
            <span className="cluster-stat-divider">·</span>
            <span>连续最长: {stat.longestStreak}天</span>
          </div>
        </div>
        <IonIcon 
          icon={chevronForwardOutline} 
          className={`cluster-arrow ${isExpanded ? 'rotated' : ''}`}
        />
      </div>
      
      {isExpanded && (
        <div className="cluster-details">
          <div className="subgoal-list">
            <div className="subgoal-header">📝 包含的子目标</div>
            {subGoalDetails.map((detail) => (
              <div key={detail.goalId} className="subgoal-item">
                <span className="subgoal-name">{detail.goalName}</span>
                <span className="subgoal-date">{detail.date}</span>
                <span className="subgoal-duration">{formatGoalDuration(detail.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** 未关联事件推荐区域 */
const UnlinkedEventSection: React.FC<{
  suggestions: UnlinkedEventSuggestion[];
  clusters: GoalCluster[];
  onRefresh: () => void;
}> = ({ suggestions, clusters, onRefresh }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // 获取建议的最佳候选目标（±2天内最近的目标）
  const getBestCandidate = (suggestion: UnlinkedEventSuggestion) => {
    const cluster = clusters.find(c => c.id === suggestion.suggestedClusterId);
    if (!cluster) return null;
    
    const suggestionDate = new Date(suggestion.date);
    const candidates = cluster.goals
      .map(g => ({ goal: g, diff: Math.abs(dayjs(g.date).diff(suggestionDate, 'day')) }))
      .filter(c => c.diff <= 2)
      .sort((a, b) => a.diff - b.diff);
    
    return candidates[0]?.goal || null;
  };

  // 点击关联：直接关联到最近的候选目标
  const handleLink = async (suggestion: UnlinkedEventSuggestion) => {
    const candidate = getBestCandidate(suggestion);
    if (!candidate) return;
    
    try {
      await syncDb.entries.update(suggestion.entryId, { goalId: candidate.id });
      setDismissed(prev => new Set(prev).add(suggestion.entryId));
      onRefresh();
    } catch (err) {
      console.error('关联失败:', err);
    }
  };

  const handleDismiss = (entryId: string) => {
    setDismissed(prev => new Set(prev).add(entryId));
  };

  // 只显示有 ±2 天内可关联目标的建议
  const visibleSuggestions = suggestions.filter(s => 
    !dismissed.has(s.entryId) && getBestCandidate(s) !== null
  );

  if (visibleSuggestions.length === 0) return null;

  return (
    <div className="unlinked-section">
      <div className="section-header">
        <h2>🔗 未关联事件推荐</h2>
        <span className="section-subtitle">以下事件可能属于现有目标</span>
      </div>
      <div className="unlinked-list">
        {visibleSuggestions.slice(0, 5).map((suggestion) => {
          const candidate = getBestCandidate(suggestion);
          return (
            <div key={suggestion.entryId} className="unlinked-item">
              <div className="unlinked-info">
                <div className="unlinked-activity">{suggestion.activity}</div>
                <div className="unlinked-meta">
                  <span>{suggestion.date}</span>
                  <span className="unlinked-divider">·</span>
                  <span>{formatGoalDuration(suggestion.duration)}</span>
                </div>
                <div className="unlinked-suggestion">
                  → 关联到: <strong>{candidate?.name}</strong>
                  <span className="confidence-badge">{candidate?.date}</span>
                </div>
              </div>
              <div className="unlinked-actions">
                <button className="unlinked-btn link" onClick={() => handleLink(suggestion)}>
                  <IonIcon icon={checkmarkOutline} />
                </button>
                <button className="unlinked-btn dismiss" onClick={() => handleDismiss(suggestion.entryId)}>
                  <IonIcon icon={closeOutline} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoalAnalysisPage;
