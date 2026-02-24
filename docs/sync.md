# 多端同步功能文档

## 概述

Time Tracker 支持基于阿里云 OSS 的多端同步功能，允许在手机和电脑之间同步数据。

### 核心特性

- **本地优先**：所有数据首先保存在本地 IndexedDB，离线可用
- **Snapshot-First 架构**：每次 Pull 先检查 snapshot，再叠加 oplog，数据不丢失
- **自动同步**：应用启动时自动 Pull，数据变更后自动 Push
- **手动同步**：同步管理页面提供增量/全量的精细控制
- **Last-Write-Wins**：用 `updatedAt` 时间戳解决冲突，幂等合并
- **软删除**：删除标记 `deleted: true`，在所有设备间同步
- **OSS 自动清理**：Push 后清理旧 oplog，OSS 文件数 ≈ 设备数 × 2
- **低成本**：基于阿里云 OSS，预计 < ¥0.01/月

---

## 技术架构

### 架构类型

**本地优先 (Local-First) + 对象存储 (OSS) + Snapshot-First 同步**

### 核心策略

| 策略 | 说明 |
|---|---|
| **Snapshot-First** | 每次 Pull 先检查所有其他设备的 snapshot，利用 `lastModified` 跳过未变化的，再叠加增量 oplog。即使 oplog 被清理，snapshot 也能补全所有数据。 |
| **双层存储** | oplog（增量操作日志）+ snapshot（设备全量快照），两者互补 |
| **操作压缩** | Push 时自动去重，同一记录多次修改只上传最新版本 |
| **LWW 合并** | 比较 `updatedAt` 时间戳，远程更新则覆盖本地，合并幂等无副作用 |
| **软删除** | 标记 `deleted: true` 而非物理删除，在设备间传播删除语义 |
| **自动清理** | Push 后自动清理本设备旧 oplog（保留最新 1 个） |

### 为什么不会丢数据

三条不变量同时成立：

1. **每次 Push 同时生成 oplog + snapshot**，snapshot 包含设备的全量数据（含 tombstone）
2. **每次 Pull 先检查 snapshot 的 `lastModified`**，只要对方有过 Push，变化就会被拉取
3. **LWW 合并幂等**，同一记录被 snapshot 和 oplog 合并多少次结果都一致

### 数据流

