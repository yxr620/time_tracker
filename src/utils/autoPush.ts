/**
 * 自动同步推送工具
 * 统一处理数据变更后的自动 Push 逻辑
 *
 * 使用 incrementalPush() 而非直接调用 push()，
 * 确保通过 withSyncGuard 获取 isSyncing 锁，
 * 避免与手动 sync() 并发冲突。
 */

import { syncEngine } from '../services/syncEngine';
import { isOSSConfigured } from '../services/oss';
import { emitSyncToast } from '../services/syncToast';

/**
 * 异步执行自动 Push，不阻塞调用方。
 * 内部使用 incrementalPush()（带 isSyncing 守卫），
 * 如果正在同步中会安全跳过，不会产生并发冲突。
 * @param context 日志上下文描述（如 "记录完成后"、"添加目标后"）
 */
export function autoPush(context: string): void {
  if (!isOSSConfigured()) return;

  syncEngine.incrementalPush()
    .then(result => {
      if (result.status === 'success' && (result.pushedCount || 0) > 0) {
        console.log(`[AutoSync] ${context}自动 Push，上传 ${result.pushedCount} 条操作`);
        emitSyncToast({
          message: `自动 Push 完成（↑${result.pushedCount}）`,
          color: 'success',
          duration: 1200
        });
      } else if (result.status === 'error') {
        // isSyncing 冲突时静默跳过，其他错误打日志
        if (result.message !== '正在同步中，请稍候') {
          console.warn(`[AutoSync] ${context} Push 跳过: ${result.message}`);
          emitSyncToast({
            message: `自动 Push 失败：${result.message}`,
            color: 'danger',
            duration: 2200
          });
        }
      }
    })
    .catch(error => {
      console.error(`[AutoSync] ${context} Push 失败:`, error);
      emitSyncToast({
        message: '自动 Push 失败',
        color: 'danger',
        duration: 2200
      });
    });
}
