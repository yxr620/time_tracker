/**
 * 同步功能测试工具
 * 在浏览器控制台中使用这些函数来测试同步功能
 */

// 导入必要的模块（在浏览器控制台中，这些应该已经可用）
import { db, type SyncOperation } from './db';
import { syncEngine } from './syncEngine';
import { isOSSConfigured } from './oss';

/**
 * 测试工具对象
 */
export const SyncDebugTools = {
  /**
   * 1. 检查 OSS 配置
   */
  async checkConfig() {
    console.log('=== OSS 配置检查 ===');
    console.log('OSS 是否已配置:', isOSSConfigured());
    console.log('环境变量:', {
      VITE_OSS_REGION: import.meta.env.VITE_OSS_REGION,
      VITE_OSS_BUCKET: import.meta.env.VITE_OSS_BUCKET,
      VITE_OSS_ACCESS_KEY_ID: import.meta.env.VITE_OSS_ACCESS_KEY_ID ? '已设置' : '未设置',
      VITE_OSS_ACCESS_KEY_SECRET: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET ? '已设置' : '未设置'
    });
  },

  /**
   * 2. 查看设备 ID
   */
  async checkDeviceId() {
    const metadata = await db.syncMetadata.get('deviceId');
    console.log('=== 设备信息 ===');
    console.log('设备 ID:', metadata?.value);
  },

  /**
   * 3. 查看同步操作日志
   */
  async checkOperations() {
    const allOps = await db.syncOperations.toArray();
    const unsyncedOps = allOps.filter((op: SyncOperation) => !op.synced);
    
    console.log('=== 同步操作统计 ===');
    console.log('总操作数:', allOps.length);
    console.log('未同步操作数:', unsyncedOps.length);
    console.log('已同步操作数:', allOps.length - unsyncedOps.length);
    
    if (unsyncedOps.length > 0) {
      console.log('\n未同步的操作:');
      console.table(unsyncedOps.map((op: SyncOperation) => ({
        表: op.tableName,
        类型: op.type,
        记录ID: op.recordId,
        时间: new Date(op.timestamp).toLocaleString()
      })));
    } else {
      console.log('✅ 没有未同步的操作');
    }
  },

  /**
   * 4. 创建测试数据
   */
  async createTestEntry() {
    console.log('=== 创建测试记录 ===');
    
    // 生成 UUID
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    
    const { syncDb } = await import('./syncDb');
    const testEntry = {
      id: generateUUID(), // 添加 ID
      startTime: new Date(Date.now() - 3600000), // 1小时前
      endTime: new Date(),
      activity: '测试同步功能',
      categoryId: 'study',
      goalId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const id = await syncDb.entries.add(testEntry);
    console.log('✅ 测试记录已创建，ID:', id);
    
    // 查看是否记录了操作
    await this.checkOperations();
  },

  /**
   * 5. 手动触发同步
   */
  async testSync() {
    console.log('=== 开始同步 ===');
    
    const result = await syncEngine.sync();
    
    console.log('同步结果:', {
      状态: result.status,
      消息: result.message,
      上传数量: result.pushedCount,
      下载数量: result.pulledCount
    });
    
    if (result.error) {
      console.error('同步错误:', result.error);
    }
  },

  /**
   * 6. 查看所有数据
   */
  async viewAllData() {
    const entries = await db.entries.toArray();
    const goals = await db.goals.toArray();
    const categories = await db.categories.toArray();
    
    console.log('=== 数据库内容 ===');
    console.log('时间记录数:', entries.length);
    console.log('目标数:', goals.length);
    console.log('类别数:', categories.length);
    
    if (entries.length > 0) {
      console.log('\n最近的记录:');
      console.table(entries.slice(-5).map((e: any) => ({
        活动: e.activity,
        开始时间: new Date(e.startTime).toLocaleString(),
        版本: e.version || '未设置',
        同步状态: e.syncStatus || '未设置',
        已删除: e.deleted ? '是' : '否'
      })));
    }
  },

  /**
   * 7. 完整测试流程
   */
  async runFullTest() {
    console.log('========================================');
    console.log('开始完整测试');
    console.log('========================================\n');
    
    await this.checkConfig();
    console.log('\n');
    
    await this.checkDeviceId();
    console.log('\n');
    
    await this.viewAllData();
    console.log('\n');
    
    await this.checkOperations();
    console.log('\n');
    
    console.log('如果未同步操作数为 0，创建一条测试记录...');
    const unsyncedOps = await db.syncOperations.where('synced').equals(0).count();
    if (unsyncedOps === 0) {
      await this.createTestEntry();
      console.log('\n');
    }
    
    console.log('执行同步...');
    await this.testSync();
    
    console.log('\n========================================');
    console.log('测试完成！');
    console.log('========================================');
  },

  /**
   * 8. 清空测试数据（慎用！）
   */
  async clearTestData() {
    const confirm = window.confirm('⚠️ 这将清空所有测试数据！确定要继续吗？');
    if (!confirm) {
      console.log('已取消');
      return;
    }
    
    console.log('清空测试数据...');
    
    // 清空同步操作
    await db.syncOperations.clear();
    
    console.log('✅ 已清空同步操作日志');
    console.log('💡 提示：实际的时间记录、目标等数据未删除');
  }
};

// 在控制台中可用
if (typeof window !== 'undefined') {
  (window as any).syncDebug = SyncDebugTools;
  console.log('✅ 同步调试工具已加载！');
  console.log('使用方法:');
  console.log('  syncDebug.runFullTest()     - 运行完整测试');
  console.log('  syncDebug.checkConfig()     - 检查配置');
  console.log('  syncDebug.checkOperations() - 查看同步操作');
  console.log('  syncDebug.createTestEntry() - 创建测试记录');
  console.log('  syncDebug.testSync()        - 手动同步');
  console.log('  syncDebug.viewAllData()     - 查看所有数据');
}
