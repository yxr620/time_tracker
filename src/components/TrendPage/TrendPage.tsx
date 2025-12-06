import React, { useState, useEffect, useCallback } from 'react';
import { IonSpinner, IonIcon } from '@ionic/react';
import { calendarOutline, analyticsOutline, arrowBackOutline } from 'ionicons/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { subDays, startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import {
  loadRawData,
  processEntries,
  groupByDayAndCategory,
  groupByWeekAndCategory,
  getDefaultDateRange,
} from '../../services/analysis/processor';
import type { ProcessedEntry, CategoryTrendDataPoint, DateRange } from '../../types/analysis';
import './TrendPage.css';

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

interface StackedAreaOverviewProps {
  data: CategoryTrendDataPoint[];
  categories: { id: string; name: string; color: string }[];
  className?: string;
}

interface TrendPageProps {
  onBack?: () => void;
  dateRange?: DateRange;
  selectedRange?: number;
  onDateRangeChange?: (range: DateRange, selected: number) => void;
}

export const TrendPage: React.FC<TrendPageProps> = ({ onBack, dateRange: dateRangeProp, selectedRange: selectedRangeProp, onDateRangeChange }) => {
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
  const [categoryTrendData, setCategoryTrendData] = useState<CategoryTrendData>({ data: [], categoryKeys: [] });
  const [weeklyComparisonData, setWeeklyComparisonData] = useState<CategoryTrendData>({ data: [], categoryKeys: [] });

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 加载主趋势数据
      const { entries: rawEntries, goals, categories } = await loadRawData({
        dateRange,
      });
      
      const processed = processEntries(rawEntries, goals, categories);
      setEntries(processed);
      setCategoryTrendData(groupByDayAndCategory(processed, dateRange));

      // 2. 加载周度对比数据 (最近3个完整周)
      // 计算基准周（包含结束日期的那一周）
      const currentWeekStart = startOfWeek(dateRange.end, { weekStartsOn: 0 }); // 周日开始
      
      // 计算前3周的时间段
      const weeks = [3, 2, 1].map(weeksAgo => {
        const start = subWeeks(currentWeekStart, weeksAgo);
        const end = endOfWeek(start, { weekStartsOn: 0 });
        return {
          start,
          end,
          label: `${format(start, 'MM/dd')}-${format(end, 'MM/dd')}`
        };
      });

      // 加载这3周的数据
      const comparisonStart = weeks[0].start;
      const comparisonEnd = weeks[2].end;
      
      const { entries: compEntries } = await loadRawData({
        dateRange: { start: comparisonStart, end: comparisonEnd }
      });
      
      const compProcessed = processEntries(compEntries, goals, categories);
      const weeklyData = groupByWeekAndCategory(compProcessed, weeks);
      setWeeklyComparisonData(weeklyData);

    } catch (error) {
      console.error('加载趋势数据失败:', error);
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
      <div className="trend-page-loading">
        <IonSpinner name="crescent" />
        <span style={{ marginLeft: 12 }}>加载趋势数据...</span>
      </div>
    );
  }

  // 空数据状态
  if (entries.length === 0) {
    return (
      <div className="trend-page-container">
        <div className="trend-page-header">
          {onBack && (
            <button className="trend-back-btn" onClick={onBack}>
              <IonIcon icon={arrowBackOutline} />
            </button>
          )}
          <h1>类别趋势分析</h1>
          <DateRangeSelector 
            selected={selectedRange} 
            onChange={handleRangeChange} 
            customRange={dateRange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
        <div className="trend-page-empty">
          <IonIcon icon={analyticsOutline} className="trend-page-empty-icon" />
          <p className="trend-page-empty-text">
            选定时间范围内暂无数据<br />
            开始记录时间后，这里将显示趋势图表
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trend-page-container">
      {/* 头部 */}
      <div className="trend-page-header">
        {onBack && (
          <button className="trend-back-btn" onClick={onBack}>
            <IonIcon icon={arrowBackOutline} />
          </button>
        )}
        <h1>类别趋势分析</h1>
        <DateRangeSelector 
          selected={selectedRange} 
          onChange={handleRangeChange} 
          customRange={dateRange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

        {/* 叠加面积图总览 */}
        <StackedAreaOverview
          data={categoryTrendData.data}
          categories={categoryTrendData.categoryKeys}
          className="trend-area-overview"
        />

        {/* 周度对比 */}
        {weeklyComparisonData.data.length > 0 && (
          <div className="trend-weekly-section">
            <WeeklyCategoryGroupedChart
              data={weeklyComparisonData.data}
              categories={weeklyComparisonData.categoryKeys}
            />
            <div className="trend-comparison-row">
              <div className="trend-comparison-chart-col">
                <WeeklyComparisonChart
                  data={weeklyComparisonData.data}
                  categories={weeklyComparisonData.categoryKeys}
                />
              </div>
              <div className="trend-comparison-summary-col">
                <WeeklySummary
                  data={weeklyComparisonData.data}
                  categories={weeklyComparisonData.categoryKeys}
                />
              </div>
            </div>
          </div>
        )}

      {/* 小图表网格 */}
      <div className="trend-charts-grid">
        {categoryTrendData.categoryKeys.map((cat) => (
          <SingleCategoryChart
            key={cat.id}
            categoryId={cat.id}
            categoryName={cat.name}
            categoryColor={cat.color}
            data={categoryTrendData.data}
          />
        ))}
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
    <div className="trend-filters">
      <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: '#666' }} />
      {DATE_RANGES.map(range => (
        <button
          key={range.days}
          className={`trend-range-btn ${selected === range.days ? 'active' : ''}`}
          onClick={() => onChange(range.days)}
        >
          {range.label}
        </button>
      ))}
      {selected === -1 && (
        <div className="trend-custom-range">
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

/** 总体叠加面积图 */
const StackedAreaOverview: React.FC<StackedAreaOverviewProps> = ({ data, categories, className }) => {
  const cardClass = className ? `${className} trend-chart-card` : 'trend-chart-card';

  return (
    <div className={cardClass}>
      <div className="trend-chart-header">
        <div className="trend-chart-title">总体叠加</div>
      </div>
      <div className="trend-chart-wrapper" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              stroke="#999"
              interval="preserveStartEnd"
              tickFormatter={(val) => {
                const parts = (val as string).split('/');
                return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : (val as string);
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#999"
              domain={[0, 24]}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || payload.length === 0) return null;

                const total = payload.reduce((sum, item) => sum + ((item.value as number) || 0), 0);

                return (
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.96)',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      fontSize: 12,
                      padding: 10,
                      minWidth: 180,
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>日期: {label}</div>
                    {payload.map((item) => (
                      <div key={item.dataKey} style={{ color: '#333', marginBottom: 4 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            backgroundColor: item.color,
                            borderRadius: 3,
                            marginRight: 6,
                          }}
                        />
                        {item.name}: {(item.value as number).toFixed(1)}h
                      </div>
                    ))}
                    <div style={{ marginTop: 6, color: '#111', fontWeight: 600 }}>
                      总计: {total.toFixed(1)}h
                    </div>
                  </div>
                );
              }}
            />
            {categories.map((cat) => (
              <Area
                key={cat.id}
                type="monotone"
                dataKey={cat.id}
                name={cat.name}
                stackId="1"
                stroke={cat.color}
                fill={cat.color}
                fillOpacity={0.55}
                strokeWidth={1.5}
                dot={{ r: 2, stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** 单个类别的小折线图 */
const SingleCategoryChart: React.FC<{
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  data: CategoryTrendDataPoint[];
}> = ({ categoryId, categoryName, categoryColor, data }) => {
  // 提取该类别的数据
  const chartData = data.map(d => {
    const value = (d[categoryId] as number) || 0;
    return {
      label: d.label,
      value,
      percentageOfDay: (value / 24) * 100,
    };
  });

  // 计算平均值
  const values = chartData.map(d => d.value);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title">
          <span 
            className="trend-chart-color-dot" 
            style={{ backgroundColor: categoryColor }}
          />
          {categoryName}
        </div>
        <div className="trend-chart-stats">
          <span className="trend-stat">
            总计: <strong>{total.toFixed(1)}h</strong>
          </span>
          <span className="trend-stat">
            均值: <strong>{avg.toFixed(1)}h</strong>
          </span>
        </div>
      </div>
      <div className="trend-chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 10 }} 
              stroke="#999"
              interval="preserveStartEnd"
              tickFormatter={(val) => {
                // 只显示月/日
                const parts = val.split('/');
                return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : val;
              }}
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              stroke="#999" 
              domain={[0, 24]}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || payload.length === 0) return null;
                const point = payload[0].payload as { value: number; percentageOfDay?: number };
                const percent = point.percentageOfDay ?? 0;
                return (
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.96)',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      fontSize: 12,
                      padding: 10,
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>日期: {label}</div>
                    <div style={{ color: '#333' }}>
                      {categoryName}: {point.value.toFixed(1)} 小时 ({percent.toFixed(1)}%)
                    </div>
                  </div>
                );
              }}
            />
            {/* 平均值参考线 */}
            <ReferenceLine 
              y={avg} 
              stroke={categoryColor} 
              strokeDasharray="4 4" 
              strokeOpacity={0.5}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={categoryColor}
              strokeWidth={2}
              dot={{ r: 2, fill: categoryColor, strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** 周度对比堆叠柱状图 */
const WeeklyComparisonChart: React.FC<{
  data: CategoryTrendDataPoint[];
  categories: { id: string; name: string; color: string }[];
}> = ({ data, categories }) => {
  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title">周度对比 (Weekly Comparison)</div>
      </div>
      <div className="trend-chart-wrapper" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#999" />
            <YAxis tick={{ fontSize: 12 }} stroke="#999" />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || payload.length === 0) return null;
                
                const total = payload.reduce((sum, item) => sum + ((item.value as number) || 0), 0);

                return (
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.96)',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      fontSize: 12,
                      padding: 10,
                      minWidth: 150,
                    }}
                  >
                    <div style={{ marginBottom: 6, fontWeight: 600 }}>{label}</div>
                    {payload.map((item) => (
                      <div key={item.dataKey} style={{ color: '#333', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              backgroundColor: item.color,
                              borderRadius: 2,
                              marginRight: 6,
                            }}
                          />
                          {item.name}
                        </span>
                        <span>{(item.value as number).toFixed(1)}h</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, borderTop: '1px solid #eee', paddingTop: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>总计</span>
                      <span>{total.toFixed(1)}h</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            {categories.map((cat) => (
              <Bar
                key={cat.id}
                dataKey={cat.id}
                name={cat.name}
                stackId="a"
                fill={cat.color}
                maxBarSize={50}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** 分组柱状图 (侧重单类别纵向对比) */
const WeeklyCategoryGroupedChart: React.FC<{
  data: CategoryTrendDataPoint[];
  categories: { id: string; name: string; color: string }[];
}> = ({ data, categories }) => {
  // 数据转换：从 [按周聚合] 转换为 [按类别聚合]
  // 原始数据: [{ date: 'W1', work: 10, study: 5 }, { date: 'W2', work: 12, study: 6 }]
  // 目标数据: [{ name: 'Work', w1: 10, w2: 12 }, { name: 'Study', w1: 5, w2: 6 }]
  
  const chartData = React.useMemo(() => {
    if (data.length === 0) return { transformedData: [], weekKeys: [] };
    
    // 提取周标签作为 key
    const weekKeys = data.map((d, index) => ({
      key: `week_${index}`,
      label: d.label,
      color: index === data.length - 1 ? '#3b82f6' : (index === data.length - 2 ? '#9ca3af' : '#e5e7eb')
    }));

    const transformedData = categories.map(cat => {
      const item: any = { name: cat.name, color: cat.color };
      data.forEach((d, index) => {
        item[`week_${index}`] = d[cat.id] || 0;
      });
      return item;
    });

    return { transformedData, weekKeys };
  }, [data, categories]);

  if (chartData.transformedData.length === 0) return null;

  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title">类别纵向对比 (Category Comparison)</div>
      </div>
      <div className="trend-chart-wrapper" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.transformedData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#666" />
            <YAxis tick={{ fontSize: 12 }} stroke="#999" />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || payload.length === 0) return null;

                return (
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.96)',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      fontSize: 12,
                      padding: 10,
                      minWidth: 150,
                    }}
                  >
                    <div style={{ marginBottom: 6, fontWeight: 600, color: payload[0]?.payload.color }}>{label}</div>
                    {payload.map((item, index) => (
                      <div key={item.dataKey} style={{ color: '#333', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              backgroundColor: item.color,
                              borderRadius: 2,
                              marginRight: 6,
                            }}
                          />
                          {chartData.weekKeys[index]?.label || item.name}
                        </span>
                        <span>{(item.value as number).toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }} 
            />
            {chartData.weekKeys.map((week: any) => (
              <Bar
                key={week.key}
                dataKey={week.key}
                name={week.label}
                fill={week.color}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** 周度变化摘要 */
const WeeklySummary: React.FC<{
  data: CategoryTrendDataPoint[];
  categories: { id: string; name: string; color: string }[];
}> = ({ data, categories }) => {
  if (data.length < 2) return null;

  const currentWeek = data[data.length - 1];
  const prevWeek = data[data.length - 2];

  // 计算变化
  const changes = categories.map(cat => {
    const currentVal = (currentWeek[cat.id] as number) || 0;
    const prevVal = (prevWeek[cat.id] as number) || 0;
    const diff = currentVal - prevVal;
    return {
      ...cat,
      currentVal,
      prevVal,
      diff,
      absDiff: Math.abs(diff)
    };
  }).sort((a, b) => b.absDiff - a.absDiff).slice(0, 3);

  const getDiffClass = (diff: number) => {
    if (diff > 0) return 'positive';
    if (diff < 0) return 'negative';
    return 'neutral';
  };

  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title">本周变化摘要 (vs 上周)</div>
      </div>
      <div className="trend-summary-list">
        {changes.map(item => (
          <div key={item.id} className="trend-summary-item">
            <div 
              className="trend-summary-bar" 
              style={{ backgroundColor: item.color }}
            />
            <div className="trend-summary-content">
              <div className="trend-summary-name">{item.name}</div>
              <div className="trend-summary-details">
                本周 {item.currentVal.toFixed(1)}h
                <span className="trend-summary-divider">|</span>
                上周 {item.prevVal.toFixed(1)}h
              </div>
            </div>
            <div className={`trend-summary-diff ${getDiffClass(item.diff)}`}>
              {item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)}h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendPage;
