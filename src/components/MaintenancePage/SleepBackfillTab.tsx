import React, { useState } from 'react';
import dayjs from 'dayjs';
import { dataService, type SleepCandidate } from '../../services/dataService';
import { useEntryStore } from '../../stores/entryStore';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

export const SleepBackfillTab: React.FC = () => {
  // Config state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sleepStart, setSleepStart] = useState(22);
  const [sleepEnd, setSleepEnd] = useState(10);
  const [minHours, setMinHours] = useState(1);

  // Result state
  const [candidates, setCandidates] = useState<SleepCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'config' | 'preview' | 'done'>('config');
  const [isLoading, setIsLoading] = useState(false);

  const { loadEntries } = useEntryStore();

  const handleScan = async () => {
    setIsLoading(true);
    try {
      const results = await dataService.entries.findSleepGaps({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sleepWindowStart: sleepStart,
        sleepWindowEnd: sleepEnd,
        minDurationMinutes: minHours * 60,
      });
      setCandidates(results);
      setSelected(new Set(results.map((_, i) => i)));
      setPhase('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((_, i) => i)));
    }
  };

  const handleConfirm = async () => {
    const toAdd = candidates.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) return;

    const confirmed = window.confirm(`将补录 ${toAdd.length} 条睡觉记录，是否继续？`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await dataService.entries.batchAdd(
        toAdd.map(gap => ({
          startTime: gap.start,
          endTime: gap.end,
          activity: '睡觉',
          categoryId: 'rest',
          goalId: null,
        }))
      );
      await loadEntries();
      setPhase('done');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCandidates([]);
    setSelected(new Set());
    setPhase('config');
  };

  if (isLoading) {
    return <div className="maintenance-loading">扫描中...</div>;
  }

  if (phase === 'config') {
    return (
      <div className="sleep-config">
        <label>
          起始日期 (留空=全部历史)
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </label>
        <label>
          结束日期 (留空=今天)
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </label>
        <div className="config-row">
          <label>
            睡眠窗口开始 (时)
            <input
              type="number"
              min={0}
              max={23}
              value={sleepStart}
              onChange={e => setSleepStart(Number(e.target.value))}
            />
          </label>
          <label>
            睡眠窗口结束 (时)
            <input
              type="number"
              min={0}
              max={23}
              value={sleepEnd}
              onChange={e => setSleepEnd(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          最小时长 (小时)
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={minHours}
            onChange={e => setMinHours(Number(e.target.value))}
          />
        </label>
        <button className="maintenance-btn maintenance-btn-primary" onClick={handleScan}>
          扫描
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="maintenance-done">
        <p>补录完成</p>
        <button className="maintenance-btn maintenance-btn-secondary" onClick={handleReset}>
          重新扫描
        </button>
      </div>
    );
  }

  // phase === 'preview'
  const selectedCount = selected.size;

  return (
    <div>
      <div className="candidate-summary">
        找到 {candidates.length} 个睡眠候选时段，已选中 {selectedCount} 个
      </div>
      <div className="candidate-actions">
        <button className="maintenance-btn maintenance-btn-secondary" onClick={toggleAll}>
          {selected.size === candidates.length ? '取消全选' : '全选'}
        </button>
        <button className="maintenance-btn maintenance-btn-secondary" onClick={handleReset}>
          返回
        </button>
      </div>
      <div className="candidate-list">
        {candidates.map((c, i) => (
          <div
            key={i}
            className={`candidate-item ${c.isFullDayEmpty ? 'full-day-empty' : ''}`}
            onClick={() => toggleSelect(i)}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggleSelect(i)}
              onClick={e => e.stopPropagation()}
            />
            <span>
              {c.date}&nbsp;&nbsp;
              {dayjs(c.start).format('HH:mm')} → {dayjs(c.end).format('HH:mm')}&nbsp;&nbsp;
              ({formatDuration(c.durationMinutes)})
              {c.isFullDayEmpty && ' [整天空白]'}
            </span>
          </div>
        ))}
      </div>
      {candidates.length > 0 && (
        <div className="candidate-actions">
          <button
            className="maintenance-btn maintenance-btn-primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            确认补录 ({selectedCount})
          </button>
        </div>
      )}
    </div>
  );
};
