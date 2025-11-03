import React, { useEffect, useState } from 'react';
import { List, SwipeAction, Tag } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import type { TimeEntry } from '../../services/db';
import { EditEntryDialog } from './EditEntryDialog';
import dayjs from 'dayjs';

export const EntryList: React.FC = () => {
  const { entries, loadEntries, deleteEntry, updateEntry } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    loadEntries();
    loadGoals();
  }, [loadEntries, loadGoals]);

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

  // 根据goalId获取目标名称
  const getGoalName = (goalId: string | null) => {
    if (!goalId) return null;
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || null;
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
                key: 'edit',
                text: '编辑',
                color: 'primary',
                onClick: () => {
                  setEditingEntry(entry);
                }
              },
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
                  {getGoalName(entry.goalId) && (
                    <div style={{ marginTop: '4px' }}>
                      <Tag color="primary" fill="outline" style={{ fontSize: '12px' }}>
                        {getGoalName(entry.goalId)}
                      </Tag>
                    </div>
                  )}
                </div>
              }
            >
              {entry.activity}
            </List.Item>
          </SwipeAction>
        ))}
      </List>

      <EditEntryDialog
        entry={editingEntry}
        visible={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        onSave={async (id, updates) => {
          await updateEntry(id, updates);
          setEditingEntry(null);
        }}
      />
    </div>
  );
};
