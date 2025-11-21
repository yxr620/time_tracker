import { useState, useRef } from 'react';
import { TabBar, Button, Space, Toast, Dialog } from 'antd-mobile';
import { IonApp } from '@ionic/react';
import { 
  AppOutline, 
  FileOutline,
  StarOutline
} from 'antd-mobile-icons';
import { RecordsPage } from './components/RecordsPage/RecordsPage';
import { GoalManager } from './components/GoalManager/GoalManager';
import { exportFullJSON, exportIncrementalJSON, importFromJSON, ImportStrategy } from './services/export';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('records');
  const [importStrategy, setImportStrategy] = useState<typeof ImportStrategy.MERGE | typeof ImportStrategy.REPLACE>(ImportStrategy.MERGE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleImportClick = () => {
    // 弹出策略选择对话框
    const dialog = Dialog.show({
      title: '选择导入策略',
      content: (
        <div style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '12px' }}>请选择数据导入策略：</p>
          <div style={{ marginBottom: '8px' }}>
            <strong>合并模式（推荐）</strong>
            <div style={{ fontSize: '13px', color: '#666' }}>保留现有数据，导入新数据。相同ID的记录会被更新。</div>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>替换模式</strong>
            <div style={{ fontSize: '13px', color: '#666' }}>⚠️ 清空所有现有数据，然后导入新数据。</div>
          </div>
        </div>
      ),
      closeOnMaskClick: true,
      actions: [
        {
          key: 'cancel',
          text: '取消',
          style: { color: '#999' },
          onClick: () => {
            dialog.close();
          }
        },
        {
          key: 'replace',
          text: '替换导入',
          style: { color: '#ff4d4f' },
          onClick: () => {
            dialog.close();
            Dialog.confirm({
              title: '⚠️ 确认替换',
              content: '替换模式会清空所有现有数据！此操作无法撤销。确定要继续吗？',
              confirmText: '确认替换',
              cancelText: '取消',
              closeOnMaskClick: true,
              onConfirm: () => {
                setImportStrategy(ImportStrategy.REPLACE);
                setTimeout(() => {
                  fileInputRef.current?.click();
                }, 100);
              }
            });
          }
        },
        {
          key: 'merge',
          text: '合并导入',
          bold: true,
          onClick: () => {
            dialog.close();
            setImportStrategy(ImportStrategy.MERGE);
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 100);
          }
        }
      ]
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      Toast.show({
        icon: 'loading',
        content: '正在导入数据...',
        duration: 0
      });

      const result = await importFromJSON(file, importStrategy);
      Toast.clear();

      if (result.success) {
        Toast.show({
          icon: 'success',
          content: result.message,
          duration: 3000
        });

        // 显示详细信息
        setTimeout(() => {
          Dialog.alert({
            title: '导入完成',
            content: (
              <div style={{ textAlign: 'left', lineHeight: '1.8' }}>
                <p><strong>导入成功：</strong></p>
                <div style={{ fontSize: '14px', marginLeft: '12px' }}>
                  <div>📝 时间记录: {result.details.entriesImported} 条</div>
                  <div>🎯 目标: {result.details.goalsImported} 条</div>
                  <div>🏷️ 类别: {result.details.categoriesImported} 条</div>
                </div>
                {(result.details.entriesSkipped + result.details.goalsSkipped + result.details.categoriesSkipped > 0) && (
                  <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                    <div>跳过重复数据: {result.details.entriesSkipped + result.details.goalsSkipped + result.details.categoriesSkipped} 条</div>
                  </div>
                )}
                {result.details.errors.length > 0 && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#ff4d4f' }}>
                    <div>⚠️ {result.details.errors.length} 个错误</div>
                  </div>
                )}
              </div>
            ),
            confirmText: '确定'
          });
        }, 500);

        // 刷新当前页面数据
        window.location.reload();
      } else {
        Toast.show({
          icon: 'fail',
          content: result.message,
          duration: 3000
        });

        if (result.details.errors.length > 0) {
          Dialog.alert({
            title: '导入失败',
            content: (
              <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
                <p>{result.message}</p>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                  <strong>错误详情：</strong>
                  <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px' }}>
                    {result.details.errors.slice(0, 5).map((err, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {err}</div>
                    ))}
                    {result.details.errors.length > 5 && (
                      <div>... 还有 {result.details.errors.length - 5} 个错误</div>
                    )}
                  </div>
                </div>
              </div>
            ),
            confirmText: '确定'
          });
        }
      }
    } catch (error) {
      Toast.clear();
      Toast.show({
        icon: 'fail',
        content: '导入失败，请重试'
      });
      console.error('Import failed:', error);
    } finally {
      // 清空文件选择，允许重复选择同一文件
      e.target.value = '';
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
    <IonApp>
    <div className="app">
      <div className="app-header">
        <h1>Time Tracker</h1>
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
              {/* 导入部分 */}
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                数据导入
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
                从之前导出的JSON文件中恢复数据
              </div>
              
              <Button
                block
                color="success"
                size="large"
                onClick={handleImportClick}
              >
                📥 导入数据
              </Button>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '-8px', marginBottom: '8px', paddingLeft: '8px' }}>
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

              {/* 导出部分 */}
              <div style={{ marginTop: '24px', borderTop: '1px solid #e5e5e5', paddingTop: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                  数据导出
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
                  推荐日常使用增量导出，首次同步或数据恢复时使用全量导出
                </div>
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

      <div className="app-footer">
        <TabBar activeKey={activeTab} onChange={setActiveTab}>
          {tabs.map(item => (
            <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
          ))}
        </TabBar>
      </div>
    </div>
    </IonApp>
  );
}

export default App;
