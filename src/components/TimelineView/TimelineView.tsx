import React, { useEffect, useState } from 'react';
import { useEntryStore } from '../../stores/entryStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useGoalStore } from '../../stores/goalStore';
import type { TimeEntry } from '../../services/db';
import dayjs from 'dayjs';
import { Popover } from 'antd-mobile';
import './TimelineView.css';

interface TimeBlock {
  id: string;
  startPercent: number;
  widthPercent: number;
  color: string;
  entry: TimeEntry;
  label: string;
}

interface GapBlock {
  id: string;
  startPercent: number;
  widthPercent: number;
  startTime: Date;
  endTime: Date;
}

interface TimelineViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ selectedDate, onDateChange }) => {
  const { entries, loadEntries, setNextStartTime, setTimeRange } = useEntryStore();
  const { loadCategories, getCategoryColor } = useCategoryStore();
  const { goals, loadGoals } = useGoalStore();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [gapBlocks, setGapBlocks] = useState<GapBlock[]>([]);

  useEffect(() => {
    loadEntries();
    loadCategories();
    loadGoals();
  }, [loadEntries, loadCategories, loadGoals]);

  useEffect(() => {
    processTimelineData();
  }, [entries, selectedDate]);

  // 计算时间在24小时轴上的百分比位置（基于选定日期的开始）
  const getTimePercent = (time: Date, dayStart: Date): number => {
    const diff = dayjs(time).diff(dayjs(dayStart), 'minute');
    return (diff / (24 * 60)) * 100;
  };

  // 处理时间轴数据
  const processTimelineData = () => {
    // 获取选定日期的开始和结束时间（00:00 到 23:59:59）
    const dayStart = dayjs(selectedDate).startOf('day').toDate();
    const dayEnd = dayjs(selectedDate).endOf('day').toDate();

    // 筛选选定日期范围内的记录（包括跨天的记录）
    const relevantEntries = entries.filter(entry => {
      if (!entry.endTime) return false; // 排除进行中的记录
      
      const entryStart = dayjs(entry.startTime);
      const entryEnd = dayjs(entry.endTime);
      const start = dayjs(dayStart);
      const end = dayjs(dayEnd);

      // 记录与选定日期有交集
      return entryStart.isBefore(end) && entryEnd.isAfter(start);
    });

    // 按开始时间排序
    const sortedEntries = relevantEntries.sort((a, b) => 
      dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
    );

    // 生成时间块
    const blocks: TimeBlock[] = [];
    
    sortedEntries.forEach(entry => {
      if (!entry.endTime) return;

      // 裁剪到当天范围内
      const entryStart = dayjs(entry.startTime);
      const entryEnd = dayjs(entry.endTime);
      const start = entryStart.isBefore(dayStart) ? dayjs(dayStart) : entryStart;
      const end = entryEnd.isAfter(dayEnd) ? dayjs(dayEnd) : entryEnd;

      const startPercent = getTimePercent(start.toDate(), dayStart);
      const endPercent = getTimePercent(end.toDate(), dayStart);
      const widthPercent = endPercent - startPercent;

      // 获取类别颜色（从配置文件读取）
      const color = getCategoryColor(entry.categoryId);

      // 获取目标名称
      const goal = goals.find(g => g.id === entry.goalId);
      const goalText = goal ? ` [${goal.name}]` : '';

      blocks.push({
        id: entry.id!,
        startPercent,
        widthPercent,
        color,
        entry,
        label: `${entry.activity}${goalText}`
      });
    });

    setTimeBlocks(blocks);

    // 计算时间间隙（未记录的时间段）
    const gaps: GapBlock[] = [];
    
    // 如果有记录，找出记录之间的间隙
    if (blocks.length > 0) {
      // 检查第一个记录之前是否有间隙
      if (blocks[0].startPercent > 0) {
        gaps.push({
          id: `gap-start`,
          startPercent: 0,
          widthPercent: blocks[0].startPercent,
          startTime: dayStart,
          endTime: dayjs(blocks[0].entry.startTime).isBefore(dayStart) 
            ? dayStart 
            : blocks[0].entry.startTime
        });
      }

      // 检查记录之间的间隙
      for (let i = 0; i < blocks.length - 1; i++) {
        const currentBlock = blocks[i];
        const nextBlock = blocks[i + 1];
        const gapStart = currentBlock.startPercent + currentBlock.widthPercent;
        const gapWidth = nextBlock.startPercent - gapStart;
        
        if (gapWidth > 0.1) { // 只显示明显的间隙（> 0.1%）
          const gapStartTime = dayjs(currentBlock.entry.endTime!).isAfter(dayEnd)
            ? dayEnd
            : currentBlock.entry.endTime!;
          const gapEndTime = dayjs(nextBlock.entry.startTime).isBefore(dayStart)
            ? dayStart
            : nextBlock.entry.startTime;
          
          gaps.push({
            id: `gap-${i}`,
            startPercent: gapStart,
            widthPercent: gapWidth,
            startTime: gapStartTime,
            endTime: gapEndTime
          });
        }
      }

      // 检查最后一个记录之后是否有间隙
      const lastBlock = blocks[blocks.length - 1];
      const lastBlockEnd = lastBlock.startPercent + lastBlock.widthPercent;
      if (lastBlockEnd < 100) {
        gaps.push({
          id: `gap-end`,
          startPercent: lastBlockEnd,
          widthPercent: 100 - lastBlockEnd,
          startTime: dayjs(lastBlock.entry.endTime!).isAfter(dayEnd)
            ? dayEnd
            : lastBlock.entry.endTime!,
          endTime: dayEnd
        });
      }
    } else {
      // 如果没有任何记录，整天都是间隙
      gaps.push({
        id: 'gap-full-day',
        startPercent: 0,
        widthPercent: 100,
        startTime: dayStart,
        endTime: dayEnd
      });
    }

    setGapBlocks(gaps);
  };