```
┌──────────────────────────────────────────────────────────────────┐
│ Push 流程                                                       │
│                                                                  │
│ 本地变更 → syncDb 记录 oplog → (自动/手动触发)                 │
│          → 压缩 oplog（去重）                                    │
│          → 上传 oplog 到 OSS                                     │
│          → 标记本地 oplog 已同步                                 │
│          → 生成并上传全量 snapshot                                │
│          → 清理本设备旧 oplog                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Pull 流程                                                       │
│                                                                  │
│ (自动/手动触发)                                                 │
│          → 检查其他设备 snapshot 的 lastModified                 │
│          → 仅下载有变化的 snapshot，LWW 合并                    │
│          → 增量拉取 oplog（按 lastProcessedTimestamp 过滤）     │
│          → 逐条 LWW 合并到本地                                  │
│          → 更新游标 lastProcessedTimestamp                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 数据模型

### Syncable 接口

所有可同步的数据（TimeEntry、Goal、Category）扩展此接口：

```typescript
interface Syncable {
  version?: number;                  // 版本号，每次修改 +1
  deviceId?: string;                 // 最后修改设备的 ID
  syncStatus?: 'synced' | 'pending'; // 同步状态
  deleted?: boolean;                 // 软删除标记
  updatedAt: Date;                   // LWW 冲突解决时间戳
}
```

### 操作日志 (SyncOperation)

记录本地数据变更，用于增量同步上传：

```typescript
interface SyncOperation {
  id: string;                         // UUID
  timestamp: Date;                    // 操作发生时间
  deviceId: string;                   // 操作设备
  tableName: 'entries' | 'goals' | 'categories';
  recordId: string;                   // 记录 ID
  type: 'create' | 'update' | 'delete';
  data: any;                          // 变更后的完整数据
  synced: boolean;                    // 是否已上传到 OSS
}
```

### 同步元数据 (SyncMetadata)

| Key | 说明 |
|---|---|
| `deviceId` | 本设备唯一标识（UUID） |
| `lastProcessedTimestamp` | 最后处理的 oplog 文件时间戳（增量 Pull 游标） |
| `lastSnapshotPullTimestamps` | 各 snapshot 文件上次 Pull 时的 `lastModified`（JSON，用于跳过未变化的 snapshot） |

---

## 同步流程

### 触发机制

**自动触发**（静默执行，受自动同步开关控制）：

> 自动同步开关存储在 `localStorage`（key: `autoSyncEnabled`），新设备默认关闭。
> 用户可在「设置 → 同步管理」中手动开启/关闭。
> 开关关闭时，自动 Push/Pull 不执行，但手动同步始终可用。

| 时机 | 操作 | 前置检查 |
|---|---|---|
| 应用启动 | 增量 Pull（经由 `withSyncGuard`，不会与其他同步并发） | `isSyncReady()`（OSS 已配置 + 开关开启） |
| 数据变更后 | 增量 Push（`stopTracking` / `addEntry` / `updateEntry` / `deleteEntry` / `addGoal` / `updateGoal` / `deleteGoal`） | `isSyncReady()` |

**手动触发**（同步管理页面，不受开关影响）：

- 增量同步 / 增量 Push / 增量 Pull
- 强制全量同步 / 强制全量 Push / 强制全量 Pull

### Push 流程

1. 查询 `syncOperations` 表中 `synced = false` 的记录
2. 如果没有未同步记录，跳过
3. **压缩操作日志**：按 `tableName:recordId` 分组，同一记录只保留最新操作
4. 上传压缩后的操作到 `sync/{userId}/oplog/{deviceId}_{timestamp}.json`
5. 标记所有原始操作为 `synced = true`
6. **生成 snapshot**：读取本地全量数据（含 tombstone），上传到 `sync/{userId}/snapshots/{deviceId}.json`（覆盖写入）
7. **清理旧 oplog**：删除本设备除最新 1 个之外的所有旧 oplog 文件

### Pull 流程 (Snapshot-First)

1. **Snapshot 合并**：
   - `listSnapshotFiles()` 获取其他设备的 snapshot 文件列表（含 `lastModified`）
   - 对比本地缓存的 `lastSnapshotPullTimestamps`，跳过未变化的 snapshot
   - 仅下载 `lastModified` 发生变化的 snapshot，逐条 LWW 合并
   - 正常情况下（对方未 Push）：仅 1 个 listObjects API 调用，0 次下载
2. **增量 Oplog**：
   - 列出 `afterTimestamp` 之后的其他设备 oplog 文件
   - 逐文件下载并 LWW 合并
   - 更新游标 `lastProcessedTimestamp`

### LWW 合并逻辑

```
本地不存在 → 直接写入
本地存在 → 比较 updatedAt：
  remote.updatedAt > local.updatedAt → 覆盖本地
  否则 → 忽略（本地更新）
```

合并是幂等的：对同一条记录重复合并 N 次，结果不变。

---

## OSS 文件结构

```
OSS Bucket
└── sync/
    └── {userId}/
        ├── oplog/                              # 增量操作日志
        │   ├── {deviceId1}_{timestamp}.json    # 每设备通常只保留最新 1 个
        │   └── {deviceId2}_{timestamp}.json
        └── snapshots/                          # 全量快照
            ├── {deviceId1}.json                # 每设备一个，覆盖写入
            └── {deviceId2}.json
