# 架构概览

## 项目简介

**Chrono** 是一款本地优先的多平台时间追踪应用，使用相同的 Web 代码库同时支持 Web、Android、macOS 三个平台。

## 技术栈

| 层次 | 技术 |
|---|---|
| UI | React 18 + Ionic React 8 + TypeScript |
| 状态管理 | Zustand 5 |
| 持久化 | Dexie.js 4（IndexedDB，数据库名 `TimeTrackerDB`） |
| 构建（Web/Android） | Vite 7 |
| 构建（macOS） | Electron 26（通过 `@capacitor-community/electron`） |
| 多平台桥接 | Capacitor 7 |
| 日期处理 | Day.js |
| 图表 | Recharts 3 |

## 平台支持

| 平台 | 入口 | 数据存储路径 |
|---|---|---|
| Web | Vite dev server / 静态部署 | 浏览器 IndexedDB |
| Android | Capacitor Android | App data 目录 |
| macOS | Electron（`electron/` 目录） | `~/Library/Application Support/Chrono/` |

三个平台共享同一份 `src/` 代码，差异仅在 Capacitor plugin 调用层。

## 响应式布局

`src/App.tsx` 根据屏幕宽度决定使用哪套布局：

```
window.innerWidth >= 1024 → DesktopLayout（侧边栏）
window.innerWidth  < 1024 → MobileLayout（底部 tab 栏）
```

### Mobile 布局（3 个 Tab）

| Tab | 组件 | 说明 |
|---|---|---|
| records | `RecordsPage` | 时间记录主页（表单 + 时间轴 + 列表） |
| goals | `GoalManager` | 目标管理 |
| export | `ExportPage` | 数据导出 / 同步配置 / AI 设置 |

### Desktop 布局（侧边栏，8 个导航项）

| Key | 组件 | 说明 |
|---|---|---|
| records | `RecordsPage` | 同移动端 |
| goals | `GoalManager` | 同移动端 |
| dashboard | `Dashboard` | 数据统计总览（仅桌面端） |
| trend | `TrendPage` | 时间趋势分析（仅桌面端） |
| goalAnalysis | `GoalAnalysisPage` | 目标完成分析（仅桌面端） |
| ai | `AIAssistant` | AI 助手（仅桌面端） |
| maintenance | `MaintenancePage` | 数据维护（仅桌面端） |
| export | `ExportPage` | 设置与数据管理 |

## 目录结构

```
src/
├── App.tsx                    # 根组件：路由、布局切换、启动时 Pull
├── App.css
├── types/                     # 共享 TypeScript 类型
│
├── stores/                    # Zustand 状态管理（6 个 store）
│   ├── entryStore.ts          # 时间记录 CRUD + 计时器
│   ├── goalStore.ts           # 目标 CRUD
│   ├── categoryStore.ts       # 分类（6 个硬编码类型）
│   ├── dateStore.ts           # 全局选中日期
│   ├── syncStore.ts           # 同步状态 + 自动同步开关
│   └── aiStore.ts             # AI 配置 + 对话历史
│
├── services/                  # 数据层与业务逻辑
│   ├── db.ts                  # Dexie Schema、Syncable 接口、辅助函数
│   ├── syncDb.ts              # 同步感知的 CRUD 封装（自动记录 oplog）
│   ├── dataService.ts         # 高层数据查询 + 维护工具
│   ├── syncEngine.ts          # 同步引擎（Push / Pull / LWW 合并）
│   ├── syncConfig.ts          # 同步配置管理（localStorage）
│   ├── syncToast.ts           # 同步状态通知事件总线
│   ├── syncDebugTools.ts      # 控制台调试工具（window.syncDebug）
│   ├── oss.ts                 # 阿里云 OSS 操作封装
│   ├── export.ts              # JSON 导入导出
│   ├── ai/                    # AI 助手（见 ai-assistant.md）
│   └── analysis/              # 数据分析处理器
│       ├── processor.ts       # 数据加载 + 转换管道
│       ├── goalAnalysisProcessor.ts
│       └── goalCluster.ts
│
├── components/
│   ├── RecordsPage/
│   ├── TimeTracker/           # TimeEntryForm
│   ├── TimelineView/          # 24 小时时间轴
│   ├── EntryList/             # 列表 + 编辑弹窗 + 滑动删除
│   ├── GoalManager/           # 目标 CRUD + TimeInjectionMatrix
│   ├── Dashboard/             # 数据统计总览
│   ├── TrendPage/             # 趋势分析
│   ├── GoalAnalysisPage/      # 目标分析
│   ├── AIAssistant/           # AI 对话 + 设置
│   ├── MaintenancePage/       # 数据维护（睡觉补录 + 数据校验）
│   ├── ExportPage/            # 导出 / 设置
│   ├── SyncManagementPage/    # 同步管理界面
│   ├── Desktop/               # DesktopSidebar
│   └── common/                # SyncToastListener、WheelTimePicker
│
├── config/
│   └── categoryColors.ts      # 6 个分类的颜色常量（单一数据源）
│
└── utils/
    └── autoPush.ts            # 数据变更后自动触发增量 Push
```

## 环境变量

复制 `.env.example` 为 `.env.local`，OSS 和 AI 配置均为可选：

```env
# 同步（可选）
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket-name
VITE_OSS_ACCESS_KEY_ID=your-access-key-id
VITE_OSS_ACCESS_KEY_SECRET=your-access-key-secret

# AI 助手（可选）
VITE_AI_PROVIDER=qwen
VITE_AI_BASE_URL=https://...
VITE_AI_API_KEY=your-api-key
VITE_AI_MODEL=qwen3.5-plus
```

> **优先级**：应用内配置（localStorage）> .env 环境变量。两项均未配置时，对应功能不可用，但应用正常运行。

## 开发命令

```bash
npm run dev          # Vite 开发服务器（http://localhost:5173）
npm run build        # TypeScript 编译 + Vite 生产构建
npm run lint         # ESLint 检查（项目唯一的代码质量检查）
npm run preview      # 预览生产构建
npm run ai:debug     # AI 助手 CLI 调试

# Android
npm run build && npx cap copy    # 同步 Web 构建到 Android
npx cap open android             # 在 Android Studio 中打开

# macOS Electron
npm run build && npx cap sync @capacitor-community/electron
cd electron && npm run electron:start   # 启动（调试端口 5858）
cd electron && npm run electron:make    # 打包 .dmg/.app
```
