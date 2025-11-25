import React, { useState, useEffect, useCallback } from 'react';
import { IonCard, IonSpinner, IonIcon } from '@ionic/react';
import { calendarOutline, analyticsOutline } from 'ionicons/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
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
  { label: '最近14天', days: 14 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
];

// 类别趋势数据类型
interface CategoryTrendData {
  data: CategoryTrendDataPoint[];
  categoryKeys: { id: string; name: string; color: string }[];
}

export const Dashboard: React.FC = () => {
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
    const end = new Date();
    const start = subDays(end, days);
    setDateRange({ start, end });
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
          <DateRangeSelector selected={selectedRange} onChange={handleRangeChange} />
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
        <DateRangeSelector selected={selectedRange} onChange={handleRangeChange} />
      </div>

      {/* KPI 指标卡片 */}
      {metrics && <KPICards metrics={metrics} />}

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 分类别趋势图 - 全宽 */}
        <div className="chart-card chart-card-full">
          <div className="chart-card-header">
            <h3 className="chart-card-title">每日时长趋势（按类别）</h3>
          </div>
          <div className="chart-wrapper">
            <CategoryTrendChart 
              data={categoryTrendData.data} 
              categoryKeys={categoryTrendData.categoryKeys} 
            />
          </div>
        </div>

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
const DateRangeSelector: React.FC<{ selected: number; onChange: (days: number) => void }> = ({ selected, onChange }) => (
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
  </div>
);

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

/** 分类别趋势折线图 */
const CategoryTrendChart: React.FC<{
  data: CategoryTrendDataPoint[];
  categoryKeys: { id: string; name: string; color: string }[];
}> = ({ data, categoryKeys }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#999" />
      <YAxis tick={{ fontSize: 12 }} stroke="#999" unit="h" />
      <Tooltip
        formatter={(value: number, name: string) => {
          const cat = categoryKeys.find(c => c.id === name);
          return [`${value} 小时`, cat?.name || name];
        }}
        labelFormatter={(label) => `日期: ${label}`}
      />
      <Legend
        formatter={(value) => {
          const cat = categoryKeys.find(c => c.id === value);
          return <span style={{ color: '#666', fontSize: 12 }}>{cat?.name || value}</span>;
        }}
      />
      {categoryKeys.map((cat) => (
        <Line
          key={cat.id}
          type="monotone"
          dataKey={cat.id}
          stroke={cat.color}
          strokeWidth={cat.id === 'uncategorized' ? 1 : 2}
          strokeOpacity={cat.id === 'uncategorized' ? 0.5 : 1}
          dot={false}
          activeDot={{ r: 4 }}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
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
