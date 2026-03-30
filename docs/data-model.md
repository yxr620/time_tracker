# 数据模型

## 实体概览

应用有三个核心实体：**TimeEntry**、**Goal**、**Category**。所有实体均实现 `Syncable` 接口，支持多端同步。

## Syncable 接口

所有可同步的实体都扩展此接口：

```typescript
interface Syncable {
  version?: number;                  // 版本号，每次修改 +1
  deviceId?: string;                 // 最后修改设备的 UUID
  syncStatus?: 'synced' | 'pending'; // 同步状态
  deleted?: boolean;                 // 软删除标记（true = 已删除）
  updatedAt: Date;                   // LWW 冲突解决时间戳
}
```

**软删除**：应用中的"删除"操作将 `deleted` 置为 `true`，记录不会从 DB 中物理移除，以确保删除操作能同步到其他设备。

## TimeEntry

时间记录，应用的核心数据。

```typescript
interface TimeEntry extends Syncable {
  id: string;              // UUID
  startTime: Date;
  endTime: Date | null;    // null 表示当前正在计时
  activity: string;        // 活动描述（用户输入）
  categoryId: string | null;  // 关联分类 ID（六个固定值之一）
  goalId: string | null;      // 关联目标 ID
  createdAt: Date;
  updatedAt: Date;
}
```

**注**：`endTime === null` 的记录表示正在进行中的计时，`entryStore` 将其作为"活跃计时器"处理。任何时刻最多只有一条这样的记录。

## Goal

目标，用于将时间记录归类到某个项目/任务。

```typescript
interface Goal extends Syncable {
  id: string;      // UUID
  name: string;
  date: string;    // YYYY-MM-DD，目标的目标日期
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Category

活动分类，**6 个硬编码类型**，不允许用户自定义增删。

```typescript
interface Category extends Syncable {
  id: string;            // 预设类别为固定 ID，自定义类别为 UUID
  name: string;
  color: string;         // 颜色存储在 DB 中（v5 迁移后）
  isPreset?: boolean;    // 标记是否为预设类别
  order: number;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**颜色存储在 DB 中**（`Category.color` 字段，Schema v5 新增）。预设类别默认颜色见 `src/config/categoryColors.ts`。

预设类别：

| id | 中文名 | 默认颜色 |
|---|---|---|
| study | 学习 | #1890FF |
| work | 工作 | #40A9FF |
| daily | 日常 | #FFA940 |
| exercise | 运动 | #FF7A45 |
| rest | 休息 | #9254DE |
| entertainment | 娱乐 | #B37FEB |

用户可通过「维护 → 类别管理」添加自定义类别（UUID ID、自选颜色）、编辑预设/自定义类别的名称和颜色、删除自定义类别。

获取颜色：`categoryStore.getCategoryColor(id)`，未知 id 返回 `#d9d9d9`。

## 同步辅助实体

### SyncOperation（操作日志）

记录本地数据变更，用于增量同步上传。由 `syncDb.ts` 自动写入，无需手动管理。

```typescript
interface SyncOperation {
  id: string;
  timestamp: Date;
  deviceId: string;
  tableName: 'entries' | 'goals' | 'categories';
  recordId: string;
  type: 'create' | 'update' | 'delete';
  data: any;      // 变更后的完整记录数据
  synced: boolean;
}
```

### SyncMetadata

每个设备存储以下键值：

| Key | 说明 |
|---|---|
| `deviceId` | 本设备唯一标识（UUID，首次启动生成） |
| `lastProcessedTimestamp` | 增量 Pull 游标，记录最后处理的 oplog 时间戳 |
| `lastSnapshotPullTimestamps` | 各设备 snapshot 的上次拉取时间（JSON），用于跳过未变化的快照 |

## Dexie 数据库 Schema

数据库名：`TimeTrackerDB`，当前版本 4（有向前兼容的迁移脚本）。

```
entries      → id, startTime, endTime, activity, categoryId, goalId, createdAt, updatedAt, deleted, ...
goals        → id, date, name, color, createdAt, updatedAt, deleted, ...
categories   → id, order, name, icon, createdAt, updatedAt, deleted, ...
syncMetadata → key, value, updatedAt
syncOperations → id, timestamp, deviceId, tableName, recordId, type, data, synced
```

## db.ts vs syncDb.ts

| | `db.ts` | `syncDb.ts` |
|---|---|---|
| 用途 | 直接读取（查询、分析） | 写操作（增删改） |
| 操作日志 | 不记录 | 自动记录 SyncOperation |
| 版本管理 | 不处理 | 自动递增 version，设置 deviceId |
| 使用方 | `dataService.ts`（read）、AI tools、分析服务 | `dataService.ts`（write）、stores |

**规则**：读用 `db`，写用 `syncDb`。直接写 `db` 会导致变更不被同步。