```

**文件数量** ≈ 设备数 × 2（每设备 1 snapshot + 最多 1 oplog）

### Oplog 文件格式

```json
[
  {
    "id": "uuid",
    "timestamp": "2026-02-19T10:00:00.000Z",
    "deviceId": "device-uuid",
    "tableName": "entries",
    "recordId": "record-uuid",
    "type": "create",
    "data": { "id": "record-uuid", "activity": "学习", "deleted": false, ... },
    "synced": false
  }
]
```

### Snapshot 文件格式

```json
{
  "deviceId": "device-uuid",
  "timestamp": 1708300800000,
  "entries": [ ... ],
  "goals": [ ... ],
  "categories": [ ... ]
}
```

快照包含该设备的**所有**数据（含 `deleted: true` 的 tombstone）。

---

## 文件清单

| 文件 | 职责 |
|---|---|
| `src/services/db.ts` | 数据库 Schema（v1→v4）、Syncable 接口、同步辅助函数 |
| `src/services/syncDb.ts` | 同步感知的 CRUD（自动记录 oplog，软删除） |
| `src/services/oss.ts` | 阿里云 OSS 封装（分页列表、oplog/snapshot CRUD、批量删除） |
| `src/services/syncConfig.ts` | 同步配置管理（自动同步开关 + OSS 配置，localStorage 持久化） |
| `src/services/syncEngine.ts` | **同步引擎核心**（Push/Pull/LWW 合并、snapshot-first、清理） |
| `src/services/syncToast.ts` | 全局同步 toast 事件通道 |
| `src/services/syncDebugTools.ts` | 浏览器控制台调试工具（`window.syncDebug`） |
| `src/utils/autoPush.ts` | 数据变更后自动 Push（受自动同步开关控制） |
| `src/stores/syncStore.ts` | 同步状态管理（Zustand，含自动同步开关状态） |
| `src/components/common/SyncToastListener.tsx` | 全局 toast 监听组件 |
| `src/components/SyncManagementPage/SyncManagementPage.tsx` | 同步管理界面 |

### 关键 API

```typescript
// 日常同步
await syncEngine.incrementalSync();   // Push + Pull
await syncEngine.incrementalPush();   // 仅 Push
await syncEngine.incrementalPull();   // 仅 Pull

// 数据恢复
await syncEngine.forceFullSync();     // 全量 Push + Pull
await syncEngine.forceFullPush();     // 全量 Push
await syncEngine.forceFullPull();     // 全量 Pull

