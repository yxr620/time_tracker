/**
 * Aliyun OSS Service
 * 处理云端文件的上传、下载和列表操作
 *
 * OSS 文件结构:
 *   sync/{userId}/oplog/{deviceId}_{timestamp}.json   - 增量操作日志
 *   sync/{userId}/snapshots/{deviceId}.json            - 设备全量快照（每设备一个，覆盖写入）
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
 * 上传操作日志到 OSS (oplog)
 * @param data 要上传的数据（操作日志数组）
 * @returns 上传的文件路径
 */
export async function uploadSyncFile(data: any[]): Promise<string> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  try {
    const client = getOSSClient();
    const userId = getUserId();
    const deviceId = await getDeviceId();
    const timestamp = Date.now();
    
    // 文件名格式: sync/{userId}/oplog/{deviceId}_{timestamp}.json
    const fileName = `sync/${userId}/oplog/${deviceId}_${timestamp}.json`;
    
    const content = JSON.stringify(data, null, 2);
    
    const blob = new Blob([content], { type: 'application/json' });
    await client.put(fileName, blob, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[OSS] 已上传 oplog: ${fileName}, ${data.length} 条操作`);
    return fileName;
  } catch (error) {
    console.error('[OSS] 上传失败:', error);
    throw error;
  }
}

export interface OSSObject {
  name: string;
  lastModified: string;
  size: number;
}

/**
 * 分页列出指定前缀下的所有 OSS 对象
 */
async function listAllObjects(prefix: string): Promise<OSSObject[]> {
  const client = getOSSClient();
  const allObjects: OSSObject[] = [];
  let marker: string | undefined;

  do {
    const query: any = { prefix, 'max-keys': '1000' };
    if (marker) {
      query.marker = marker;
    }
    
    const result = await client.list(query, {});
    
    if (result.objects) {
      allObjects.push(...(result.objects as OSSObject[]));
    }
    
    marker = result.nextMarker;
  } while (marker);

  return allObjects;
}

/**
 * 列出其他设备的操作日志文件（带分页）
 * @param afterTimestamp 只获取该时间戳之后的文件（可选）
 * @returns 文件列表
 */
export async function listSyncFiles(afterTimestamp?: number): Promise<OSSObject[]> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const userId = getUserId();
  const deviceId = await getDeviceId();
  const prefix = `sync/${userId}/oplog/`;
  
  try {
    const allObjects = await listAllObjects(prefix);
    
    // 过滤掉本设备上传的文件
    let files = allObjects.filter((obj: OSSObject) => {
      const fileName = obj.name.split('/').pop() || '';
      return !fileName.startsWith(deviceId);
    });
    
    // 如果指定了时间戳，过滤掉更早的文件
    if (afterTimestamp) {
      files = files.filter((obj: OSSObject) => {
        const ts = extractTimestamp(obj.name);
        return ts > afterTimestamp;
      });
    }
    
    // 按时间戳排序（从旧到新）
    files.sort((a: OSSObject, b: OSSObject) => extractTimestamp(a.name) - extractTimestamp(b.name));
    
    console.log(`[OSS] 找到 ${files.length} 个待同步 oplog 文件`);
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

// ===========================
// 快照 (Snapshot) 相关
// ===========================

/**
 * 快照数据结构
 */
export interface SnapshotData {
  deviceId: string;
  timestamp: number;
  entries: any[];
  goals: any[];
  categories: any[];
}

/**
 * 上传设备快照到 OSS（覆盖写入）
 * 每个设备只保留一个快照文件
 */
export async function uploadSnapshot(data: SnapshotData): Promise<string> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const client = getOSSClient();
  const userId = getUserId();
  
  const fileName = `sync/${userId}/snapshots/${data.deviceId}.json`;
  
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  await client.put(fileName, blob, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  console.log(`[OSS] 已上传快照: ${fileName}, entries=${data.entries.length}, goals=${data.goals.length}, categories=${data.categories.length}`);
  return fileName;
}

/**
 * 列出其他设备的快照文件
 */
export async function listSnapshotFiles(): Promise<OSSObject[]> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const deviceId = await getDeviceId();
  const userId = getUserId();
  const prefix = `sync/${userId}/snapshots/`;
  
  const allObjects = await listAllObjects(prefix);
  
  // 过滤掉本设备的快照
  const files = allObjects.filter((obj: OSSObject) => {
    const fileName = obj.name.split('/').pop() || '';
    return !fileName.startsWith(deviceId);
  });
  
  console.log(`[OSS] 找到 ${files.length} 个其他设备的快照`);
  return files;
}

/**
 * 下载快照文件
 */
export async function downloadSnapshot(fileName: string): Promise<SnapshotData> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const client = getOSSClient();
  const result = await client.get(fileName);
  const content = result.content.toString('utf-8');
  const data: SnapshotData = JSON.parse(content);
  
  console.log(`[OSS] 已下载快照: ${fileName}, entries=${data.entries.length}, goals=${data.goals.length}, categories=${data.categories.length}`);
  return data;
}

// ===========================
// 本设备 Oplog 管理
// ===========================

/**
 * 列出本设备的操作日志文件（用于清理）
 */
export async function listOwnOplogFiles(): Promise<OSSObject[]> {
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const deviceId = await getDeviceId();
  const userId = getUserId();
  const prefix = `sync/${userId}/oplog/`;
  
  const allObjects = await listAllObjects(prefix);
  
  const files = allObjects.filter((obj: OSSObject) => {
    const fileName = obj.name.split('/').pop() || '';
    return fileName.startsWith(deviceId);
  });
  
  files.sort((a, b) => extractTimestamp(a.name) - extractTimestamp(b.name));
  return files;
}

// ===========================
// 删除操作
// ===========================

/**
 * 批量删除 OSS 文件
 * ali-oss deleteMulti 每次最多 1000 个
 */
export async function deleteOSSFiles(fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) return;
  if (!isOSSConfigured()) {
    throw new Error('OSS 未配置');
  }

  const client = getOSSClient();
  
  const batchSize = 1000;
  for (let i = 0; i < fileNames.length; i += batchSize) {
    const batch = fileNames.slice(i, i + batchSize);
    await client.deleteMulti(batch);
    console.log(`[OSS] 已删除 ${batch.length} 个文件 (批次 ${Math.floor(i / batchSize) + 1})`);
  }
}
