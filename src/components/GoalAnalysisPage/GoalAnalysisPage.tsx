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
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from 'recharts';
import { subDays, differenceInDays } from 'date-fns';
import {
  analyzeGoals,
  getDefaultGoalAnalysisDateRange,
  formatGoalDuration,
  formatGoalHours,
  getHealthStatusInfo,
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
} from '../../types/goalAnalysis';
import type { DateRange } from '../../types/analysis';
import { db } from '../../services/db';
import { syncDb } from '../../services/syncDb';
import './GoalAnalysisPage.css';

// 预设时间范围选项
const DATE_RANGES = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
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

  // 处理时间范围变更
  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    if (days > 0) {
      const end = new Date();
      const start = subDays(end, days);
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

  const { clusters, stats, trendData, unlinkedSuggestions, healthSummary } = analysisResult;

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

      {/* 健康度总览 */}
      <HealthSummaryCard summary={healthSummary} />

      {/* 目标趋势图 */}
      <ClusterTrendChart 
        data={trendData.data} 
        clusters={trendData.clusterKeys}
        stats={stats}
      />

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
      <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: '#666' }} />
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

/** 健康度总览卡片 */
const HealthSummaryCard: React.FC<{
  summary: { active: number; slowing: number; stalled: number };
}> = ({ summary }) => {
  const total = summary.active + summary.slowing + summary.stalled;
  
  return (
    <div className="health-summary-card">
      <h3>🏥 目标健康度</h3>
      <div className="health-stats-row">
        <div className="health-stat active">
          <span className="health-emoji">🟢</span>
          <span className="health-count">{summary.active}</span>
          <span className="health-label">活跃中</span>
          <span className="health-desc">7天内有投入</span>
        </div>
        <div className="health-stat slowing">
          <span className="health-emoji">🟡</span>
          <span className="health-count">{summary.slowing}</span>
          <span className="health-label">放缓</span>
          <span className="health-desc">7-14天未投入</span>
        </div>
        <div className="health-stat stalled">
          <span className="health-emoji">🔴</span>
          <span className="health-count">{summary.stalled}</span>
          <span className="health-label">停滞</span>
          <span className="health-desc">14天以上未投入</span>
        </div>
      </div>
      {total > 0 && (
        <div className="health-bar">
          <div 
            className="health-bar-active" 
            style={{ width: `${(summary.active / total) * 100}%` }} 
          />
          <div 
            className="health-bar-slowing" 
            style={{ width: `${(summary.slowing / total) * 100}%` }} 
          />
          <div 
            className="health-bar-stalled" 
            style={{ width: `${(summary.stalled / total) * 100}%` }} 
          />
        </div>
      )}
    </div>
  );
};

/** 聚类趋势图 */
const ClusterTrendChart: React.FC<{
  data: any[];
  clusters: { id: string; name: string; color: string }[];
  stats: ClusterStats[];
}> = ({ data, clusters, stats }) => {
  if (data.length === 0 || clusters.length === 0) return null;

  // 只显示前 TOP_N 个最重要的聚类（按总时长排序），其余合并为"其他"
  const TOP_N = 8;
  
  // 按总时长排序
  const sortedStats = [...stats].sort((a, b) => b.totalDuration - a.totalDuration);
  const topClusterIds = new Set(sortedStats.slice(0, TOP_N).map(s => s.clusterId));
  
  // 分离出 top 聚类和其他聚类
  const topClusters = clusters.filter(c => topClusterIds.has(c.id));
  const otherClusterIds = clusters.filter(c => !topClusterIds.has(c.id)).map(c => c.id);
  
  // 重新计算数据，将其他聚类合并
  const processedData = data.map(day => {
    const newDay: any = { date: day.date, label: day.label };
    
    // 保留 top 聚类的数据
    topClusters.forEach(c => {
      newDay[c.id] = day[c.id] || 0;
    });
    
    // 合并其他聚类为 "其他"
    let otherTotal = 0;
    otherClusterIds.forEach(id => {
      otherTotal += (day[id] as number) || 0;
    });
    if (otherClusterIds.length > 0) {
      newDay['__other__'] = Math.round(otherTotal * 10) / 10;
    }
    
    return newDay;
  });
  
  // 构建显示用的聚类列表
  const displayClusters = [...topClusters];
  if (otherClusterIds.length > 0) {
    displayClusters.push({
      id: '__other__',
      name: `其他 (${otherClusterIds.length}个)`,
      color: '#9ca3af',
    });
  }

  return (
    <div className="goal-chart-card">
      <div className="goal-chart-header">
        <div className="goal-chart-title">📈 目标时间投入趋势</div>
        <span className="goal-chart-subtitle">显示前{TOP_N}个主要目标</span>
      </div>
      <div className="goal-chart-wrapper" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              stroke="#999"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#999"
              tickFormatter={(val) => `${val}h`}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || payload.length === 0) return null;

                const total = payload.reduce((sum, item) => sum + ((item.value as number) || 0), 0);
                
                // 过滤掉值为0的项目，并按值排序
                const sortedPayload = [...payload]
                  .filter(item => (item.value as number) > 0)
                  .sort((a, b) => (b.value as number) - (a.value as number));

                return (
                  <div className="goal-tooltip">
                    <div className="tooltip-header">{label}</div>
                    {sortedPayload.slice(0, 10).map((item) => (
                      <div key={item.dataKey} className="tooltip-row">
                        <span 
                          className="tooltip-dot" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="tooltip-name">{item.name}</span>
                        <span className="tooltip-value">{(item.value as number).toFixed(1)}h</span>
                      </div>
                    ))}
                    {sortedPayload.length > 10 && (
                      <div className="tooltip-row" style={{ color: '#999', fontSize: 11 }}>
                        ... 还有 {sortedPayload.length - 10} 项
                      </div>
                    )}
                    <div className="tooltip-total">
                      合计: {total.toFixed(1)}h
                    </div>
                  </div>
                );
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
            />
            {displayClusters.map((cluster) => (
              <Area
                key={cluster.id}
                type="monotone"
                dataKey={cluster.id}
                name={cluster.name}
                stackId="1"
                stroke={cluster.color}
                fill={cluster.color}
                fillOpacity={0.6}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
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
  const healthInfo = getHealthStatusInfo(stat.healthStatus);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const color = colors[index % colors.length];

  return (
    <div className={`cluster-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="cluster-card-main" onClick={onClick}>
        <div className="cluster-color-bar" style={{ backgroundColor: color }} />
        <div className="cluster-info">
          <div className="cluster-name-row">
            <span className="cluster-name">{cluster.name}</span>
            <span className={`cluster-health ${stat.healthStatus}`}>
              {healthInfo.emoji}
            </span>
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
      .map(g => ({ goal: g, diff: Math.abs(differenceInDays(new Date(g.date), suggestionDate)) }))
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
