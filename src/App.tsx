import { useState, useRef, useEffect } from 'react';
import {
  IonApp,
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonButton,
  useIonToast,
  useIonAlert,
  IonSpinner
} from '@ionic/react';
import { checkmarkDoneOutline, cloudUploadOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { useDarkMode } from './hooks/useDarkMode';
import { RecordsPage } from './components/RecordsPage/RecordsPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { TrendPage } from './components/TrendPage/TrendPage';
import { GoalAnalysisPage } from './components/GoalAnalysisPage/GoalAnalysisPage';
import recordsIcon from './assets/recordsIcon.png';
import { GoalManager } from './components/GoalManager/GoalManager';
import { SyncManagementPage } from './components/SyncManagementPage/SyncManagementPage';
import { exportFullJSON, exportIncrementalJSON, importFromJSON, ImportStrategy } from './services/export';
import { useSyncStore } from './stores/syncStore';
import { isOSSConfigured } from './services/oss';
import { DesktopSidebar } from './components/Desktop/DesktopSidebar';
import { getDefaultDateRange } from './services/analysis/processor';
import type { DateRange } from './types/analysis';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('records');
  const [importStrategy, setImportStrategy] = useState<typeof ImportStrategy.MERGE | typeof ImportStrategy.REPLACE>(ImportStrategy.MERGE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { checkConfig } = useSyncStore();
  const [analysisDateRange, setAnalysisDateRange] = useState<DateRange>(getDefaultDateRange());
  const [analysisSelectedRange, setAnalysisSelectedRange] = useState(30);
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [isLoading, setIsLoading] = useState(false);
  const { isDark, toggle } = useDarkMode();

  // 简单的屏幕宽度检测
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
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

  const showToast = (message: string, color: 'success' | 'danger' | 'warning' = 'success', duration = 2000) => {
    presentToast({
      message,
      duration,
      position: 'top',
      color
    });
  };

  const handleExportFullJSON = async () => {
    try {
      setIsLoading(true);
      showToast('正在导出全量数据...', 'warning', 0);
      await exportFullJSON();
      showToast('全量导出成功', 'success');
    } catch (error) {
      showToast('导出失败，请重试', 'danger');
      console.error('Export Full JSON failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportIncrementalJSON = async () => {
    try {
      setIsLoading(true);
      showToast('正在导出增量数据...', 'warning', 0);
      await exportIncrementalJSON();
      showToast('增量导出成功', 'success');
    } catch (error) {
      showToast('导出失败，请重试', 'danger');
      console.error('Export Incremental JSON failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJSON = async () => {
    try {
      const { db } = await import('./services/db');
      const entries = await db.entries.toArray();
      const dataStr = JSON.stringify(entries, null, 2);

      await navigator.clipboard.writeText(dataStr);
      showToast('JSON数据已复制到剪贴板', 'success');
    } catch (error) {
      showToast('复制失败', 'danger');
      console.error('Copy JSON failed:', error);
    }
  };

  const handleImportClick = () => {
    presentAlert({
      header: '选择导入策略',
      message: '请选择数据导入策略',
      buttons: [
        {
          text: '取消',
          role: 'cancel'
        },
        {
          text: '合并导入（推荐）',
          handler: () => {
            setImportStrategy(ImportStrategy.MERGE);
            setTimeout(() => fileInputRef.current?.click(), 100);
          }
        },
        {
          text: '替换导入',
          role: 'destructive',
          handler: () => {
            presentAlert({
              header: '⚠️ 确认替换',
              message: '替换模式会清空所有现有数据！此操作无法撤销。确定要继续吗？',
              buttons: [
                { text: '取消', role: 'cancel' },
                {
                  text: '确认替换',
                  role: 'destructive',
                  handler: () => {
                    setImportStrategy(ImportStrategy.REPLACE);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }
                }
              ]
            });
          }
        }
      ]
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      showToast('正在导入数据...', 'warning', 0);

      const result = await importFromJSON(file, importStrategy);

      if (result.success) {
        showToast(result.message, 'success', 3000);

        // 显示详细信息
        setTimeout(() => {
          const detailsMessage = `
导入成功：
📝 时间记录: ${result.details.entriesImported} 条
🎯 目标: ${result.details.goalsImported} 条
🏷️ 类别: ${result.details.categoriesImported} 条
${result.details.entriesSkipped + result.details.goalsSkipped + result.details.categoriesSkipped > 0
              ? `\n跳过重复数据: ${result.details.entriesSkipped + result.details.goalsSkipped + result.details.categoriesSkipped} 条`
              : ''}
${result.details.errors.length > 0 ? `\n⚠️ ${result.details.errors.length} 个错误` : ''}
          `.trim();

          presentAlert({
            header: '导入完成',
            message: detailsMessage,
            buttons: ['确定']
          });
        }, 500);

        // 刷新当前页面数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(result.message, 'danger', 3000);

        if (result.details.errors.length > 0) {
          const errorMessage = result.message + '\n\n错误详情：\n' +
            result.details.errors.slice(0, 5).join('\n') +
            (result.details.errors.length > 5 ? `\n... 还有 ${result.details.errors.length - 5} 个错误` : '');

          presentAlert({
            header: '导入失败',
            message: errorMessage,
            buttons: ['确定']
          });
        }
      }
    } catch (error) {
      showToast('导入失败，请重试', 'danger');
      console.error('Import failed:', error);
    } finally {
      setIsLoading(false);
      // 清空文件选择，允许重复选择同一文件
      e.target.value = '';
    }
  };

  // 渲染页面内容（桌面端和移动端共用）
  const renderPageContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={(range, selected) => {
              setAnalysisDateRange(range);
              setAnalysisSelectedRange(selected);
            }}
            onOpenTrend={() => setActiveTab('trend')}
            onOpenGoalAnalysis={() => setActiveTab('goalAnalysis')}
          />
        );
      case 'trend':
        return (
          <TrendPage
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={(range, selected) => {
              setAnalysisDateRange(range);
              setAnalysisSelectedRange(selected);
            }}
            onBack={() => setActiveTab('dashboard')}
          />
        );
      case 'goalAnalysis':
        return (
          <GoalAnalysisPage
            dateRange={analysisDateRange}
            selectedRange={analysisSelectedRange}
            onDateRangeChange={(range, selected) => {
              setAnalysisDateRange(range);
              setAnalysisSelectedRange(selected);
            }}
            onBack={() => setActiveTab('dashboard')}
          />
        );
      case 'records':
        return <RecordsPage />;
      case 'goals':
        return <GoalManager />;
      case 'export':
        return (
          <div className="page-content-wrapper" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 同步管理（如果配置了 OSS） */}
              {isOSSConfigured() && (
                <>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    云端同步
                  </div>
                  <SyncManagementPage />
                  <div style={{ marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }} />
                </>
              )}

              {/* 导入部分 */}
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                  数据导入
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
                  从之前导出的JSON文件中恢复数据
                </div>

                <IonButton
                  expand="block"
                  color="success"
                  onClick={handleImportClick}
                  disabled={isLoading}
                  style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px' }}
                >
                  {isLoading ? <IonSpinner name="dots" /> : '📥 导入数据'}
                </IonButton>
                <div style={{ fontSize: '12px', color: '#999', paddingLeft: '8px' }}>
                  支持全量导出和增量导出的JSON文件
                </div>

                {/* 隐藏的文件输入 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {/* 导出部分 */}
              <div style={{ marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                  数据导出
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
                  推荐日常使用增量导出，首次同步或数据恢复时使用全量导出
                </div>

                <IonButton
                  expand="block"
                  color="primary"
                  onClick={handleExportIncrementalJSON}
                  disabled={isLoading}
                  style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px' }}
                >
                  {isLoading ? <IonSpinner name="dots" /> : '📤 增量导出（推荐）'}
                </IonButton>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', paddingLeft: '8px' }}>
                  只导出自上次同步后的新数据
                </div>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleExportFullJSON}
                  disabled={isLoading}
                  style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px' }}
                >
                  {isLoading ? <IonSpinner name="dots" /> : '📦 全量导出'}
                </IonButton>
                <div style={{ fontSize: '12px', color: '#999', paddingLeft: '8px' }}>
                  导出所有记录和目标数据
                </div>
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                  如果导出失败，可以使用复制功能：
                </div>
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleCopyJSON}
                  disabled={isLoading}
                  style={{ '--border-radius': '12px', height: '48px' }}
                >
                  📋 复制 JSON 到剪贴板
                </IonButton>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // 移动端布局
  const MobileLayout = () => (
    <div className="app mobile-layout">
      <div className="app-header">
        <h1>Time Tracker</h1>
        <IonButton
          fill="clear"
          onClick={toggle}
          style={{
            '--padding-start': '8px',
            '--padding-end': '8px',
            minWidth: '40px',
            height: '40px'
          }}
        >
          <IonIcon icon={isDark ? sunnyOutline : moonOutline} style={{ fontSize: '24px' }} />
        </IonButton>
      </div>
      <div className="app-body">
        {renderPageContent()}
      </div>
      <div className="app-footer">
        <IonTabBar
          selectedTab={activeTab}
          onIonTabsDidChange={(e) => setActiveTab(e.detail.tab)}
          style={{
            '--background': 'hsl(var(--background))',
            borderTop: '1px solid hsl(var(--border))'
          }}
        >
          <IonTabButton tab="records" onClick={() => setActiveTab('records')}>
            <img src={recordsIcon} alt="" style={{ width: '24px', height: '24px' }} />
          </IonTabButton>
          <IonTabButton tab="goals" onClick={() => setActiveTab('goals')}>
            <IonIcon icon={checkmarkDoneOutline} style={{ fontSize: '24px' }} />
          </IonTabButton>
          <IonTabButton tab="export" onClick={() => setActiveTab('export')}>
            <IonIcon icon={cloudUploadOutline} style={{ fontSize: '24px' }} />
          </IonTabButton>
        </IonTabBar>
      </div>
    </div>
  );

  // 桌面端布局
  const DesktopLayout = () => (
    <div className="app desktop-layout">
      <DesktopSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="desktop-main">
        <div className="desktop-header">
          <h1>Time Tracker</h1>
          <IonButton
            fill="clear"
            onClick={toggle}
            style={{
              '--padding-start': '8px',
              '--padding-end': '8px'
            }}
          >
            <IonIcon icon={isDark ? sunnyOutline : moonOutline} style={{ fontSize: '24px' }} />
          </IonButton>
        </div>
        <div className="desktop-content">
          {renderPageContent()}
        </div>
      </div>
    </div>
  );

  return (
    <IonApp>
      {isDesktop ? <DesktopLayout /> : <MobileLayout />}
    </IonApp>
  );
}

export default App;
