import React, { useEffect } from 'react';
import { List, SwipeAction } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import dayjs from 'dayjs';

export const EntryList: React.FC = () => {
  const { entries, loadEntries, deleteEntry } = useEntryStore();

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return '进行中';
    
    const diff = dayjs(end).diff(dayjs(start), 'minute');
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ padding: '0 16px 8px', fontWeight: 'bold', fontSize: '16px' }}>
        记录列表
      </div>
      <List>
        {entries.map(entry => (
          <SwipeAction
            key={entry.id}
            rightActions={[
              {
                key: 'delete',
                text: '删除',
                color: 'danger',
                onClick: async () => {
                  if (entry.id && window.confirm('确定要删除这条记录吗？')) {
                    await deleteEntry(entry.id);
                  }
                }
              }
            ]}
          >
            <List.Item
              description={
                <div>
                  <div>{dayjs(entry.startTime).format('HH:mm')} - {entry.endTime ? dayjs(entry.endTime).format('HH:mm') : '进行中'}</div>
                  <div style={{ color: '#999', fontSize: '12px' }}>
                    {formatDuration(entry.startTime, entry.endTime)}
                  </div>
                </div>
              }
            >
              {entry.activity}
            </List.Item>
          </SwipeAction>
        ))}
      </List>
    </div>
  );
};
