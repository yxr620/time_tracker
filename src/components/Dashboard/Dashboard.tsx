import React, { useState, useEffect, useCallback } from 'react';
import { IonCard, IonSpinner, IonIcon } from '@ionic/react';
import { calendarOutline, analyticsOutline, trendingUpOutline } from 'ionicons/icons';
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
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenTrend }) => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRange, setSelectedRange] = useState(30);
  
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

  // 处理时间范围变更
  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    if (days > 0) {
      const end = new Date();
      const start = subDays(end, days);
      setDateRange({ start, end });
    }
    // 如果是自定义（days === -1），保持当前的 dateRange 不变
  };

  // 处理自定义日期范围变更
  const handleCustomRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

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
      {metrics && <KPICards metrics={metrics} />}

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 趋势分析入口卡片 */}
        {onOpenTrend && (
          <div 
            className="chart-card chart-card-full trend-entry-card"
            onClick={onOpenTrend}
          >
            <div className="trend-entry-content">
              <div className="trend-entry-left">
                <IonIcon icon={trendingUpOutline} className="trend-entry-icon" />
                <div className="trend-entry-text">
                  <h3>类别趋势分析</h3>
                  <p>查看每个类别的独立时长趋势图</p>
                </div>
              </div>
              <div className="trend-entry-preview">
                {categoryTrendData.categoryKeys.slice(0, 5).map(cat => (
                  <span 
                    key={cat.id} 
                    className="trend-preview-tag"
                    style={{ backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }}
                  >
                    {cat.name}
                  </span>
                ))}
                {categoryTrendData.categoryKeys.length > 5 && (
                  <span className="trend-preview-more">+{categoryTrendData.categoryKeys.length - 5}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 目标分析 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">目标分布 (Top 10)</h3>
          </div>
          <div className="chart-wrapper">
            <GoalBarChart data={goalData} />
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
      <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: '#666' }} />
      {DATE_RANGES.map(range => (
        <button
          key={range.days}
          className={`date-range-btn ${selected === range.days ? 'active' : ''}`}
          onClick={() => onChange(range.days)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: selected === range.days ? '#1890ff' : '#f5f5f5',
            color: selected === range.days ? 'white' : '#666',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: selected === range.days ? 500 : 400,
          }}
        >
          {range.label}
        </button>
      ))}
      {selected === -1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <input
            type="date"
            value={formatDateForInput(customRange.start)}
            onChange={(e) => {
              const newStart = new Date(e.target.value);
              if (!isNaN(newStart.getTime()) && newStart <= customRange.end) {
                onCustomRangeChange({ ...customRange, start: newStart });
              }
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              fontSize: 13,
            }}
          />
          <span style={{ color: '#666' }}>至</span>
          <input
            type="date"
            value={formatDateForInput(customRange.end)}
            onChange={(e) => {
              const newEnd = new Date(e.target.value);
              if (!isNaN(newEnd.getTime()) && newEnd >= customRange.start) {
                onCustomRangeChange({ ...customRange, end: newEnd });
              }
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              fontSize: 13,
            }}
          />
        </div>
      )}
    </div>
  );
};

/** KPI 卡片组 */
const KPICards: React.FC<{ metrics: AnalysisMetrics }> = ({ metrics }) => (
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
      <div className="kpi-card-value" style={{ fontSize: 20 }}>{metrics.topGoal || '-'}</div>
    </IonCard>
    <IonCard className="kpi-card">
      <div className="kpi-card-label">最常用类别</div>
      <div className="kpi-card-value" style={{ fontSize: 20 }}>{metrics.topCategory || '-'}</div>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#999" unit="h" />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#999" width={55} />
        <Tooltip
          formatter={(value: number, _name, props) => [`${value} 小时`, props.payload.fullName]}
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
          labelLine={{ stroke: '#999', strokeWidth: 1 }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} 小时`, '时长']} />
        <Legend
          formatter={(value) => <span style={{ color: '#666', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

/** 时段分布图 */
const HourDistributionChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#999" interval={1} />
      <YAxis tick={{ fontSize: 12 }} stroke="#999" unit="h" />
      <Tooltip formatter={(value: number) => [`${value} 小时`, '时长']} />
      <Bar dataKey="value" fill="#52c41a" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export default Dashboard;
