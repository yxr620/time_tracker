/**
 * Aliyun OSS Service
 * 处理云端文件的上传、下载和列表操作
 */

import OSS from 'ali-oss';
import { getDeviceId } from './db';

// OSS 配置
const OSS_CONFIG = {
  region: import.meta.env.VITE_OSS_REGION || 'oss-cn-hangzhou',
  bucket: import.meta.env.VITE_OSS_BUCKET || '',
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID || '',
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET || '',
  secure: true
};

// 用户 ID（未来可以通过登录系统获取）
const getUserId = (): string => {
  // MVP 阶段：使用设备 ID 作为用户 ID
  // 未来可以集成真正的用户系统
  return localStorage.getItem('userId') || 'default-user';
};

/**
 * 初始化 OSS 客户端
 */
function getOSSClient(): OSS {
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret) {
    throw new Error('OSS 配置缺失，请设置 VITE_OSS_ACCESS_KEY_ID 和 VITE_OSS_ACCESS_KEY_SECRET');
  }

  try {
    return new OSS(OSS_CONFIG);
  } catch (error) {
    console.error('[OSS] 客户端初始化失败:', error);
    throw error;
  }
}

/**
 * 检查 OSS 是否已配置
 */
export function isOSSConfigured(): boolean {
  return !!(OSS_CONFIG.accessKeyId && OSS_CONFIG.accessKeySecret && OSS_CONFIG.bucket);
}

/**
 * 上传同步文件到 OSS
 * @param data 要上传的数据（操作日志数组）
 * @returns 上传的文件路径
 */
export async function uploadSyncFile(data: any[]): Promise<string> {
  if (!isOSSConfigured()) {
    console.warn('[OSS] OSS 未配置，跳过上传');
    throw new Error('OSS 未配置');
  }

  try {
    const client = getOSSClient();
    const userId = getUserId();
    const deviceId = await getDeviceId();
    const timestamp = Date.now();
    
    // 文件名格式: sync/{userId}/{deviceId}_{timestamp}.json
    const fileName = `sync/${userId}/${deviceId}_${timestamp}.json`;
    
    const content = JSON.stringify(data, null, 2);
    
    // 在浏览器环境中使用 Blob 代替 Buffer
    const blob = new Blob([content], { type: 'application/json' });
    await client.put(fileName, blob, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[OSS] 已上传: ${fileName}, ${data.length} 条操作`);
    return fileName;
  } catch (error) {
    console.error('[OSS] 上传失败:', error);
    throw error;
  }
}

interface OSSObject {
  name: string;
  lastModified: string;
  size: number;
}

/**
 * 列出用户目录下的所有同步文件
 * @param afterTimestamp 只获取该时间戳之后的文件（可选）
 * @returns 文件列表
 */
export async function listSyncFiles(afterTimestamp?: number): Promise<OSSObject[]> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const client = getOSSClient();
  const userId = getUserId();
  const deviceId = await getDeviceId();
  
  const prefix = `sync/${userId}/`;
  
  try {
    const result = await client.list({
      prefix,
      'max-keys': '1000' // 最多获取 1000 个文件
    }, {});
    
    if (!result.objects) {
      return [];
    }
    
    // 过滤掉本设备上传的文件
    let files = (result.objects as OSSObject[]).filter((obj: OSSObject) => {
      const fileName = obj.name.split('/').pop() || '';
      return !fileName.startsWith(deviceId);
    });
    
    // 如果指定了时间戳，过滤掉更早的文件
    if (afterTimestamp) {
      files = files.filter((obj: OSSObject) => {
        const fileName = obj.name.split('/').pop() || '';
        const match = fileName.match(/_(\d+)\.json$/);
        if (match) {
          const fileTimestamp = parseInt(match[1], 10);
          return fileTimestamp > afterTimestamp;
        }
        return false;
      });
    }
    
    // 按时间戳排序（从旧到新）
    files.sort((a: OSSObject, b: OSSObject) => {
      const extractTimestamp = (name: string): number => {
        const fileName = name.split('/').pop() || '';
        const match = fileName.match(/_(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      return extractTimestamp(a.name) - extractTimestamp(b.name);
    });
    
    console.log(`[OSS] 找到 ${files.length} 个待同步文件`);
    return files;
  } catch (error) {
    console.error('[OSS] 列出文件失败:', error);
    throw error;
  }
}

/**
 * 下载同步文件
 * @param fileName 文件路径
 * @returns 文件内容（操作日志数组）
 */
export async function downloadSyncFile(fileName: string): Promise<any[]> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const client = getOSSClient();
  
  try {
    const result = await client.get(fileName);
    const content = result.content.toString('utf-8');
    const data = JSON.parse(content);
    
    console.log(`[OSS] 已下载: ${fileName}, ${data.length} 条操作`);
    return data;
  } catch (error) {
    console.error(`[OSS] 下载文件失败: ${fileName}`, error);
    throw error;
  }
}

/**
 * 提取文件名中的时间戳
 */
export function extractTimestamp(fileName: string): number {
  const match = fileName.match(/_(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : 0;
}
