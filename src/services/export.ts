import dayjs from 'dayjs';
import { db } from './db';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

// 导出数据格式接口
interface ExportData {
  exportTime: string;
  exportType: 'full' | 'incremental' | 'range';
  lastSyncTime?: string;
  data: {
    entries: any[];
    goals: any[];
  };
  metadata: {
    totalEntries: number;
    totalGoals: number;
    version: string;
  };
}

// 获取上次同步时间
const getLastSyncTime = async (): Promise<Date | null> => {
  const metadata = await db.syncMetadata.get('lastSyncTime');
  if (metadata && metadata.value) {
    return new Date(metadata.value as string);
  }
  return null;
};

// 更新同步时间
const updateLastSyncTime = async (time: Date): Promise<void> => {
  await db.syncMetadata.put({
    key: 'lastSyncTime',
    value: time.toISOString(),
    updatedAt: new Date()
  });
};

// 全量导出 JSON
export const exportFullJSON = async () => {
  const entries = await db.entries.toArray();
  const goals = await db.goals.toArray();
  const exportTime = new Date();
  
  const exportData: ExportData = {
    exportTime: exportTime.toISOString(),
    exportType: 'full',
    data: {
      entries,
      goals
    },
    metadata: {
      totalEntries: entries.length,
      totalGoals: goals.length,
      version: '1.0'
    }
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const filename = `time-tracker-full-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
  
  // 更新同步时间
  await updateLastSyncTime(exportTime);
  
  await shareOrDownloadJSON(dataStr, filename);
};

// 增量导出 JSON（只导出自上次同步后的新数据）
export const exportIncrementalJSON = async () => {
  const lastSyncTime = await getLastSyncTime();
  const exportTime = new Date();
  
  if (!lastSyncTime) {
    // 如果没有上次同步时间，执行全量导出
    return exportFullJSON();
  }
  
  // 获取自上次同步后创建或更新的记录
  const entries = await db.entries
    .filter(entry => {
      const entryUpdatedAt = entry.updatedAt || entry.createdAt;
      return entryUpdatedAt > lastSyncTime;
    })
    .toArray();
    
  const goals = await db.goals
    .filter(goal => {
      const goalUpdatedAt = goal.updatedAt || goal.createdAt;
      return goalUpdatedAt > lastSyncTime;
    })
    .toArray();
  
  const exportData: ExportData = {
    exportTime: exportTime.toISOString(),
    exportType: 'incremental',
    lastSyncTime: lastSyncTime.toISOString(),
    data: {
      entries,
      goals
    },
    metadata: {
      totalEntries: entries.length,
      totalGoals: goals.length,
      version: '1.0'
    }
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const filename = `time-tracker-sync-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
  
  // 更新同步时间
  await updateLastSyncTime(exportTime);
  
  await shareOrDownloadJSON(dataStr, filename);
};

// 时间范围导出 JSON
export const exportToJSON = async (startDate?: Date, endDate?: Date) => {
  let entries = await db.entries.toArray();
  let goals = await db.goals.toArray();
  
  if (startDate || endDate) {
    entries = entries.filter(entry => {
      const time = entry.startTime;
      if (startDate && time < startDate) return false;
      if (endDate && time > endDate) return false;
      return true;
    });
    
    // 如果有日期筛选，也筛选对应日期的目标
    if (startDate || endDate) {
      goals = goals.filter(goal => {
        const goalDate = dayjs(goal.date);
        if (startDate && goalDate.isBefore(dayjs(startDate), 'day')) return false;
        if (endDate && goalDate.isAfter(dayjs(endDate), 'day')) return false;
        return true;
      });
    }
  }
  
  const exportData: ExportData = {
    exportTime: new Date().toISOString(),
    exportType: 'range',
    data: {
      entries,
      goals
    },
    metadata: {
      totalEntries: entries.length,
      totalGoals: goals.length,
      version: '1.0'
    }
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const filename = `time-tracker-${dayjs().format('YYYY-MM-DD')}.json`;
  
  await shareOrDownloadJSON(dataStr, filename);
};

// 共享或下载 JSON 文件的辅助函数
const shareOrDownloadJSON = async (dataStr: string, filename: string) => {
  // 检测是否在原生应用环境（Capacitor）
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      // 使用 Capacitor Filesystem 保存文件
      const result = await Filesystem.writeFile({
        path: filename,
        data: dataStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });
      
      // 使用 Capacitor Share 分享文件
      await Share.share({
        title: '时间追踪数据',
        text: '导出的时间追踪记录',
        url: result.uri,
        dialogTitle: '分享时间追踪数据'
      });
      
      return;
    } catch (error) {
      console.error('Native export failed:', error);
      // 继续尝试 Web 方案
    }
  }
  
  // Web 环境：尝试使用 Web Share API
  const blob = new Blob([dataStr], { type: 'application/json' });
  
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      const canShare = navigator.canShare({ files: [file] });
      
      if (canShare) {
        await navigator.share({
          files: [file],
          title: '时间追踪数据',
          text: '导出的时间追踪记录'
        });
        return;
      }
    } catch (error) {
      // 如果用户取消分享或分享失败，继续尝试下载
      console.log('Share failed, trying download:', error);
    }
  }
  
  // 降级方案：传统下载
  downloadBlob(blob, filename);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  // 对于移动端，添加事件监听来确保下载触发
  document.body.appendChild(a);
  
  // iOS Safari 需要延迟触发
  setTimeout(() => {
    a.click();
    
    // 延迟清理，确保下载开始
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, 0);
};
