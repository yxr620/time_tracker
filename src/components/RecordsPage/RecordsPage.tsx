import React, { useState } from 'react';
import { TimeEntryForm } from '../TimeTracker/TimeEntryForm';
import { TimelineView } from '../TimelineView/TimelineView';
import { EntryList } from '../EntryList/EntryList';

export const RecordsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div style={{ 
      paddingBottom: '80px', 
      overflow: 'hidden', 
      width: '100%',
      touchAction: 'pan-y' /* 只允许垂直滑动 */
    }}>
      {/* 顶部：时间记录表单 */}
      <div style={{ padding: '6px', paddingBottom: '6px' }}>
        <TimeEntryForm />
      </div>

      {/* 24小时时间轴可视化 */}
      <TimelineView selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* 当日记录列表 */}
      <div>
        <EntryList selectedDate={selectedDate} />
      </div>
    </div>
  );
};
