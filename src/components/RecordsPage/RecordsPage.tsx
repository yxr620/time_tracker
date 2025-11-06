import React, { useRef, useState } from 'react';
import { ActiveTracker } from '../TimeTracker/ActiveTracker';
import { ManualEntry } from '../TimeTracker/ManualEntry';
import { TimelineView } from '../TimelineView/TimelineView';
import { EntryList } from '../EntryList/EntryList';

export const RecordsPage: React.FC = () => {
  const manualEntryRef = useRef<{ open: () => void }>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div style={{ 
      paddingBottom: '80px', 
      overflow: 'hidden', 
      width: '100%',
      touchAction: 'pan-y' /* 只允许垂直滑动 */
    }}>
      {/* 顶部：计时器区域 */}
      <div style={{ padding: '16px', paddingBottom: '8px' }}>
        <ActiveTracker onOpenManualEntry={() => manualEntryRef.current?.open()} />
      </div>

      {/* 手动添加组件（隐藏按钮） */}
      <ManualEntry ref={manualEntryRef} hideButton />

      {/* 24小时时间轴可视化 */}
      <TimelineView selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* 当日记录列表 */}
      <div>
        <EntryList selectedDate={selectedDate} />
      </div>
    </div>
  );
};
