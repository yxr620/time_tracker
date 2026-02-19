import { useState, useEffect } from 'react';
import {
  IonApp,
  IonIcon,
  IonTabBar,
  IonTabButton,
} from '@ionic/react';
import { checkmarkDoneOutline, cloudUploadOutline } from 'ionicons/icons';
import { RecordsPage } from './components/RecordsPage/RecordsPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { TrendPage } from './components/TrendPage/TrendPage';
import { GoalAnalysisPage } from './components/GoalAnalysisPage/GoalAnalysisPage';
import { ExportPage } from './components/ExportPage/ExportPage';
import recordsIcon from './assets/recordsIcon.png';
import { GoalManager } from './components/GoalManager/GoalManager';
import { useSyncStore } from './stores/syncStore';
import { isOSSConfigured } from './services/oss';
import { syncEngine } from './services/syncEngine';
import { DesktopSidebar } from './components/Desktop/DesktopSidebar';
import { getDefaultDateRange } from './services/analysis/processor';
import type { DateRange } from './types/analysis';
import './App.css';

// ─── Layout Components ─────────────────────────────────────────────

interface LayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const MobileLayout: React.FC<LayoutProps> = ({ activeTab, onTabChange, children }) => (
  <div className="app mobile-layout">
    <div className="app-header">
      <h1>Time Tracker</h1>
    </div>
    <div className="app-body">
      {children}
    </div>
    <div className="app-footer">
      <IonTabBar
        selectedTab={activeTab}
        onIonTabsDidChange={(e) => onTabChange(e.detail.tab)}
        style={{
          '--background': 'hsl(var(--background))',
          borderTop: '1px solid hsl(var(--border))'
        }}
      >
        <IonTabButton tab="records" onClick={() => onTabChange('records')}>
          <img src={recordsIcon} alt="" style={{ width: '24px', height: '24px' }} />
        </IonTabButton>
        <IonTabButton tab="goals" onClick={() => onTabChange('goals')}>
          <IonIcon icon={checkmarkDoneOutline} style={{ fontSize: '24px' }} />
        </IonTabButton>
        <IonTabButton tab="export" onClick={() => onTabChange('export')}>
          <IonIcon icon={cloudUploadOutline} style={{ fontSize: '24px' }} />
        </IonTabButton>
      </IonTabBar>
    </div>
  </div>
);

const DesktopLayout: React.FC<LayoutProps> = ({ activeTab, onTabChange, children }) => (
  <div className="app desktop-layout">
    <DesktopSidebar activeTab={activeTab} onTabChange={onTabChange} />
    <div className="desktop-main">
      <div className="desktop-header">
        <h1>Time Tracker</h1>
      </div>
      <div className="desktop-content">
        {children}
      </div>
    </div>
  </div>
);

// ─── App Component ──────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('records');
  const { checkConfig } = useSyncStore();
  const [analysisDateRange, setAnalysisDateRange] = useState<DateRange>(getDefaultDateRange());
  const [analysisSelectedRange, setAnalysisSelectedRange] = useState(30);

  // 屏幕宽度检测
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 检查 OSS 配置
  useEffect(() => {
    try {
      checkConfig();
    } catch (error) {
      console.error('[App] 检查配置失败:', error);
    }
  }, [checkConfig]);

  // 应用启动时自动 Pull
  useEffect(() => {
    const autoPullOnStartup = async () => {
      if (!isOSSConfigured()) {
        console.log('[AutoSync] OSS 未配置，跳过启动时自动 Pull');
        return;
      }
      try {
        console.log('[AutoSync] 应用启动，开始自动 Pull...');
        const pulledCount = await syncEngine.pull();
        console.log(`[AutoSync] 启动时 Pull 完成，拉取 ${pulledCount} 条操作`);
      } catch (error) {
        console.error('[AutoSync] 启动时 Pull 失败:', error);
      }
    };
    autoPullOnStartup();
  }, []);

  // 分析页面日期范围变更回调
  const handleDateRangeChange = (range: DateRange, selected: number) => {
    setAnalysisDateRange(range);
    setAnalysisSelectedRange(selected);
  };

  // 渲染页面内容
  const renderPageContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={handleDateRangeChange}
            onOpenTrend={() => setActiveTab('trend')}
            onOpenGoalAnalysis={() => setActiveTab('goalAnalysis')}
          />
        );
      case 'trend':
        return (
          <TrendPage
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={handleDateRangeChange}
            onBack={() => setActiveTab('dashboard')}
          />
        );
      case 'goalAnalysis':
        return (
          <GoalAnalysisPage
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={handleDateRangeChange}
            onBack={() => setActiveTab('dashboard')}
          />
        );
      case 'records':
        return <RecordsPage />;
      case 'goals':
        return <GoalManager />;
      case 'export':
        return <ExportPage />;
      default:
        return null;
    }
  };

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <IonApp>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPageContent()}
      </Layout>
    </IonApp>
  );
}

export default App;
