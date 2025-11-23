# 多端同步功能文档

## 📋 概述

Time Tracker 支持基于阿里云 OSS 的多端同步功能，允许在手机和电脑之间同步数据。

### 核心特性

- ✅ **本地优先**：所有数据首先保存在本地，离线也能正常使用
- ✅ **手动同步**：在"导出"页面手动控制同步操作
- ✅ **冲突解决**：采用 Last-Write-Wins 策略，最后修改的数据优先
- ✅ **增量同步**：只传输变更的数据，节省流量（推荐日常使用）
- ✅ **强制全量同步**：用于数据恢复场景，重新上传或拉取所有数据
- ✅ **软删除**：删除操作在所有设备间同步
- ✅ **向后兼容**：完全兼容现有的导出/导入功能
- ✅ **低成本**：基于阿里云 OSS，预计每月费用 < ¥1
- ✅ **可选配置**：不配置 OSS 不影响其他功能

---

## 🏗️ 技术架构

### 架构类型
**本地优先 (Local-First) + 对象存储 (OSS) + 操作日志**

### 核心策略
- **增量同步**：只传输变更的数据
- **Last-Write-Wins**：最后写入优先，用时间戳解决冲突
- **软删除**：删除操作标记 `deleted: true` 而非物理删除

### 数据流程

```
本地操作 → 记录日志 → 标记未同步
    ↓
自动/手动触发同步
    ↓
Push：上传未同步的操作日志到 OSS
    ↓
Pull：下载其他设备的操作日志
    ↓
Merge：根据时间戳合并数据
```

---

## 📊 数据模型

### 1. Syncable 接口

所有可同步的数据（TimeEntry、Goal、Category）扩展此接口：

```typescript
interface Syncable {
  version?: number;                // 版本号，每次修改 +1
  deviceId?: string;               // 修改设备的 ID
  syncStatus?: 'synced' | 'pending'; // 同步状态
  deleted?: boolean;               // 软删除标记
  updatedAt: Date;                 // 用于冲突解决的时间戳
}
```

### 2. 操作日志 (SyncOperation)

记录数据变更，用于增量同步：

```typescript
interface SyncOperation {
  id: string;                      // UUID
  timestamp: Date;                 // 操作发生时间
  deviceId: string;                // 操作设备
  tableName: 'entries' | 'goals' | 'categories';
  recordId: string;                // 记录 ID
  type: 'create' | 'update' | 'delete';
  data: any;                       // 变更后的完整数据
  synced: boolean;                 // 是否已上传
}
```

### 3. 同步元数据 (SyncMetadata)

```typescript
interface SyncMetadata {
  key: string;
  value: any;
}
```

关键 Key：
- `deviceId`：本设备唯一标识
- `lastSyncTime`：最后一次成功同步的时间
- `lastProcessedTimestamp`：最后处理的云端文件时间戳

---

## 🗄️ 数据库 Schema (Version 4)

```typescript
this.version(4).stores({
  // 原有表
  entries: 'id, startTime, endTime, activity, categoryId, goalId, createdAt',
  goals: 'id, name, date, createdAt',
  categories: 'id, name, order',
  
  // 同步支持
  syncMetadata: 'key, updatedAt',
  syncOperations: 'id, timestamp, deviceId, tableName, synced'
});
```

**升级策略**：
- 自动为现有数据添加 `version=1`, `syncStatus='synced'`
- 生成设备 ID（如果不存在）
- 完全向后兼容，不破坏现有数据

---

## 🔄 同步流程

### 1. 触发机制
- **手动触发**：用户点击顶部的"同步"按钮
- **自动触发**：应用启动时、每隔 10 分钟

### 2. Push（推送）

1. 查询 `syncOperations` 表中 `synced = false` 的记录
2. 如果没有未同步记录，跳过
3. 将这些操作打包成一个 JSON 文件
4. 上传到 OSS（文件名：`sync/{userId}/{deviceId}_{timestamp}.json`）
5. 上传成功后，将对应的 `syncOperations` 标记为 `synced = true`

### 3. Pull（拉取）

1. 列出 OSS 中 `sync/{userId}/` 目录下的所有文件
2. 过滤掉：
   - 本设备上传的文件
   - 时间戳 <= `lastProcessedTimestamp` 的文件
3. 按时间顺序下载并处理文件

### 4. Merge（合并）

