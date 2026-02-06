import React, { useEffect, useState, useMemo } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonButton
} from '@ionic/react';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import type { TimeEntry } from '../../services/db';
import { EditEntryDialog } from './EditEntryDialog';
import dayjs from 'dayjs';
import './EntryList.css';

interface EntryListProps {
  selectedDate?: Date;
}

export const EntryList: React.FC<EntryListProps> = ({ selectedDate }) => {
  const { entries, loadEntries, deleteEntry, updateEntry, setNextStartTime } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const { loadCategories, getCategoryName } = useCategoryStore();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadEntries();
    loadGoals();
    loadCategories();
  }, [loadEntries, loadGoals, loadCategories]);

  // 筛选记录：选定日期或全部
  const displayEntries = useMemo(() => {
    if (showAll || !selectedDate) {
      return entries;
    }

    // 获取选定日期的开始和结束时间
    const dayStart = dayjs(selectedDate).startOf('day');
    const dayEnd = dayjs(selectedDate).endOf('day');

    // 只显示选定日期的记录（包括跨天的记录）
    return entries.filter(entry => {
      const entryStart = dayjs(entry.startTime);
      const entryEnd = entry.endTime ? dayjs(entry.endTime) : dayjs();

      // 记录与选定日期有交集
      return entryStart.isBefore(dayEnd) && entryEnd.isAfter(dayStart);
    });
  }, [entries, selectedDate, showAll]);

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return '进行中';

    const diff = dayjs(end).diff(dayjs(start), 'minute');
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (hours > 0) {
      return `${hours}小时${minutes} 分钟`;
    }
    return `${minutes} 分钟`;
  };

  // 根据goalId获取目标名称
  const getGoalName = (goalId: string | null) => {
    if (!goalId) return null;
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || null;
  };

  // 判断是否是今天
  const isToday = selectedDate ? dayjs(selectedDate).isSame(dayjs(), 'day') : true;

  // 格式化显示日期
  const getDateLabel = () => {
    if (!selectedDate) return '记录列表';
    if (showAll) return '全部记录';

    if (isToday) {
      return '当日记录';
    }

    return `当日记录(${dayjs(selectedDate).format('MM-DD')})`;
  };

  return (
    <div className="entry-list-container">
      <div className="entry-list-header">
        <span>{getDateLabel()}</span>
        {selectedDate && !showAll && entries.length > displayEntries.length && (
          <IonButton
            size="small"
            fill="clear"
            onClick={() => setShowAll(true)}
            style={{ fontSize: '14px' }}
          >
            全部记录 ({entries.length})
          </IonButton>
        )}
        {selectedDate && showAll && (
          <IonButton
            size="small"
            fill="clear"
            onClick={() => setShowAll(false)}
            style={{ fontSize: '14px' }}
          >
            仅当日
          </IonButton>
        )}
      </div>

      {displayEntries.length === 0 ? (
        <div className="entry-list-empty">
          {selectedDate && !showAll ? '当日还没有记录' : '暂无记录'}
        </div>
      ) : (
        <IonList>
          {displayEntries.map(entry => (
            <IonItemSliding key={`${entry.id}-${dayjs(entry.updatedAt).valueOf()}`}>
              <IonItem
                lines="none"
                button
                onClick={() => {
                  if (entry.endTime) {
                    setNextStartTime(entry.endTime);
                  }
                }}
              >
                <IonLabel>
                  <h2 className="entry-item-title">
                    {entry.activity}
                  </h2>
                  <div className="entry-item-details">
                    <span>{dayjs(entry.startTime).format('HH:mm')}-{entry.endTime ? dayjs(entry.endTime).format('HH:mm') : '进行中'}</span>
                    <span>·</span>
                    <span>{formatDuration(entry.startTime, entry.endTime)}</span>
                    <span>·</span>
                    <span className="entry-category-badge">
                      {getCategoryName(entry.categoryId) || '未分类'}
                    </span>
                    {getGoalName(entry.goalId) && (
                      <span className="entry-goal-badge">
                        {getGoalName(entry.goalId)}
                      </span>
                    )}
                  </div>
                </IonLabel>
              </IonItem>

              <IonItemOptions side="end">
                <IonItemOption
                  color="primary"
                  onClick={() => setEditingEntry(entry)}
                >
                  编辑
                </IonItemOption>
                <IonItemOption
                  color="danger"
                  onClick={async () => {
                    if (entry.id && window.confirm('确定要删除这条记录吗？')) {
                      await deleteEntry(entry.id);
                    }
                  }}
                >
                  删除
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>
      )}

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