// 维护
await syncEngine.resetSyncState();             // 重置同步游标
await syncEngine.cleanupSyncedOperations(7);   // 清理 7 天前的已同步操作日志
await syncEngine.purgeDeletedRecords(30);      // 物理删除 30 天前的软删除记录
await syncEngine.getSyncStats();               // 获取同步统计信息
```

### 同步操作守卫 (withSyncGuard)

所有公开的同步 API 均通过 `withSyncGuard` 保护：
- 检查 `isSyncing` 锁，防止并发同步
- 检查 OSS 是否已配置
- 统一的 try/catch/finally 错误处理
- `autoPush` 使用 `incrementalPush()`（带守卫），与其他同步操作互斥

---

## 并发安全

| 场景 | 处理方式 |
|---|---|
| 用户点击同步 + autoPush 同时触发 | `withSyncGuard` 检查 `isSyncing`，后到的操作返回「正在同步中」 |
| 启动时 Pull + autoPush | `incrementalPull()` 走 `withSyncGuard`，互斥安全 |
| 定时 autoSync + 手动同步 | 同上，`isSyncing` 锁保证互斥 |

---

## 云服务配置 (阿里云 OSS)

### 1. 开通 OSS 并创建 Bucket

1. 访问 [阿里云 OSS 控制台](https://oss.console.aliyun.com) 创建 Bucket
2. 配置：区域选最近的，读写权限设为**私有**，存储类型选标准存储

### 2. 配置 CORS

进入 Bucket → 权限管理 → 跨域设置：

| 字段 | 值 |
|---|---|
| 来源 | `*` |
| 允许 Methods | `GET, POST, PUT, DELETE, HEAD` |
| 允许 Headers | `*` |
| 缓存时间 | `3600` |

### 3. 创建 AccessKey

在 [RAM 控制台](https://ram.console.aliyun.com/users) 创建用户，授予 `AliyunOSSFullAccess` 权限。

> ⚠️ 请妥善保管 AccessKey，不要提交到代码仓库。

### 4. 应用配置

**方式一：应用内配置（推荐）**

进入「设置 → 同步管理」，填写 Region、Bucket、AccessKey ID 和 AccessKey Secret，点击保存即可。

配置存储在 `localStorage` 中，持久化生效。

**方式二：.env 文件**

编辑 `.env` 文件：

```env
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket-name
VITE_OSS_ACCESS_KEY_ID=your-access-key-id
VITE_OSS_ACCESS_KEY_SECRET=your-access-key-secret
```

重启开发服务器后生效。

> **优先级**：应用内配置（localStorage）> .env 环境变量

---

## 使用方法

### 首次同步

1. 在设备 A 配置 OSS → 「增量同步」→ 数据上传到 OSS
2. 在设备 B 配置相同 OSS → 「增量同步」→ 设备 A 的数据通过 snapshot 拉取到本地

### 日常使用

- 正常使用 APP 记录时间，变更后自动 Push
- 切换设备前无需手动操作（启动时自动 Pull）
- 需要确认最新数据时可手动点击「增量同步」

### 数据恢复

| 场景 | 操作 |
|---|---|
| OSS 被清空 | 有数据的设备上执行「强制全量 Push」 |
| 本地数据丢失 | 执行「强制全量 Pull」 |
| 同步状态异常 | 「重置同步状态」→ 「增量同步」 |

### 同步管理界面

分四个区域：

**增量同步（日常使用）**：增量同步 / 增量 Push / 增量 Pull

**强制全量同步（数据恢复）**：强制全量同步 / 强制全量 Push / 强制全量 Pull

**高级操作**：重置同步状态 / 清理操作日志 / 清理已删除数据

**同步状态**：设备 ID、未同步/已同步操作数、数据记录总量、已删除记录数

---

## 数据清理

| 清理项 | 触发方式 | 默认保留期 | 说明 |
|---|---|---|---|
| OSS 旧 oplog | 每次 Push 后自动 | 保留最新 1 个 | snapshot 已包含全量数据 |
| 已同步操作日志 | 每次 `sync()` 自动 / 手动 | 7 天 | 清理本地 IndexedDB |
| 软删除记录 | 手动 | 30 天 | 物理删除 `deleted=true` 的记录 |

---

## 故障排查

### 同步管理界面不显示

检查 `.env` 文件中 OSS 配置是否正确，重启开发服务器。

### 同步失败

1. 浏览器控制台查看 `[Sync]` / `[OSS]` 日志
2. 检查 AccessKey 权限、Bucket 名称、CORS 配置
3. 网络问题：重试即可

### 数据不一致

1. 所有设备执行「增量同步」
2. 如仍不一致，执行「强制全量同步」
3. 最后手段：「重置同步状态」后「增量同步」

### Electron 桌面端同步失败

Electron 默认启用严格安全策略，需在 `electron/src/setup.ts` 中：
- `webPreferences` 添加 `webSecurity: false`
- CSP 添加阿里云域名白名单

---

## 成本估算

| 项目 | 费用 |
|---|---|
| 存储（~100KB） | ≈ ¥0.00001/月 |
| 下载流量（~24MB/月） | ≈ ¥0.012/月 |
| API 请求（~600次/月） | ≈ ¥0.0001/月 |
| **合计** | **< ¥0.01/月** |

---

## 更新日志

### v3.2.0 (2026-02)
- ✅ **自动同步开关**：新增 `syncConfig.ts`，通过 localStorage 管理自动同步开关
- ✅ 新设备默认关闭自动同步，用户可在设置页手动开启
- ✅ 开关控制：启动自动 Pull + 数据变更后自动 Push
- ✅ 手动同步不受开关影响，始终可用
- ✅ **应用内 OSS 配置**：设置页提供 OSS 配置表单，无需 .env 文件
- ✅ OSS 配置优先级：localStorage > .env 环境变量
- ✅ `oss.ts` 重构：静态 `OSS_CONFIG` 改为动态 `getOSSConfig()` 函数

### v3.1.0 (2026-02)
- ✅ **Snapshot-First 架构**：每次 Pull 先检查 snapshot（利用 lastModified 跳过未变化的），彻底消除 oplog 间隙导致的数据丢失风险
- ✅ **统一 LWW 合并**：snapshot 和 oplog 共用 `mergeRecordLWW()`，消除重复代码
- ✅ **所有数据变更触发 autoPush**：补齐 updateEntry / deleteEntry / updateGoal 的自动 Push
- ✅ **统一 withSyncGuard**：所有公开同步 API 经由守卫保护，包括启动时 Pull
- ✅ 代码精简：syncEngine.ts 从 773 行精简到 555 行
- ✅ 清理 6 个 .bak 备份文件

### v3.0.0 (2026-02)
- ✅ 双层存储：oplog + snapshot
- ✅ OSS 分页列表（突破 1000 文件限制）
- ✅ Push 操作压缩
- ✅ OSS 自动清理
- ✅ 快照恢复
- ✅ 软删除清理

### v2.0.0 (2024-11)
- ✅ 初始多端同步功能
- ✅ 数据库升级到 Version 4
