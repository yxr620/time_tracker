import React, { useState } from 'react';
import { TimeEntryForm } from '../TimeTracker/TimeEntryForm';
import { TimelineView } from '../TimelineView/TimelineView';
import { EntryList } from '../EntryList/EntryList';
import './RecordsPage.css';

export const RecordsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="records-page">
      {/* 顶部：时间记录表单 */}
      <div className="records-section form-section">
        <TimeEntryForm />
      </div>

      {/* 24小时时间轴可视化 */}
      <div className="records-section">
        <TimelineView selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {/* 当日记录列表 */}
      <div className="records-section">
        <EntryList selectedDate={selectedDate} />
      </div>
    </div>
  );
};
