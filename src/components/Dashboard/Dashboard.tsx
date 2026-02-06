import React, { useState, useEffect, useCallback } from 'react';
import { IonCard, IonSpinner, IonIcon } from '@ionic/react';
import { calendarOutline, analyticsOutline, trendingUpOutline, flagOutline } from 'ionicons/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { subDays } from 'date-fns';
import {
  loadRawData,
  processEntries,
  calculateMetrics,
  groupByGoal,
  groupByCategory,
  groupByDayAndCategory,
  groupByHour,
  formatDuration,
  getDefaultDateRange,
} from '../../services/analysis/processor';
import type { ProcessedEntry, AnalysisMetrics, ChartDataPoint, CategoryTrendDataPoint, DateRange } from '../../types/analysis';
import './Dashboard.css';

// 图表样式常量
const CHART_STYLES = {
  tooltip: {
    contentStyle: { 
      background: 'hsl(var(--card))', 
      border: '1px solid hsl(var(--border))', 
      borderRadius: 8, 
      color: 'hsl(var(--foreground))' 
    },
    labelStyle: { color: 'hsl(var(--foreground))' },
    itemStyle: { color: 'hsl(var(--foreground))' }
  },
  axis: {
    tick: { fill: 'hsl(var(--muted-foreground))' },
    stroke: 'hsl(var(--border))'
  },
  grid: {
    stroke: 'hsl(var(--border))',
    strokeDasharray: '3 3'
  }
} as const;

// 预设时间范围选项
const DATE_RANGES = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '自定义', days: -1 },
];

// 类别趋势数据类型
interface CategoryTrendData {
  data: CategoryTrendDataPoint[];
  categoryKeys: { id: string; name: string; color: string }[];
}

