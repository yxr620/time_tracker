import React, { useRef } from 'react';
import { ActiveTracker } from '../TimeTracker/ActiveTracker';
import { ManualEntry } from '../TimeTracker/ManualEntry';
import { EntryList } from '../EntryList/EntryList';

export const RecordsPage: React.FC = () => {
  const manualEntryRef = useRef<{ open: () => void }>(null);

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* 顶部：计时器区域 */}
      <div style={{ padding: '16px', paddingBottom: '8px' }}>
        <ActiveTracker onOpenManualEntry={() => manualEntryRef.current?.open()} />
      </div>

      {/* 手动添加组件（隐藏按钮） */}
      <ManualEntry ref={manualEntryRef} hideButton />

      {/* 记录列表 */}
      <div>
        <EntryList />
      </div>
    </div>
  );
};
