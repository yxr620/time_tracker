import React, { useMemo } from 'react';
import { IonIcon, IonButton } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import dayjs from 'dayjs';
import type { TimeEntry } from '../../services/db';

interface Props {
  entries: TimeEntry[];
  month: string; // YYYY-MM
  selectedDate: string; // YYYY-MM-DD
  injectionMode: 'relative' | 'absolute';
  onInjectionModeChange: (mode: 'relative' | 'absolute') => void;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNextMonth: boolean;
  canGoPrevMonth: boolean;
  isDark: boolean;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

// For absolute mode: full day (12h)
const ABSOLUTE_DENOMINATOR = 60 * 12;

// relative mode ratio is computed against either monthly max or absolute denominator,
// then scaled down further in rendering
function getFillRatio(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.min(minutes / ABSOLUTE_DENOMINATOR, 1);
}

export const TimeInjectionMatrix: React.FC<Props> = ({
  entries, month, selectedDate, injectionMode, onInjectionModeChange, onSelectDate,
  onPrevMonth, onNextMonth, canGoNextMonth, canGoPrevMonth, isDark
}) => {
  // 仅统计有关联目标的已完成记录
  const goalEntries = useMemo(() =>
    entries.filter(e => e.goalId && e.endTime && !e.deleted),
    [entries]
  );

  // Compute total goal-tracked minutes per day for the given month
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const monthStart = dayjs(month + '-01').startOf('month');
    const monthEnd = dayjs(month + '-01').endOf('month');

    goalEntries.forEach(entry => {
      const entryDay = dayjs(entry.startTime);
      if (entryDay.isBefore(monthStart, 'day') || entryDay.isAfter(monthEnd, 'day')) return;

      const date = entryDay.format('YYYY-MM-DD');
      const duration = dayjs(entry.endTime!).diff(entry.startTime, 'minute');
      if (duration > 0) {
        totals[date] = (totals[date] || 0) + duration;
      }
    });

    return totals;
  }, [goalEntries, month]);

  // Build calendar grid (Mon–Sun, with leading empties)
  const calendarDays = useMemo(() => {
    const monthStart = dayjs(month + '-01');
    const daysInMonth = monthStart.daysInMonth();
    const firstDayOfWeek = (monthStart.day() + 6) % 7; // Monday = 0

    const days: (string | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(monthStart.date(d).format('YYYY-MM-DD'));
    }
    return days;
  }, [month]);

  const today = dayjs().format('YYYY-MM-DD');
  const monthDisplay = dayjs(month + '-01').format('YYYY年M月');
  const monthMaxMinutes = useMemo(() => {
    const values = Object.values(dailyTotals);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }, [dailyTotals]);

  const cellBaseBg = isDark ? 'rgba(255,255,255,0.04)' : '#eef2f7';
  const cellStroke = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.24)';
  const injectionColor = isDark ? '#34d399' : '#10b981';

  return (
    <div style={{ paddingTop: '8px' }}>
      {/* ── Month navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <IonButton
          fill="clear" size="small" color="medium"
          onClick={onPrevMonth} disabled={!canGoPrevMonth}
          style={{ '--padding-start': '4px', '--padding-end': '4px', height: '28px', minHeight: '28px' }}
        >
          <IonIcon icon={chevronBackOutline} slot="icon-only" style={{ fontSize: '14px' }} />
        </IonButton>
        <span style={{
          fontSize: '13px', fontWeight: 600, letterSpacing: '0.3px',
          color: isDark ? '#e2e8f0' : '#334155'
        }}>
          {monthDisplay}
        </span>
        <IonButton
          fill="clear" size="small" color="medium"
          onClick={onNextMonth} disabled={!canGoNextMonth}
          style={{ '--padding-start': '4px', '--padding-end': '4px', height: '28px', minHeight: '28px' }}
        >
          <IonIcon icon={chevronForwardOutline} slot="icon-only" style={{ fontSize: '14px' }} />
        </IonButton>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            borderRadius: '10px',
            padding: '2px',
            background: isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.8)'
          }}
        >
          <IonButton
            fill={injectionMode === 'relative' ? 'solid' : 'clear'}
            size="small"
            color="primary"
            onClick={() => onInjectionModeChange('relative')}
            style={{
              '--border-radius': '8px',
              '--padding-start': '10px',
              '--padding-end': '10px',
              height: '24px',
              minHeight: '24px',
              fontSize: '11px',
              margin: 0
            }}
          >
            相对
          </IonButton>
          <IonButton
            fill={injectionMode === 'absolute' ? 'solid' : 'clear'}
            size="small"
            color="primary"
            onClick={() => onInjectionModeChange('absolute')}
            style={{
              '--border-radius': '8px',
              '--padding-start': '10px',
              '--padding-end': '10px',
              height: '24px',
              minHeight: '24px',
              fontSize: '11px',
              margin: 0
            }}
          >
            绝对
          </IonButton>
        </div>
      </div>

      {/* ── Weekday headers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '10px', fontWeight: 600,
            color: isDark ? '#475569' : '#94a3b8', lineHeight: '16px'
          }}>{d}</div>
        ))}
      </div>

      {/* ── Day cells (bottom-up injection fill) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {calendarDays.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;

          const minutes = dailyTotals[date] || 0;
          let fillRatio = 0;
          if (injectionMode === 'relative') {
            fillRatio = monthMaxMinutes > 0 ? Math.min(minutes / monthMaxMinutes, 1) : 0;
          } else {
            fillRatio = getFillRatio(minutes);
          }
          // shrink a bit to avoid touching top edge
          const scaled = fillRatio * 0.9;
          const fillHeight = `${Math.max(scaled * 100, minutes > 0 ? 8 : 0)}%`;
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const isFuture = dayjs(date).isAfter(today);
          const dayNum = dayjs(date).date();

          return (
            <div
              key={date}
              onClick={() => !isFuture && onSelectDate(date)}
              title={`${dayjs(date).format('M月D日')}: ${minutes}分钟`}
              style={{
                aspectRatio: '1',
                borderRadius: '4px',
                background: isFuture ? 'transparent' : cellBaseBg,
                border: `1px solid ${isFuture ? 'transparent' : cellStroke}`,
                outline: isSelected
                  ? '2px solid #3b82f6'
                  : isToday
                    ? `2px solid ${isDark ? '#3b82f6' : '#93c5fd'}`
                    : 'none',
                outlineOffset: '-1px',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.3 : 1,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border 0.2s, outline 0.15s',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {minutes > 0 && !isFuture && (
                <div
                  style={{
                    position: 'absolute',
                    left: '2px',
                    right: '2px',
                    bottom: '2px',
                    height: fillHeight,
                    borderRadius: '2px',
                    background: injectionColor,
                    opacity: 0.28 + fillRatio * 0.62,
                    transition: 'height 0.25s ease, opacity 0.25s ease'
                  }}
                />
              )}

              <span style={{
                position: 'relative',
                zIndex: 1,
                fontSize: '11px',
                fontWeight: isSelected || isToday ? 700 : 400,
                lineHeight: 1,
                color: isSelected
                  ? '#3b82f6'
                  : isFuture
                    ? (isDark ? '#1e293b' : '#d1d5db')
                    : fillRatio > 0.72
                      ? (isDark ? '#ecfdf5' : '#ffffff')
                      : (isDark ? '#94a3b8' : '#374151')
              }}>
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: '3px', marginTop: '8px', paddingBottom: '2px',
        fontSize: '10px',
        color: isDark ? '#475569' : '#94a3b8'
      }}>
        <span>少</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <div key={i} style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: cellBaseBg,
            border: `1px solid ${cellStroke}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {ratio > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: `${ratio * 100}%`,
                background: injectionColor,
                opacity: 0.28 + ratio * 0.62
              }} />
            )}
          </div>
        ))}
        <span>多</span>
        <span style={{ marginLeft: '4px' }}>
          {injectionMode === 'relative' ? '按月相对' : '按绝对时长'}
        </span>
      </div>
    </div>
  );
};
