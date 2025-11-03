import React, { useState, useEffect } from 'react';
import { Button, Input, Space } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export const ActiveTracker: React.FC = () => {
  const { currentEntry, startTracking, stopTracking, getLastEndTime } = useEntryStore();
  const [activity, setActivity] = useState('');
  const [elapsed, setElapsed] = useState('00:00:00');

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

  const handleStartNow = async () => {
    if (!activity.trim()) {
      return;
    }
    await startTracking(activity);
    setActivity('');
  };

  const handleStartFromLast = async () => {
    if (!activity.trim()) {
      return;
    }
    const lastEndTime = getLastEndTime();
    if (lastEndTime) {
      await startTracking(activity, undefined, lastEndTime);
    } else {
      // 如果没有上一个任务，就从当前时间开始
      await startTracking(activity);
    }
    setActivity('');
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
      <Space direction="vertical" style={{ width: '100%' }} block>
        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
          开始新的追踪
        </div>
        <Input
          placeholder="输入活动名称..."
          value={activity}
          onChange={setActivity}
          clearable
        />
        <Space direction="horizontal" style={{ width: '100%' }} block>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleStartNow}
            disabled={!activity.trim()}
            style={{ flex: 1 }}
          >
            从现在开始
          </Button>
          <Button
            block
            color="default"
            size="large"
            onClick={handleStartFromLast}
            disabled={!activity.trim() || !lastEndTime}
            style={{ flex: 1 }}
          >
            接续上次
          </Button>
        </Space>
        {lastEndTime && (
          <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
            上次结束时间: {dayjs(lastEndTime).format('HH:mm')}
          </div>
        )}
      </Space>
    </div>
  );
};
