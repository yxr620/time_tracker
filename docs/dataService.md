# dataService 与数据维护

## 定位

`src/services/dataService.ts` 是应用的统一数据访问层，承担两个职责：

1. **薄壳化 stores**：stores 通过 `dataService` 写入数据，不直接调用 `syncDb`，保持 store 只负责 UI 状态管理
2. **高级查询统一出口**：AI tools、分析服务、维护页面均通过 `dataService` 读写数据，避免各处散落 `db.*` 调用

## API 概览

```typescript
dataService.entries.query(filters?)        // 查询记录（按日期、分类、目标过滤）
dataService.entries.add(entry)             // 新增记录
dataService.entries.update(id, updates)   // 更新记录
dataService.entries.delete(id)            // 软删除记录
dataService.entries.batchAdd(entries[])   // 批量新增

dataService.entries.findGaps(options)      // 查找时间空白
dataService.entries.findSleepGaps(options) // 查找睡觉候选
dataService.entries.findOverlaps(options)  // 查找时间重叠
dataService.entries.findAnomalies(options) // 查找异常记录

dataService.goals.query(filters?)
dataService.goals.add(goal)
dataService.goals.update(id, updates)
dataService.goals.delete(id)

dataService.categories.list()
```

**读操作**（query / findGaps 等）走 `db`（直接读 IndexedDB）。
**写操作**（add / update / delete）走 `syncDb`（自动记录 oplog，变更可同步）。

## 维护方法详解

### findGaps — 查找时间空白

```typescript
findGaps(options: {
  startDate?: string;           // YYYY-MM-DD，默认最早记录日期
  endDate?: string;             // YYYY-MM-DD，默认今天
  minDurationMinutes?: number;  // 最小间隔分钟数，默认 60
}): Promise<TimeGap[]>

interface TimeGap {
  start: Date;
  end: Date;
  durationMinutes: number;
}
```

**逻辑**：按天遍历日期范围，对每天的记录（裁剪到当天边界后）计算相邻记录之间的空白。包括：第一条记录前的空白、记录间的空白、最后一条记录后的空白，以及整天没有记录的情况（durationMinutes = 1440）。跳过 `endTime === null` 的记录。

### findSleepGaps — 查找睡觉候选

```typescript
findSleepGaps(options: {
  startDate?: string;
  endDate?: string;
  sleepWindowStart?: number;   // 小时，默认 22（22:00 开始）
  sleepWindowEnd?: number;     // 小时，默认 10（10:00 结束）
  minDurationMinutes?: number; // 默认 60
}): Promise<SleepCandidate[]>

interface SleepCandidate extends TimeGap {
  date: string;            // 归属日期（取 gap.end 的日期）
  isFullDayEmpty: boolean; // 该天是否完全没有记录
}
```

**逻辑**：在 `findGaps` 结果的基础上，筛选与睡眠窗口有交集的 gap（`gapStartHour >= sleepStart` 或 `gapEndHour <= sleepEnd` 或 `gapStartHour < sleepEnd`）。`isFullDayEmpty = true` 的候选在 UI 上用不同颜色提示，需要用户特别注意。

### findOverlaps — 查找时间重叠

```typescript
findOverlaps(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<OverlapPair[]>

interface OverlapPair {
  entryA: TimeEntry;
  entryB: TimeEntry;
  overlapMinutes: number;
}
```

**逻辑**：将已完成的记录按 `startTime` 升序排列，遍历相邻记录，若 `entry[i].endTime > entry[i+1].startTime` 则记录为重叠对。

### findAnomalies — 查找异常记录

```typescript
findAnomalies(options?: {
  maxDurationHours?: number;  // 默认 12
  staleActiveHours?: number;  // 默认 24
}): Promise<Anomaly[]>

interface Anomaly {
  entry: TimeEntry;
  type: 'reversed_time' | 'too_long' | 'stale_active';
  message: string;
}
```

**检测规则**：
- `reversed_time`：`endTime < startTime`
- `too_long`：时长超过 `maxDurationHours`
- `stale_active`：`endTime === null` 且 `startTime` 距今超过 `staleActiveHours`

## 数据维护页面（MaintenancePage）

仅通过 Desktop Sidebar 进入，移动端不可见。

### 睡觉补录 Tab（SleepBackfillTab）

状态流转：**配置参数** → **扫描** → **预览/勾选** → **确认补录** → **完成**

- 用户设置日期范围、睡眠窗口（默认 22:00-10:00）、最短时长
- 扫描结果默认全选，用户可取消勾选不想补录的项
- 确认后调用 `dataService.entries.batchAdd()`，activity 固定为"睡觉"，categoryId 固定为 `rest`
- 补录完成后调用 `entryStore.loadEntries()` 刷新 UI

**幂等性**：已有的睡觉记录会参与 gap 计算（它们占据时间段），不会生成重叠的候选，自然避免重复补录。

### 数据校验 Tab（DataValidationTab）

状态流转：**idle** → **扫描** → **显示报告** → **逐条处理**

- 并行调用 `findOverlaps()` 和 `findAnomalies()`
- 重叠修复：将 entryA 的 `endTime` 截断到 entryB 的 `startTime`（`[截断]` 按钮）
- 删除：软删除对应记录，同时从列表中移除涉及该记录的所有条目

## 注意事项

1. **batchAdd 不触发 autoPush**：`batchAdd` 底层调用 `syncDb.entries.add`，写入 oplog，但不会主动触发 autoPush。如需立即同步，在补录完成后手动在同步管理页触发。
2. **整天空白**：`isFullDayEmpty = true` 表示该天完全无记录，不代表一定要补录睡觉，可能是请假/出行等，需用户判断。
3. **findAnomalies 不过滤日期**：目前扫描全量数据（不支持日期范围过滤），数据量大时响应稍慢。
