import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { db } from './db';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const exportToJSON = async (startDate?: Date, endDate?: Date) => {
  let entries = await db.entries.toArray();
  
  if (startDate || endDate) {
    entries = entries.filter(entry => {
      const time = entry.startTime;
      if (startDate && time < startDate) return false;
      if (endDate && time > endDate) return false;
      return true;
    });
  }

  const dataStr = JSON.stringify(entries, null, 2);
  const filename = `time-tracker-${dayjs().format('YYYY-MM-DD')}.json`;
  
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

export const exportToExcel = async (startDate?: Date, endDate?: Date) => {
  let entries = await db.entries.toArray();
  
  if (startDate || endDate) {
    entries = entries.filter(entry => {
      const time = entry.startTime;
      if (startDate && time < startDate) return false;
      if (endDate && time > endDate) return false;
      return true;
    });
  }

  const data = entries.map(entry => {
    const duration = entry.endTime 
      ? dayjs(entry.endTime).diff(dayjs(entry.startTime), 'minute')
      : 0;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    
    return {
      '日期': dayjs(entry.startTime).format('YYYY-MM-DD'),
      '活动': entry.activity,
      '开始时间': dayjs(entry.startTime).format('HH:mm'),
      '结束时间': entry.endTime ? dayjs(entry.endTime).format('HH:mm') : '进行中',
      '时长（分钟）': duration,
      '时长': hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '时间记录');
  
  const filename = `time-tracker-${dayjs().format('YYYY-MM-DD')}.xlsx`;
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      // 将 Excel 文件转换为 base64
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      // 保存到 Capacitor 文件系统
      const result = await Filesystem.writeFile({
        path: filename,
        data: wbout,
        directory: Directory.Cache
      });
      
      // 分享文件
      await Share.share({
        title: '时间追踪数据',
        text: '导出的时间追踪记录（Excel格式）',
        url: result.uri,
        dialogTitle: '分享时间追踪数据'
      });
      
      return;
    } catch (error) {
      console.error('Native Excel export failed:', error);
      // 继续尝试 Web 方案
    }
  }
  
  // Web 环境降级方案
  XLSX.writeFile(wb, filename);
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
