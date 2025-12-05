import React, { useState, useEffect, useCallback } from 'react';
import { IonSpinner, IonIcon } from '@ionic/react';
import { calendarOutline, analyticsOutline, arrowBackOutline } from 'ionicons/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { subDays } from 'date-fns';
import {
  loadRawData,
  processEntries,
  groupByDayAndCategory,
  getDefaultDateRange,
} from '../../services/analysis/processor';
import type { ProcessedEntry, CategoryTrendDataPoint, DateRange } from '../../types/analysis';
import './TrendPage.css';

// 预设时间范围选项
const DATE_RANGES = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
  { label: '自定义', days: -1 },
];

// 类别趋势数据类型
interface CategoryTrendData {
  data: CategoryTrendDataPoint[];
  categoryKeys: { id: string; name: string; color: string }[];
}

interface TrendPageProps {
  onBack?: () => void;
}

export const TrendPage: React.FC<TrendPageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRange, setSelectedRange] = useState(30);
  
  // 数据状态
  const [entries, setEntries] = useState<ProcessedEntry[]>([]);
  const [categoryTrendData, setCategoryTrendData] = useState<CategoryTrendData>({ data: [], categoryKeys: [] });

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: rawEntries, goals, categories } = await loadRawData({
        dateRange,
      });
      
      const processed = processEntries(rawEntries, goals, categories);
      setEntries(processed);
      setCategoryTrendData(groupByDayAndCategory(processed, dateRange));
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
      setDateRange({ start, end });
    }
  };

  // 处理自定义日期范围变更
  const handleCustomRangeChange = (range: DateRange) => {
    setDateRange(range);
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

/** 单个类别的小折线图 */
const SingleCategoryChart: React.FC<{
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  data: CategoryTrendDataPoint[];
}> = ({ categoryId, categoryName, categoryColor, data }) => {
  // 提取该类别的数据
  const chartData = data.map(d => ({
    label: d.label,
    value: (d[categoryId] as number) || 0,
  }));

  // 计算平均值
  const values = chartData.map(d => d.value);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const max = Math.max(...values, 0);
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
              domain={[0, Math.max(max * 1.2, 1)]}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)} 小时`, categoryName]}
              labelFormatter={(label) => `日期: ${label}`}
              contentStyle={{ 
                backgroundColor: 'rgba(255,255,255,0.96)', 
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                fontSize: 12,
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

export default TrendPage;
