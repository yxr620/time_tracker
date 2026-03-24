import React, { useEffect, useState, useRef } from 'react';
import { useEntryStore } from '../../stores/entryStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useGoalStore } from '../../stores/goalStore';
import type { TimeEntry } from '../../services/db';
import dayjs from 'dayjs';
import { IonDatetime, IonModal, IonContent } from '@ionic/react';
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
  const { entries, loadEntries, setNextStartTime, setTimeRange, getEarliestEntryDate } = useEntryStore();
  const { loadCategories, getCategoryColor } = useCategoryStore();
  const { goals, loadGoals } = useGoalStore();
  const earliestDate = getEarliestEntryDate();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [gapBlocks, setGapBlocks] = useState<GapBlock[]>([]);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tooltip, setTooltip] = useState<{ block: TimeBlock; positionPercent: number } | null>(null);
  const datetimeRef = useRef<HTMLIonDatetimeElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEntries();
    loadCategories();
    loadGoals();
  }, [loadEntries, loadCategories, loadGoals]);

  // 点击外部关闭 tooltip
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltip && containerRef.current) {
        const target = e.target as HTMLElement;
        if (!containerRef.current.contains(target)) {
          setTooltip(null);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [tooltip]);

  useEffect(() => {
    processTimelineData();
  }, [entries, selectedDate]);

  const getTimePercent = (time: Date, dayStart: Date): number => {
    const diff = dayjs(time).diff(dayjs(dayStart), 'minute');
    return (diff / (24 * 60)) * 100;
  };

  const processTimelineData = () => {
    const dayStart = dayjs(selectedDate).startOf('day').toDate();
    const dayEnd = dayjs(selectedDate).endOf('day').toDate();

    const relevantEntries = entries.filter(entry => {
      if (!entry.endTime) return false;
      const entryStart = dayjs(entry.startTime);
      const entryEnd = dayjs(entry.endTime);
      return entryStart.isBefore(dayEnd) && entryEnd.isAfter(dayStart);
    });

    const sortedEntries = relevantEntries.sort((a, b) =>
      dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
    );

    const blocks: TimeBlock[] = [];

    sortedEntries.forEach(entry => {
      if (!entry.endTime) return;

      const entryStart = dayjs(entry.startTime);
      const entryEnd = dayjs(entry.endTime);
      const start = entryStart.isBefore(dayStart) ? dayjs(dayStart) : entryStart;
      const end = entryEnd.isAfter(dayEnd) ? dayjs(dayEnd) : entryEnd;

      const startPercent = getTimePercent(start.toDate(), dayStart);
      const endPercent = getTimePercent(end.toDate(), dayStart);
      const widthPercent = endPercent - startPercent;

      const color = getCategoryColor(entry.categoryId);
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

    const gaps: GapBlock[] = [];

    if (blocks.length > 0) {
      if (blocks[0].startPercent > 0) {
        gaps.push({
          id: 'gap-start',
          startPercent: 0,
          widthPercent: blocks[0].startPercent,
          startTime: dayStart,
          endTime: dayjs(blocks[0].entry.startTime).isBefore(dayStart)
            ? dayStart
            : blocks[0].entry.startTime
        });
      }

      for (let i = 0; i < blocks.length - 1; i++) {
        const cur = blocks[i];
        const next = blocks[i + 1];
        const gapStart = cur.startPercent + cur.widthPercent;
        const gapWidth = next.startPercent - gapStart;

        if (gapWidth > 0.1) {
          const gapStartTime = dayjs(cur.entry.endTime!).isAfter(dayEnd)
            ? dayEnd
            : cur.entry.endTime!;
          const gapEndTime = dayjs(next.entry.startTime).isBefore(dayStart)
            ? dayStart
            : next.entry.startTime;

          gaps.push({
            id: `gap-${i}`,
            startPercent: gapStart,
            widthPercent: gapWidth,
            startTime: gapStartTime,
            endTime: gapEndTime
          });
        }
      }

      const last = blocks[blocks.length - 1];
      const lastEnd = last.startPercent + last.widthPercent;
      if (lastEnd < 100) {
        gaps.push({
          id: 'gap-end',
          startPercent: lastEnd,
          widthPercent: 100 - lastEnd,
          startTime: dayjs(last.entry.endTime!).isAfter(dayEnd) ? dayEnd : last.entry.endTime!,
          endTime: dayEnd
        });
      }
    } else {
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

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return '进行中';
    const diff = dayjs(end).diff(dayjs(start), 'minute');
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const totalHours = Math.round(
    timeBlocks.reduce((sum, b) => {
      return sum + dayjs(b.entry.endTime).diff(dayjs(b.entry.startTime), 'minute');
    }, 0) / 60 * 10
  ) / 10;

  const timeLabels = [0, 6, 12, 18, 24];

  const earliestDayJs = earliestDate ? dayjs(earliestDate) : null;
  const isEarliestDay = earliestDayJs
    ? dayjs(selectedDate).isSame(earliestDayJs, 'day') || dayjs(selectedDate).isBefore(earliestDayJs, 'day')
    : false;

  const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');

  const goToPreviousDay = () => {
    if (isEarliestDay) return;
    onDateChange(dayjs(selectedDate).subtract(1, 'day').toDate());
  };

  const goToNextDay = () => {
    onDateChange(dayjs(selectedDate).add(1, 'day').toDate());
  };

  const goToToday = () => onDateChange(new Date());

  return (
    <div className="timeline-view">
      {/* 日期导航 + 统计信息：合并一行 */}
      <div className="timeline-header">
        <div className="timeline-header-left">
          <button onClick={goToPreviousDay} className="date-nav-btn" disabled={isEarliestDay}>‹</button>
          <div
            className="date-display date-display-clickable"
            onClick={() => setDatePickerVisible(true)}
          >
            {dayjs(selectedDate).format('YYYY-MM-DD')}
            {!isToday && (
              <button
                onClick={(e) => { e.stopPropagation(); goToToday(); }}
                className="today-btn"
              >
                今天
              </button>
            )}
          </div>
          <button onClick={goToNextDay} className="date-nav-btn" disabled={isToday}>›</button>
        </div>

        <div className="timeline-header-stats">
          <span>{timeBlocks.length} 项</span>
          <span className="stat-sep">·</span>
          <span>{totalHours}h</span>
        </div>
      </div>

      {/* 日期选择弹窗 */}
      <IonModal
        isOpen={datePickerVisible}
        onDidDismiss={() => setDatePickerVisible(false)}
        initialBreakpoint={0.55}
        breakpoints={[0, 0.55, 0.7]}
      >
        <IonContent className="ion-padding">
          <IonDatetime
            ref={datetimeRef}
            presentation="date"
            value={dayjs(selectedDate).format('YYYY-MM-DD')}
            min={earliestDate || undefined}
            max={dayjs().format('YYYY-MM-DD')}
            locale="zh-CN"
            firstDayOfWeek={1}
            onIonChange={(e) => {
              const value = e.detail.value;
              if (value) {
                const dateStr = typeof value === 'string' ? value : value[0];
                onDateChange(dayjs(dateStr).toDate());
              }
              setDatePickerVisible(false);
            }}
            style={{ width: '100%', margin: '0 auto' }}
          />
        </IonContent>
      </IonModal>

      {/* 时间轴 */}
      <div
        ref={containerRef}
        className="timeline-container"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('.timeline-block')) {
            setTooltip(null);
          }
        }}
      >
        {/* 时间轴条 */}
        <div className="timeline-bar">
          {gapBlocks.map((gap) => (
            <div
              key={gap.id}
              className="timeline-gap-block"
              style={{ left: `${gap.startPercent}%`, width: `${gap.widthPercent}%` }}
              onClick={() => setTimeRange(gap.startTime, gap.endTime)}
              title={`${dayjs(gap.startTime).format('HH:mm')} - ${dayjs(gap.endTime).format('HH:mm')}`}
            />
          ))}

          {timeBlocks.map((block) => (
            <div
              key={block.id}
              className="timeline-block"
              style={{
                left: `${block.startPercent}%`,
                width: `${block.widthPercent}%`,
                backgroundColor: block.color
              }}
              title={block.label}
              onClick={() => {
                const centerPercent = block.startPercent + block.widthPercent / 2;
                setTooltip({ block, positionPercent: centerPercent });
                if (block.entry.endTime) {
                  setNextStartTime(block.entry.endTime);
                }
              }}
            />
          ))}

        </div>

        {/* 当前时间指示线 — 覆盖在 bar+labels 上，不受 bar overflow:hidden 约束 */}
        {isToday && (
          <div
            className="timeline-current-time"
            style={{ left: `${getTimePercent(new Date(), dayjs().startOf('day').toDate())}%` }}
          />
        )}

        {/* 时间刻度 — bar 下方 */}
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

        {/* Tooltip — 出现在 labels 下方，不会被裁切 */}
        <div className="timeline-tooltip-area">
          {tooltip && (
            <div
              className={`timeline-tooltip ${
                tooltip.positionPercent < 15 ? 'tooltip-align-left' :
                tooltip.positionPercent > 85 ? 'tooltip-align-right' : ''
              }`}
              style={{ left: `${Math.max(5, Math.min(95, tooltip.positionPercent))}%` }}
            >
              <div className="tooltip-activity">{tooltip.block.entry.activity}</div>
              <div className="tooltip-time">
                {dayjs(tooltip.block.entry.startTime).format('HH:mm')} –{' '}
                {dayjs(tooltip.block.entry.endTime).format('HH:mm')}{' '}
                ({formatDuration(tooltip.block.entry.startTime, tooltip.block.entry.endTime)})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
