import { useState, useRef } from 'react';
import {
  IonButton,
  IonSpinner,
  useIonToast,
  useIonAlert,
} from '@ionic/react';
import { SyncManagementPage } from '../SyncManagementPage/SyncManagementPage';
import { exportFullJSON, exportIncrementalJSON, importFromJSON, ImportStrategy } from '../../services/export';
import { db } from '../../services/db';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import './ExportPage.css';

export const ExportPage: React.FC = () => {
  const [importStrategy, setImportStrategy] = useState<typeof ImportStrategy.MERGE | typeof ImportStrategy.REPLACE>(ImportStrategy.MERGE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [isLoading, setIsLoading] = useState(false);

  const { loadEntries } = useEntryStore();
  const { loadGoals } = useGoalStore();
  const { loadCategories } = useCategoryStore();

  const showToast = (message: string, color: 'success' | 'danger' | 'warning' = 'success', duration = 2000) => {
    presentToast({ message, duration, position: 'top', color });
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
        { text: '取消', role: 'cancel' },
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

  /** 导入完成后通过 store 刷新数据，避免 window.location.reload() */
  const refreshAllStores = async () => {
    await Promise.all([
      loadEntries(),
      loadGoals(),
      loadCategories(),
    ]);
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

        // 通过 store 刷新数据，而不是 reload 整个页面
        await refreshAllStores();
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
      e.target.value = '';
    }
  };

  return (
    <div className="page-content-wrapper export-page">
      <div className="export-page-sections">
        {/* 同步管理 */}
        <section className="export-section">
          <h3 className="export-section-title">云端同步</h3>
          <SyncManagementPage />
        </section>

        <hr className="export-divider" />

        {/* 导入部分 */}
        <section className="export-section">
          <h3 className="export-section-title">数据导入</h3>
          <p className="export-section-desc">从之前导出的JSON文件中恢复数据</p>

          <IonButton
            expand="block"
            color="success"
            onClick={handleImportClick}
            disabled={isLoading}
            style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px' }}
          >
            {isLoading ? <IonSpinner name="dots" /> : '📥 导入数据'}
          </IonButton>
          <p className="export-section-hint">支持全量导出和增量导出的JSON文件</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </section>

        <hr className="export-divider" />

        {/* 导出部分 */}
        <section className="export-section">
          <h3 className="export-section-title">数据导出</h3>
          <p className="export-section-desc">推荐日常使用增量导出，首次同步或数据恢复时使用全量导出</p>

          <IonButton
            expand="block"
            color="primary"
            onClick={handleExportIncrementalJSON}
            disabled={isLoading}
            style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px' }}
          >
            {isLoading ? <IonSpinner name="dots" /> : '📤 增量导出（推荐）'}
          </IonButton>
          <p className="export-section-hint">只导出自上次同步后的新数据</p>

          <IonButton
            expand="block"
            fill="outline"
            onClick={handleExportFullJSON}
            disabled={isLoading}
            style={{ '--border-radius': '12px', height: '48px', marginBottom: '8px', marginTop: '12px' }}
          >
            {isLoading ? <IonSpinner name="dots" /> : '📦 全量导出'}
          </IonButton>
          <p className="export-section-hint">导出所有记录和目标数据</p>
        </section>

        <hr className="export-divider" />

        {/* 备用复制 */}
        <section className="export-section">
          <p className="export-section-desc">如果导出失败，可以使用复制功能：</p>
          <IonButton
            expand="block"
            fill="outline"
            onClick={handleCopyJSON}
            disabled={isLoading}
            style={{ '--border-radius': '12px', height: '48px' }}
          >
            📋 复制 JSON 到剪贴板
          </IonButton>
        </section>
      </div>
    </div>
  );
};
