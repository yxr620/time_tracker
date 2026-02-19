/**
 * 自动同步推送工具
 * 统一处理数据变更后的自动 Push 逻辑
 */

import { syncEngine } from '../services/syncEngine';
import { isOSSConfigured } from '../services/oss';

/**
 * 异步执行自动 Push，不阻塞调用方。
 * @param context 日志上下文描述（如 "记录完成后"、"添加目标后"）
 */
export function autoPush(context: string): void {
  if (!isOSSConfigured()) return;

  syncEngine.push()
    .then(pushedCount => {
      if (pushedCount > 0) {
        console.log(`[AutoSync] ${context}自动 Push，上传 ${pushedCount} 条操作`);
      }
    })
    .catch(error => {
      console.error(`[AutoSync] ${context} Push 失败:`, error);
    });
}