interface DashboardProps {
  onOpenTrend?: () => void;
  onOpenGoalAnalysis?: () => void;
  dateRange?: DateRange;
  selectedRange?: number;
  onDateRangeChange?: (range: DateRange, selected: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenTrend, onOpenGoalAnalysis, dateRange: dateRangeProp, selectedRange: selectedRangeProp, onDateRangeChange }) => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(dateRangeProp ?? getDefaultDateRange());
  const [selectedRange, setSelectedRange] = useState(selectedRangeProp ?? 30);

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
  
  // 数据状态
  const [entries, setEntries] = useState<ProcessedEntry[]>([]);
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [goalData, setGoalData] = useState<ChartDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<ChartDataPoint[]>([]);
  const [categoryTrendData, setCategoryTrendData] = useState<CategoryTrendData>({ data: [], categoryKeys: [] });
  const [hourData, setHourData] = useState<ChartDataPoint[]>([]);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: rawEntries, goals, categories } = await loadRawData({
        dateRange,
      });
      
      const processed = processEntries(rawEntries, goals, categories);
      setEntries(processed);
      setMetrics(calculateMetrics(processed));
      setGoalData(groupByGoal(processed).slice(0, 10)); // 取前10
      setCategoryData(groupByCategory(processed));
      setCategoryTrendData(groupByDayAndCategory(processed, dateRange));
      setHourData(groupByHour(processed));
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 处理时间范围变更（不含今天）
  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    if (days > 0) {
      const today = new Date();
      const end = subDays(today, 1); // 昨天
      const start = subDays(today, days); // N天前
      const range = { start, end };
      setDateRange(range);
      onDateRangeChange?.(range, days);
    } else {
      onDateRangeChange?.(dateRange, days);
    }
    // 如果是自定义（days === -1），保持当前的 dateRange 不变
  };

  // 处理自定义日期范围变更
  const handleCustomRangeChange = (range: DateRange) => {
    setDateRange(range);
    onDateRangeChange?.(range, selectedRange);
  };

  const noGoalStat = goalData.find(g => g.name === '无目标');
  const goalsForChart = goalData.filter(g => g.name !== '无目标');

  const displayTopGoal = goalData.find(g => g.name !== '无目标')?.name || metrics?.topGoal || '-';

  // 加载中状态
  if (loading) {
    return (
      <div className="dashboard-loading">
        <IonSpinner name="crescent" />
        <span style={{ marginLeft: 12 }}>加载分析数据...</span>
      </div>
    );
  }

  // 空数据状态
  if (entries.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>数据分析</h1>
          <DateRangeSelector 
            selected={selectedRange} 
            onChange={handleRangeChange} 
            customRange={dateRange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
        <div className="dashboard-empty">
          <IonIcon icon={analyticsOutline} className="dashboard-empty-icon" />
          <p className="dashboard-empty-text">
            选定时间范围内暂无数据<br />
            开始记录时间后，这里将显示分析图表
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* 头部 */}
      <div className="dashboard-header">
        <h1>数据分析</h1>
        <DateRangeSelector 
          selected={selectedRange} 
          onChange={handleRangeChange} 
          customRange={dateRange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* KPI 指标卡片 */}
      {metrics && <KPICards metrics={metrics} topGoalOverride={displayTopGoal} />}

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 趋势分析和目标分析入口卡片 - 同一行 */}
        {(onOpenTrend || onOpenGoalAnalysis) && (
          <div className="chart-card chart-card-full chart-card-compact">
            <div style={{ display: 'flex', gap: 12 }}>
              {/* 趋势分析入口卡片 */}
              {onOpenTrend && (
                <div 
                  className="trend-entry-card"
                  onClick={onOpenTrend}
                  style={{ flex: 1, background: 'hsl(var(--card))', borderRadius: 12, padding: 16, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minHeight: 96 }}
                >
                  <div className="trend-entry-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div className="trend-entry-left">
                      <IonIcon icon={trendingUpOutline} className="trend-entry-icon" />
                      <div className="trend-entry-text">
                        <h3>类别趋势分析</h3>
                        <p>查看每个类别的独立时长趋势图</p>
                      </div>
                    </div>
                    <div className="trend-entry-preview" style={{ marginTop: 4 }}>
                      {categoryTrendData.categoryKeys.slice(0, 3).map(cat => (
                        <span 
                          key={cat.id} 
                          className="trend-preview-tag"
                          style={{ backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }}
                        >
                          {cat.name}
                        </span>
                      ))}
                      {categoryTrendData.categoryKeys.length > 3 && (
                        <span className="trend-preview-more">+{categoryTrendData.categoryKeys.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 目标分析入口卡片 */}
              {onOpenGoalAnalysis && (
                <div 
                  className="trend-entry-card goal-entry-card"
                  onClick={onOpenGoalAnalysis}
                  style={{ flex: 1, background: 'hsl(var(--card))', borderRadius: 12, padding: 16, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minHeight: 96 }}
                >
                  <div className="trend-entry-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div className="trend-entry-left">
                      <IonIcon icon={flagOutline} className="trend-entry-icon" style={{ color: '#f59e0b' }} />
                      <div className="trend-entry-text">
                        <h3>目标深度分析</h3>
                        <p>智能聚类相似目标，追踪推进进度</p>
                      </div>
                    </div>
                    <div className="trend-entry-preview" style={{ marginTop: 4 }}>
                      <span className="trend-preview-tag" style={{ backgroundColor: '#3b82f620', color: '#3b82f6', borderColor: '#3b82f6' }}>
                        📋 投入概览
                      </span>
                      <span className="trend-preview-tag" style={{ backgroundColor: '#10b98120', color: '#10b981', borderColor: '#10b981' }}>
                        📊 时间分布
                      </span>
                      <span className="trend-preview-tag" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b', borderColor: '#f59e0b' }}>
                        📦 聚类分析
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 目标分析 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">目标分布 (Top 10)</h3>
            {noGoalStat && (
              <span
                style={{
                  marginLeft: 8,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: 12,
                  border: '1px solid hsl(var(--border))',
                }}
              >
                无目标 {Math.round((noGoalStat.value / 60) * 10) / 10}h
              </span>
            )}
          </div>
          <div className="chart-wrapper">
            <GoalBarChart data={goalsForChart} />
          </div>
        </div>

        {/* 类别分析 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">类别分布</h3>
          </div>
          <div className="chart-wrapper">
            <CategoryPieChart data={categoryData} />
          </div>
        </div>

        {/* 小时分布 */}
        <div className="chart-card chart-card-full">
          <div className="chart-card-header">
            <h3 className="chart-card-title">时段分布</h3>
          </div>
          <div className="chart-wrapper">
            <HourDistributionChart data={hourData} />
          </div>
        </div>
      </div>
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
    <div className="dashboard-filters">
      <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
      {DATE_RANGES.map(range => (
        <button
          key={range.days}
          className={`range-button ${selected === range.days ? 'active' : ''}`}
          onClick={() => onChange(range.days)}
        >
          {range.label}
        </button>
      ))}
      {selected === -1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <input
            type="date"
            className="date-input"
            value={formatDateForInput(customRange.start)}
            onChange={(e) => {
              const newStart = new Date(e.target.value);
              if (!isNaN(newStart.getTime()) && newStart <= customRange.end) {
                onCustomRangeChange({ ...customRange, start: newStart });
              }
            }}
          />
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>至</span>
          <input
            type="date"
            className="date-input"
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

/** KPI 卡片组 */
const KPICards: React.FC<{ metrics: AnalysisMetrics; topGoalOverride?: string | null }> = ({ metrics, topGoalOverride }) => (
  <div className="kpi-grid">
    <IonCard className="kpi-card">
      <div className="kpi-card-label">总时长</div>
      <div className="kpi-card-value">{formatDuration(metrics.totalTime)}</div>
      <div className="kpi-card-sub">{metrics.totalEntries} 条记录</div>
    </IonCard>
    <IonCard className="kpi-card">
      <div className="kpi-card-label">活跃天数</div>
      <div className="kpi-card-value">{metrics.activeDays} 天</div>
      <div className="kpi-card-sub">平均 {formatDuration(metrics.totalTime / Math.max(1, metrics.activeDays))}/天</div>
    </IonCard>
    <IonCard className="kpi-card">
      <div className="kpi-card-label">最常用目标</div>
      <div className="kpi-card-value" style={{ fontSize: 20 }}>{topGoalOverride || metrics.topGoal || '-'}</div>
    </IonCard>
  </div>
);

/** 目标柱状图 */
const GoalBarChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => {
  const chartData = data.map(d => ({
    name: d.name.length > 8 ? d.name.slice(0, 8) + '...' : d.name,
    fullName: d.name,
    value: Math.round(d.value / 60 * 10) / 10, // 转小时
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
        <CartesianGrid {...CHART_STYLES.grid} />
        <XAxis type="number" tick={{ fontSize: 12, ...CHART_STYLES.axis.tick }} stroke={CHART_STYLES.axis.stroke} unit="h" />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12, ...CHART_STYLES.axis.tick }} stroke={CHART_STYLES.axis.stroke} width={55} />
        <Tooltip
          formatter={(value: number, _name, props) => [`${value} 小时`, props.payload.fullName]}
          {...CHART_STYLES.tooltip}
        />
        <Bar dataKey="value" fill="#1890ff" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

/** 类别饼图 */
const CategoryPieChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => {
  const chartData = data.map(d => ({
    name: d.name,
    value: Math.round(d.value / 60 * 10) / 10,
    color: d.color || '#999',
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${value} 小时`, '时长']}
          {...CHART_STYLES.tooltip}
        />
        <Legend
          formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

/** 时段分布图 */
const HourDistributionChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid {...CHART_STYLES.grid} />
      <XAxis dataKey="name" tick={{ fontSize: 11, ...CHART_STYLES.axis.tick }} stroke={CHART_STYLES.axis.stroke} interval={1} />
      <YAxis tick={{ fontSize: 12, ...CHART_STYLES.axis.tick }} stroke={CHART_STYLES.axis.stroke} unit="h" />
      <Tooltip
        formatter={(value: number) => [`${value} 小时`, '时长']}
        {...CHART_STYLES.tooltip}
      />
      <Bar dataKey="value" fill="#52c41a" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export default Dashboard;
