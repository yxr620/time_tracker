import React, { useState } from 'react';
import { SleepBackfillTab } from './SleepBackfillTab';
import { DataValidationTab } from './DataValidationTab';
import './MaintenancePage.css';

export const MaintenancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sleep' | 'validation'>('sleep');

  return (
    <div className="maintenance-page">
      <div className="maintenance-tab-bar">
        <button
          className={`maintenance-tab-btn ${activeTab === 'sleep' ? 'active' : ''}`}
          onClick={() => setActiveTab('sleep')}
        >
          睡觉补录
        </button>
        <button
          className={`maintenance-tab-btn ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          数据校验
        </button>
      </div>
      {activeTab === 'sleep' ? <SleepBackfillTab /> : <DataValidationTab />}
    </div>
  );
};
