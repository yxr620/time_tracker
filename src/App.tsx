import { useState, useEffect, useRef } from 'react';
import { TabBar, Button, Space, Toast } from 'antd-mobile';
import { 
  AppOutline, 
  FileOutline,
  StarOutline
} from 'antd-mobile-icons';
import { Keyboard } from '@capacitor/keyboard';
import { RecordsPage } from './components/RecordsPage/RecordsPage';
import { GoalManager } from './components/GoalManager/GoalManager';
import { exportFullJSON, exportIncrementalJSON } from './services/export';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('records');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const initialViewportHeightRef = useRef<number | null>(null);
  
  // 监听键盘显示/隐藏
  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    const setInitialViewportHeight = () => {
      if (typeof window === 'undefined') return;
      initialViewportHeightRef.current = window.visualViewport?.height ?? window.innerHeight;
    };

    setInitialViewportHeight();

    // 使用 Capacitor Keyboard 插件监听（更准确）
    const setupKeyboardListeners = async () => {
      try {
        showListener = await Keyboard.addListener('keyboardDidShow', () => {
          setIsKeyboardVisible(true);
        });

        hideListener = await Keyboard.addListener('keyboardDidHide', () => {
          setIsKeyboardVisible(false);
          setInitialViewportHeight();
        });
      } catch (err) {
        console.warn('Keyboard plugin not available, using fallbacks:', err);
      }
    };

    setupKeyboardListeners();

    // Fallback 1: 监听所有输入框的 focus/blur 事件
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable')) {
        setIsKeyboardVisible(true);
      }
    };

    const handleBlur = () => {
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (!activeElement) {
          setIsKeyboardVisible(false);
          setInitialViewportHeight();
          return;
        }
        const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable');
        if (!isInput) {
          setIsKeyboardVisible(false);
          setInitialViewportHeight();
        }
      }, 150);
    };

    // Fallback 2: 使用 visualViewport（网页版或插件不可用时）
    const handleViewportChange = () => {
      if (typeof window === 'undefined') return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const initialHeight = initialViewportHeightRef.current ?? viewportHeight;
      const diff = initialHeight - viewportHeight;
      const visible = diff > 80; // 阈值越过 80px 视为键盘展示
      setIsKeyboardVisible(prev => (prev === visible ? prev : visible));
      if (!visible) {
        initialViewportHeightRef.current = viewportHeight;
      }
    };

    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (showListener) showListener.remove();
      if (hideListener) hideListener.remove();

      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);
  
  const handleExportFullJSON = async () => {
    try {
      Toast.show({
        icon: 'loading',
        content: '正在导出全量数据...',
        duration: 0
      });
      await exportFullJSON();
      Toast.clear();
      Toast.show({
        icon: 'success',
        content: '全量导出成功'
      });
    } catch (error) {
      Toast.clear();
      Toast.show({
        icon: 'fail',
        content: '导出失败，请重试'
      });
      console.error('Export Full JSON failed:', error);
    }
  };

  const handleExportIncrementalJSON = async () => {
    try {
      Toast.show({
        icon: 'loading',
        content: '正在导出增量数据...',
        duration: 0
      });
      await exportIncrementalJSON();
      Toast.clear();
      Toast.show({
        icon: 'success',
        content: '增量导出成功'
      });
    } catch (error) {
      Toast.clear();
      Toast.show({
        icon: 'fail',
        content: '导出失败，请重试'
      });
      console.error('Export Incremental JSON failed:', error);
    }
  };

  const handleCopyJSON = async () => {
    try {
      const { db } = await import('./services/db');
      const entries = await db.entries.toArray();
      const dataStr = JSON.stringify(entries, null, 2);
      
      await navigator.clipboard.writeText(dataStr);
      Toast.show({
        icon: 'success',
        content: 'JSON数据已复制到剪贴板'
      });
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: '复制失败'
      });
      console.error('Copy JSON failed:', error);
    }
  };

  const tabs = [
    {
      key: 'records',
      title: '记录',
      icon: <AppOutline />,
    },
    {
      key: 'goals',
      title: '目标',
      icon: <StarOutline />,
    },
    {
      key: 'export',
      title: '导出',
      icon: <FileOutline />,
    },
  ];

  return (
    <div className="app">
      <div className="app-header">
        <h1>时间追踪工具</h1>
      </div>

      <div className="app-body">
        {activeTab === 'records' && (
          <div>
            <RecordsPage />
          </div>
        )}

        {activeTab === 'goals' && (
          <div>
            <GoalManager />
          </div>
        )}

        {activeTab === 'export' && (
          <div style={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }} block>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                数据同步导出
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
                推荐日常使用增量导出，首次同步或数据恢复时使用全量导出
              </div>
              
              <Button
                block
                color="primary"
                size="large"
                onClick={handleExportIncrementalJSON}
              >
                📤 增量导出（推荐）
              </Button>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '-8px', marginBottom: '8px', paddingLeft: '8px' }}>
                只导出自上次同步后的新数据
              </div>
              
              <Button
                block
                color="default"
                size="large"
                onClick={handleExportFullJSON}
              >
                📦 全量导出
              </Button>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '-8px', marginBottom: '8px', paddingLeft: '8px' }}>
                导出所有记录和目标数据
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                  如果导出失败，可以使用复制功能：
                </div>
                <Button
                  block
                  fill="outline"
                  size="large"
                  onClick={handleCopyJSON}
                >
                  📋 复制 JSON 到剪贴板
                </Button>
              </div>
            </Space>
          </div>
        )}
      </div>

      {!isKeyboardVisible && (
        <div className="app-footer">
          <TabBar activeKey={activeTab} onChange={setActiveTab}>
            {tabs.map(item => (
              <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
            ))}
          </TabBar>
        </div>
      )}
    </div>
  );
}

export default App;
