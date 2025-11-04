import React, { useState, useEffect } from 'react';
import { Button, Input, Space, Selector } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

interface ActiveTrackerProps {
  onOpenManualEntry?: () => void;
}

export const ActiveTracker: React.FC<ActiveTrackerProps> = ({ onOpenManualEntry }) => {
  const { currentEntry, startTracking, stopTracking, getLastEndTime } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();
  const [activity, setActivity] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    loadGoals();
    loadCategories();
  }, []);

  useEffect(() => {
    if (!currentEntry) {
      setElapsed('00:00:00');
      return;
    }

    const timer = setInterval(() => {
      const now = dayjs();
      const start = dayjs(currentEntry.startTime);
      const diff = now.diff(start, 'second');
      
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      
      setElapsed(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentEntry]);

  // 获取今天和昨天的目标
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  
  const todayGoals = goals.filter(g => g.date === today);
  const yesterdayGoals = goals.filter(g => g.date === yesterday);
  
  const availableGoals = [...todayGoals, ...yesterdayGoals];

  const handleStartNow = async () => {
    if (!activity.trim()) {
      return;
    }
    await startTracking(activity, selectedGoalId || undefined, undefined, selectedCategoryId || undefined);
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
  };

  const handleStartFromLast = async () => {
    if (!activity.trim()) {
      return;
    }
    const lastEndTime = getLastEndTime();
    if (lastEndTime) {
      await startTracking(activity, selectedGoalId || undefined, lastEndTime, selectedCategoryId || undefined);
    } else {
      // 如果没有上一个任务，就从当前时间开始
      await startTracking(activity, selectedGoalId || undefined, undefined, selectedCategoryId || undefined);
    }
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
  };

  const handleStop = async () => {
    await stopTracking();
  };

  if (currentEntry) {
    return (
      <div style={{ padding: '16px', background: '#f0f9ff', borderRadius: '8px' }}>
        <Space direction="vertical" style={{ width: '100%' }} block>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1677ff' }}>
            正在追踪
          </div>
          <div style={{ fontSize: '16px', marginTop: '8px' }}>
            {currentEntry.activity}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', textAlign: 'center', margin: '20px 0' }}>
            {elapsed}
          </div>
          <Button
            block
            color="danger"
            size="large"
            onClick={handleStop}
          >
            停止
          </Button>
        </Space>
      </div>
    );
  }

  const lastEndTime = getLastEndTime();

  return (
    <div style={{ padding: '16px' }}>
      <Space direction="vertical" style={{ width: '100%', '--gap': '12px' }} block>
        <Input
          placeholder="输入活动名称..."
          value={activity}
          onChange={setActivity}
          clearable
        />
        
        <div>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>类别（可选）</div>
          <Selector
            options={[
              { label: '无分类', value: '' },
              ...categories.map(c => ({
                label: c.name,
                value: c.id
              }))
            ]}
            value={[selectedCategoryId]}
            onChange={(arr) => setSelectedCategoryId(arr[0] as string)}
            style={{
              '--border-radius': '8px',
              '--border': '1px solid #d9d9d9',
              '--checked-border': '1px solid #1677ff',
              '--checked-color': '#fff',
              '--padding': '8px 12px'
            } as React.CSSProperties}
          />
        </div>
        
        <div>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>关联目标（可选）</div>
          {availableGoals.length > 0 ? (
            <Selector
              options={[
                { label: '无', value: '' },
                ...todayGoals.map(g => ({
                  label: `${g.name}`,
                  value: g.id!
                })),
                ...yesterdayGoals.map(g => ({
                  label: `${g.name} (昨天)`,
                  value: g.id!
                }))
              ]}
              value={[selectedGoalId || '']}
              onChange={(arr) => setSelectedGoalId(arr[0] === '' ? null : arr[0] as string)}
              style={{
                '--border-radius': '8px',
                '--border': '1px solid #d9d9d9',
                '--checked-border': '1px solid #1677ff',
                '--checked-color': '#fff',
                '--padding': '8px 12px'
              } as React.CSSProperties}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '13px' }}>
              今天暂无目标，请先在目标页面创建
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleStartFromLast}
            disabled={!activity.trim() || !lastEndTime}
            style={{ flex: '1.5' }}
          >
            接续上次
          </Button>
          <Button
            block
            color="default"
            size="large"
            onClick={onOpenManualEntry}
            style={{ flex: '1' }}
          >
            手动添加
          </Button>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '12px',
          color: '#999',
          marginTop: '-4px'
        }}>
          {lastEndTime && (
            <span>上次结束: {dayjs(lastEndTime).format('HH:mm')}</span>
          )}
          <span 
            onClick={handleStartNow}
            style={{ 
              color: !activity.trim() ? '#ccc' : '#1677ff',
              cursor: !activity.trim() ? 'not-allowed' : 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            从现在开始 →
          </span>
        </div>
      </Space>
    </div>
  );
};
