import React from 'react';
import { ActiveTracker } from '../TimeTracker/ActiveTracker';
import { ManualEntry } from '../TimeTracker/ManualEntry';
import { EntryList } from '../EntryList/EntryList';

export const RecordsPage: React.FC = () => {
  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* 顶部：计时器区域 */}
      <div style={{ padding: '16px', paddingBottom: '8px' }}>
        <ActiveTracker />
      </div>

      {/* 手动添加按钮 */}
      <div style={{ padding: '0 16px 8px' }}>
        <ManualEntry />
      </div>

      {/* 记录列表 */}
      <div>
        <EntryList />
      </div>
    </div>
  );
};