对于拉取到的每一条操作记录：

1. **获取本地记录**：根据 ID 查找本地数据
2. **冲突判断**：
   - 如果本地不存在：
     - 非删除操作且 `deleted != true`：直接写入
     - 其他情况：忽略
   - 如果本地存在：
     - 比较 `updatedAt` 时间戳
     - **Last-Write-Wins**：如果 `远程.updatedAt > 本地.updatedAt`，则覆盖本地数据
     - 否则：忽略远程数据（本地更新）
3. **软删除处理**：
   - 如果远程数据 `deleted = true` 且时间戳更新，本地也标记为 `deleted = true`
   - UI 层自动过滤 `deleted = true` 的记录

---

## ☁️ 云服务配置 (阿里云 OSS)

### 1. 开通 OSS 服务

1. 访问 [阿里云官网](https://www.aliyun.com) 注册账号
2. 访问 [OSS 控制台](https://oss.console.aliyun.com) 开通服务
3. 选择按量付费（推荐）

### 2. 创建 Bucket

1. 点击"创建 Bucket"
2. 配置：
   - **Bucket 名称**：例如 `time-tracker-sync-yourname`
   - **区域**：选择离您最近的区域（例如：华东1-杭州）
   - **读写权限**：私有（Private）
   - **存储类型**：标准存储
3. 点击"确定"

### 3. 配置跨域访问（CORS）

1. 进入 Bucket
2. 左侧菜单：权限管理 → 跨域设置
3. 添加规则：
   - **来源**：`*`
   - **允许 Methods**：`GET`, `POST`, `PUT`, `DELETE`, `HEAD`
   - **允许 Headers**：`*`
   - **暴露 Headers**：留空
   - **缓存时间**：`3600`

### 4. 创建 AccessKey

1. 访问 [RAM 控制台](https://ram.console.aliyun.com/users)
2. 创建新用户或使用现有用户
3. 添加权限：`AliyunOSSFullAccess`
4. 创建 AccessKey，记录 `AccessKey ID` 和 `AccessKey Secret`

> ⚠️ **安全提示**：请妥善保管 AccessKey，不要提交到代码仓库！

---

## 🚀 应用配置

### 方法 1：环境变量（推荐）

1. 复制环境变量模板：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件：
   ```env
   VITE_OSS_REGION=oss-cn-hangzhou
   VITE_OSS_BUCKET=time-tracker-sync-yourname
   VITE_OSS_ACCESS_KEY_ID=your-access-key-id
   VITE_OSS_ACCESS_KEY_SECRET=your-access-key-secret
   ```

3. 重启开发服务器：
   ```bash
   npm run dev
   ```

### 方法 2：浏览器控制台（仅测试）

在浏览器控制台执行：

```javascript
localStorage.setItem('ossConfig', JSON.stringify({
  region: 'oss-cn-hangzhou',
  bucket: 'time-tracker-sync-yourname',
  accessKeyId: 'your-access-key-id',
  accessKeySecret: 'your-access-key-secret'
}));
```

**重要**：配置后刷新页面，顶部会显示"同步"按钮。

---

## 📱 使用方法

### 同步管理界面

配置 OSS 后，在"导出"页面可以看到完整的同步管理界面，分为四个区域：

#### 1. **同步状态**
显示当前同步状态信息：
- OSS 配置状态
- 设备 ID（前 8 位）
- 未同步操作数量
- 已同步操作数量

#### 2. **增量同步（推荐）**
日常使用的同步方式，只传输变化的数据：

- **增量同步 (Push + Pull)** - 主按钮
  - 推送本地未同步的操作到云端
  - 拉取并应用其他设备的新操作
  - 适用场景：日常使用，最常用的同步方式

- **增量 Push**
  - 只推送本地未同步的操作到云端
  - 不拉取远程数据
  - 适用场景：确保本地数据已上传

- **增量 Pull**
  - 只拉取并应用其他设备的新操作
  - 不推送本地数据
  - 适用场景：获取其他设备的最新数据

#### 3. **强制全量同步（数据恢复）**
用于特殊场景的全量同步操作：

- **强制全量同步 (Push + Pull)**
  - 重新上传所有本地数据
  - 重新拉取所有远程数据
  - 适用场景：确保完整同步，解决数据不一致问题

- **强制全量 Push ⚠️**
  - 重新生成所有本地数据的操作日志并上传
  - 适用场景：OSS 被清空后恢复数据
  - ⚠️ 警告：会生成大量操作日志

- **强制全量 Pull ⚠️**
  - 重新拉取并应用所有远程操作
  - 适用场景：本地数据丢失后恢复
  - ⚠️ 警告：可能覆盖本地未同步的修改

#### 4. **高级操作**
用于维护和管理同步系统：

- **重置同步状态**
  - 清空 lastProcessedTimestamp
  - 下次 Pull 会重新拉取所有文件
  - 适用场景：同步状态异常时重置

- **清理操作日志**
  - 删除 7 天前的已同步操作日志
  - 减少数据库大小
  - 适用场景：定期清理，释放存储空间

### 首次同步

1. 在设备 A 上配置 OSS
2. 进入"导出"页面
3. 点击"增量同步"按钮
4. 首次会上传所有本地数据
5. 显示同步成功的提示

### 多设备同步

**场景：手机记录 → 电脑查看**

1. **在手机上**：
   - 配置 OSS（相同的配置）
   - 记录一些活动
   - 进入"导出"页面，点击"增量同步"

2. **在电脑上**：
   - 配置 OSS（相同的配置）
   - 打开应用，进入"导出"页面
   - 点击"增量同步"
   - 可以看到手机上记录的数据

3. **继续在电脑上**：
   - 添加新记录
   - 点击"增量同步"
   - 手机上同步后也能看到

### 日常使用流程

**推荐工作流**：

1. **在设备 A 上工作**：
   - 正常使用应用，记录时间
   - 工作结束后，进入"导出"页面
   - 点击"增量同步"按钮
   - 等待同步完成

2. **切换到设备 B**：
   - 打开应用，进入"导出"页面
   - 点击"增量同步"按钮
   - 应用会拉取设备 A 的数据
   - 继续在设备 B 上工作

3. **回到设备 A**：
   - 打开应用，点击"增量同步"
   - 拉取设备 B 的新数据
   - 数据保持一致

### 查看同步状态

- **同步状态区域**：显示未同步操作数和已同步操作数
- **同步中**：按钮显示 loading 动画
- **同步成功**：显示成功提示，包含上传和下载的操作数
- **同步失败**：显示错误提示信息

---

## 🔧 文件结构

### OSS 文件组织

```
OSS Bucket
└── sync/
    └── {userId}/
        ├── {deviceId1}_{timestamp1}.json
        ├── {deviceId1}_{timestamp2}.json
        ├── {deviceId2}_{timestamp1}.json
        └── ...
```

- `userId`：固定为 `default`（MVP 版本不区分用户）
- `deviceId`：设备唯一标识（自动生成的 UUID）
- `timestamp`：文件创建时间（毫秒级时间戳）

### 同步文件格式

```json
[
  {
    "id": "operation-uuid",
    "timestamp": "2024-11-22T10:00:00.000Z",
    "deviceId": "device-uuid",
    "tableName": "entries",
    "recordId": "record-uuid",
    "type": "create",
    "data": {
      "id": "record-uuid",
      "activity": "学习",
      "categoryId": "study",
      "startTime": "2024-11-22T09:00:00.000Z",
      "endTime": "2024-11-22T10:00:00.000Z",
      "version": 1,
      "deviceId": "device-uuid",
      "syncStatus": "pending",
      "deleted": false,
      "updatedAt": "2024-11-22T10:00:00.000Z"
    },
    "synced": false
  }
]
```

---

## 💡 最佳实践

### 1. 定期同步

- 建议每天至少同步一次
- 重要数据修改后立即同步
- 可以开启自动同步（默认已开启）

### 2. 冲突避免

- **避免**在多个设备上**同时**修改**同一条**记录
- 如有重要修改，先同步再操作
- Last-Write-Wins 策略会保留最后修改的版本

### 3. 数据备份

同步功能**不替代**数据备份：
- 定期使用"全量导出"功能备份到本地
- 导出的 JSON 文件保存到云盘（iCloud、Google Drive）
- 同步只保证多设备一致性，不保证数据永久保存

### 4. 与导出/导入的关系

| 特性 | 同步功能 | 导出/导入 |
|------|---------|----------|
| **使用场景** | 日常多端使用 | 备份、迁移 |
| **操作方式** | 自动/一键 | 手动 |
| **数据量** | 增量 | 全量 |
| **网络要求** | 需要 | 不需要 |
| **配置要求** | 需要 OSS | 无 |

**建议使用方式**：
1. **日常使用**：开启同步功能，自动保持多端一致
2. **定期备份**：每月使用"全量导出"备份到本地
3. **设备迁移**：使用"全量导出"→"导入"迁移到新设备

---

## 📊 成本估算

基于以下假设：
- 每周记录数据约 20KB
- 每天同步 10 次
- 1 个月 = 4 周

### 存储费用
- 数据量：20KB × 4周 = 80KB ≈ 0.00008GB
- OSS 标准存储：¥0.12/GB/月
- **费用**：0.00008 × 0.12 ≈ ¥0.00001/月

### 流量费用
- 上传流量：免费
- 下载流量：80KB × 10次/天 × 30天 = 24MB ≈ 0.024GB
- OSS 外网流出：¥0.50/GB
- **费用**：0.024 × 0.50 ≈ ¥0.012/月

### 请求费用
- PUT 请求：10次/天 × 30天 = 300次
- GET 请求：10次/天 × 30天 = 300次
- OSS 请求费用：¥0.01/万次
- **费用**：600 / 10000 × 0.01 ≈ ¥0.0001/月

### 总计
约 **¥0.01/月**（1分钱）

> 💡 实际费用可能更低，因为阿里云 OSS 有免费额度。

---

## 🔒 安全性

### 数据隐私

- 所有数据存储在**您的**阿里云 OSS 中
- 只有拥有 AccessKey 的设备才能访问
- Bucket 设置为"私有"权限，外部无法访问

### AccessKey 保护

- **永远不要**将 AccessKey 提交到 Git 仓库
- `.env` 文件已在 `.gitignore` 中
- 如果 AccessKey 泄露：
  1. 立即在 RAM 控制台删除
  2. 创建新的 AccessKey
  3. 更新所有设备的配置

### 建议安全措施

1. 使用 RAM 子账号而非主账号
2. 为 RAM 用户分配最小权限（仅 OSS）
3. 定期轮换 AccessKey
4. 启用阿里云账号的多因素认证（MFA）
5. 监控 OSS 访问日志

---

## 🛠️ 故障排查

### 问题 1：同步管理界面不显示

**原因**：OSS 未配置或配置错误

**解决**：
1. 检查 `.env` 文件是否存在且配置正确
2. 重启开发服务器
3. 打开浏览器控制台，查看是否有错误
4. 进入"导出"页面查看是否显示 OSS 未配置提示

### 问题 2：同步失败

**可能原因**：
- AccessKey 无效或权限不足
- Bucket 名称错误
- 网络连接问题
- CORS 配置不正确

**解决步骤**：
1. 查看应用显示的错误提示
2. 打开浏览器控制台，查看详细错误
3. 检查 OSS 控制台，确认 Bucket 存在
4. 检查 CORS 配置
5. 测试 AccessKey 是否有效

### 问题 3：数据不同步

**可能原因**：
- 未执行同步操作（同步是手动的）
- 网络问题导致同步中断
- 操作日志未正确记录

**解决步骤**：
1. 确认已在"导出"页面点击"增量同步"按钮
2. 查看"同步状态"中的"未同步操作"数量
3. 如果有未同步操作，再次点击"增量同步"
4. 如果问题持续，尝试"强制全量同步"
5. 还不行，使用"重置同步状态"后重新同步

### 问题 4：OSS 被清空了

**原因**：误操作或 OSS 配置错误

**解决**：
1. 在有数据的设备上，进入"导出"页面
2. 点击"强制全量 Push ⚠️"按钮
3. 确认操作，等待上传完成
4. 在其他设备上执行"增量同步"拉取数据

### 问题 5：本地数据丢失了

**原因**：清除浏览器数据或应用数据

**解决**：
1. 如果其他设备有数据，在其他设备上先执行"增量 Push"
2. 在数据丢失的设备上，进入"导出"页面
3. 点击"强制全量 Pull ⚠️"按钮
4. 确认操作，等待拉取完成
5. 本地数据会恢复

### 问题 6：删除的记录又出现了

**原因**：删除操作未正确同步（v2.0.1 已修复）

**解决**：
- 确保使用 v2.0.1 或更新版本
- 删除记录后进入"导出"页面点击"增量同步"
- 其他设备同步后记录会正确消失

### 问题 7：同步后数据还是不一致

**可能原因**：
- 设备时间不准确
- 操作日志损坏
- 同步过程中断

**解决步骤**：
1. 确保所有设备的系统时间准确
2. 在所有设备上执行"增量同步"
3. 如果问题持续，尝试"强制全量同步"
4. 还不行，使用"重置同步状态"后重新同步

---

## 📝 技术细节

### 实现的文件

- `src/services/db.ts` - 数据库扩展和升级
- `src/services/syncDb.ts` - 同步感知的数据库操作
- `src/services/oss.ts` - 阿里云 OSS 服务封装
- `src/services/syncEngine.ts` - 同步引擎核心逻辑（增量和强制全量同步）
- `src/stores/syncStore.ts` - 同步状态管理
- `src/components/SyncManagementPage/SyncManagementPage.tsx` - 同步管理界面

### 关键函数

**syncDb 操作**：
```typescript
// 添加记录（自动记录同步日志）
await syncDb.entries.add(entry);

// 更新记录
await syncDb.entries.update(id, updates);

// 删除记录（软删除）
await syncDb.entries.delete(id);
```

**同步引擎**：
```typescript
// 增量同步（Push + Pull）
const result = await syncEngine.incrementalSync();

// 增量 Push
const result = await syncEngine.incrementalPush();

// 增量 Pull
const result = await syncEngine.incrementalPull();

// 强制全量同步
const result = await syncEngine.forceFullSync();

// 强制全量 Push（OSS 被清空时恢复）
const result = await syncEngine.forceFullPush();

// 强制全量 Pull（本地数据丢失时恢复）
const result = await syncEngine.forceFullPull();

// 获取同步统计
const stats = await syncEngine.getSyncStats();

// 重置同步状态
await syncEngine.resetSyncState();

// 清理操作日志（删除 N 天前的已同步日志）
const count = await syncEngine.cleanupSyncedOperations(7);
```

### 同步管理功能（v2.0.1 新增）

完整的手动同步管理界面，提供精细的控制：

**增量同步区（推荐）**：
- 增量同步 (Push + Pull) - 主按钮
- 增量 Push - 只上传
- 增量 Pull - 只下载

**强制全量同步区（数据恢复）**：
- 强制全量同步 (Push + Pull)
- 强制全量 Push ⚠️ - OSS 被清空时恢复
- 强制全量 Pull ⚠️ - 本地数据丢失时恢复

**高级操作区**：
- 重置同步状态 - 清空同步时间戳
- 清理操作日志 - 删除 7 天前的已同步日志

### 数据清理（v2.0.1 优化）

导出/导入功能已优化，自动过滤 `deleted: true` 的记录：

- **导出时**：不包含已删除的记录
- **导入时**：跳过已删除的记录
- **好处**：导出文件更小、更干净

**清理操作日志**：
- 在"导出"页面的"高级操作"区域
- 点击"清理操作日志"按钮
- 删除 7 天前的已同步操作日志
- 减少数据库大小

---

## 🔮 未来计划

### 短期（v2.2.0）
- [ ] 同步日志查看器
- [ ] 更详细的同步统计（上传/下载流量）
- [ ] 同步历史记录

### 中期（v2.3.0）
- [ ] 冲突检测和提示（显示被覆盖的数据）
- [ ] 自动清理功能（30天前的已删除记录）
- [ ] 多用户支持（userId 区分）

### 长期（v3.0.0）
- [ ] 端到端加密
- [ ] 更智能的冲突解决（三向合并）
- [ ] 实时同步（WebSocket）
- [ ] 自建后端服务（可选）

---

## 📞 获取帮助

如果遇到问题：

1. 查看浏览器控制台的错误信息
2. 检查阿里云 OSS 控制台的日志
3. 参考本文档的"故障排查"部分
4. 在 GitHub 上提交 Issue

---

## 📄 更新日志

### v2.0.1 (2024-11-22)
- ✅ 修复删除操作的同步问题
- ✅ 导出/导入自动过滤已删除记录
- ✅ 优化文档结构

### v2.0.0 (2024-11-22)
- ✅ 实现多端同步功能
- ✅ 数据库升级到 Version 4
- ✅ 添加同步按钮 UI
- ✅ 自动同步支持
- ✅ 完全向后兼容

---

**感谢使用 Time Tracker 的多端同步功能！**