  // 格式化时长
  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return '进行中';
    
    const diff = dayjs(end).diff(dayjs(start), 'minute');
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // 生成时间刻度标签
  const timeLabels = [0, 6, 12, 18, 24];

  // 日期导航
  const goToPreviousDay = () => {
    onDateChange(dayjs(selectedDate).subtract(1, 'day').toDate());
  };

  const goToNextDay = () => {
    onDateChange(dayjs(selectedDate).add(1, 'day').toDate());
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');

  return (
    <div className="timeline-view">
      {/* 日期选择器 */}
      <div className="timeline-header">
        <button onClick={goToPreviousDay} className="date-nav-btn">←</button>
        <div className="date-display">
          {dayjs(selectedDate).format('YYYY-MM-DD')}
          {!isToday && (
            <button onClick={goToToday} className="today-btn">今天</button>
          )}
        </div>
        <button 
          onClick={goToNextDay} 
          className="date-nav-btn"
          disabled={isToday}
        >
          →
        </button>
      </div>

      {/* 24小时时间轴 */}
      <div className="timeline-container">
        {/* 时间刻度 */}
        <div className="timeline-labels">
          {timeLabels.map(hour => (
            <div 
              key={hour} 
              className={`timeline-label ${hour === 0 ? 'timeline-label-start' : hour === 24 ? 'timeline-label-end' : ''}`}
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* 时间轴条 */}
        <div className="timeline-bar">
          {/* 间隙时间段（灰色，可点击） */}
          {gapBlocks.map((gap) => (
            <div
              key={gap.id}
              className="timeline-gap-block"
              style={{
                left: `${gap.startPercent}%`,
                width: `${gap.widthPercent}%`
              }}
              onClick={() => {
                setTimeRange(gap.startTime, gap.endTime);
              }}
              title={`${dayjs(gap.startTime).format('HH:mm')} - ${dayjs(gap.endTime).format('HH:mm')}`}
            />
          ))}
          
          {/* 活动时间段（彩色） */}
          {timeBlocks.map((block, index) => (
            <Popover
              key={block.id}
              content={
                <div className="timeline-popover">
                  <div className="popover-activity">{block.entry.activity}</div>
                  <div className="popover-time">
                    {dayjs(block.entry.startTime).format('HH:mm')} - {dayjs(block.entry.endTime).format('HH:mm')}
                  </div>
                  <div className="popover-duration">
                    时长: {formatDuration(block.entry.startTime, block.entry.endTime)}
                  </div>
                </div>
              }
              trigger="click"
              placement="top"
            >
              <div
                className={`timeline-block ${index === 0 ? 'timeline-block-first' : ''} ${index === timeBlocks.length - 1 ? 'timeline-block-last' : ''}`}
                style={{
                  left: `${block.startPercent}%`,
                  width: `${block.widthPercent}%`,
                  backgroundColor: block.color
                }}
                title={block.label}
                onClick={() => {
                  if (block.entry.endTime) {
                    setNextStartTime(block.entry.endTime);
                  }
                }}
              />
            </Popover>
          ))}
        </div>

        {/* 当前时间指示线（只在今天显示） */}
        {isToday && (
          <div 
            className="timeline-current-time"
            style={{
              left: `${getTimePercent(new Date(), dayjs().startOf('day').toDate())}%`
            }}
          />
        )}
      </div>

      {/* 统计信息 */}
      <div className="timeline-stats">
        <span>已记录: {timeBlocks.length} 项</span>
        <span>
          总时长: {Math.round(timeBlocks.reduce((sum, block) => {
            const duration = dayjs(block.entry.endTime).diff(dayjs(block.entry.startTime), 'minute');
            return sum + duration;
          }, 0) / 60 * 10) / 10}h
        </span>
      </div>
    </div>
  );
};
