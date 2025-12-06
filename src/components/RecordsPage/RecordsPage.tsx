import React, { useMemo } from 'react';
import { TimeEntryForm } from '../TimeTracker/TimeEntryForm';
import { TimelineView } from '../TimelineView/TimelineView';
import { EntryList } from '../EntryList/EntryList';
import { useDateStore } from '../../stores/dateStore';
import dayjs from 'dayjs';
import './RecordsPage.css';

export const RecordsPage: React.FC = () => {
  const selectedDateStr = useDateStore(state => state.selectedDate);
  const setSelectedDate = useDateStore(state => state.setSelectedDate);

  const selectedDate = useMemo(() => dayjs(selectedDateStr).toDate(), [selectedDateStr]);

  return (
    <div className="records-page">
      {/* 顶部：时间记录表单 */}
      <div className="records-section form-section">
        <TimeEntryForm />
      </div>

      {/* 24小时时间轴可视化 */}
      <div className="records-section">
        <TimelineView selectedDate={selectedDate} onDateChange={(date) => setSelectedDate(date)} />
      </div>

      {/* 当日记录列表 */}
      <div className="records-section">
        <EntryList selectedDate={selectedDate} />
      </div>
    </div>
  );
};
