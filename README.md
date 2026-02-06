# 时间追踪工具 (Time Tracker)

一个基于 React + TypeScript + Capacitor 开发的个人时间追踪应用，支持 Web 和 Android 平台。

## 📱 功能特性

- ⏱️ **统一录入界面**：合并计时和手动添加，打开即用（v1.6.0）
- 📅 **全局日期同步**：记录页、时间轴、目标页共享同一选中日期，保存记录后保持当前日期不变
- 🚀 **智能时间选择**：
  - 点击记录列表/时间轴中的记录，自动设置开始时间（保持当前日期不变）
  - 切换日期时自动使用该日期最后记录的结束时间
  - 开始时间支持"现在"和"上次结束"快捷按钮
  - 结束时间支持"正在进行"模式
- ⏱️ **实时计时**：实时追踪当前活动的时间
- ➕ **手动添加**：支持手动添加历史时间记录
- 🏷️ **活动分类**：6个预设类别（学习、工作、运动、娱乐、日常、休息），颜色配置在代码中
- 📊 **24小时时间轴**：进度条样式可视化展示一天的时间分布，支持点击记录快速设置时间
- 🎯 **目标管理**：设置每日目标并追踪完成情况，支持编辑和删除
- 📝 **记录管理**：查看、编辑和删除时间记录，支持点击记录快速设置时间
- 🔄 **多端同步**：基于阿里云 OSS 的同步功能，手机和电脑数据同步（v2.0.0）- [查看详情](./sync.md)
- 📤 **数据导出**：导出为 JSON 格式（全量/增量），自动过滤已删除记录
- 📥 **数据导入**：从 JSON 文件恢复数据（合并/替换策略），兼容旧数据
- 💾 **本地存储**：使用 IndexedDB 实现离线数据存储
- 📱 **PWA 支持**：可作为 Progressive Web App 安装
- 🤖 **Android 应用**：使用 Capacitor 打包为原生 Android 应用
- 💻 **macOS 桌面应用**：使用 Electron 打包为原生 macOS 应用，支持分栏布局
- 📈 **数据分析看板**（桌面端专属）：
  - KPI 指标卡片（总时长、活跃天数、最常用目标，忽略“无目标”）
  - 目标分布柱状图（Top 10，排除“无目标”，并以徽标单独提示）
  - 类别分布饼图
  - 时段分布图（24小时）
  - 支持 7/30 天及自定义时间范围切换
- 📊 **趋势分析页面**（桌面端专属）：
  - 总体叠加面积图：展示所有类别时间分布趋势
  - 周度对比功能：对比最近3个完整周的时间分配
    - 类别纵向对比图：分组柱状图，按类别查看每周变化
    - 周度堆叠柱状图：每周总时间按类别堆叠显示
    - 本周变化摘要：显示变化最大的 Top 3 类别
  - 每个类别独立的时长趋势折线图
  - 包含未分类时间（未记录的时间也纳入分析）
  - 支持 7/30 天及自定义日期范围
  - 显示每个类别的总计和日均时长
- 🎯 **目标深度分析**（桌面端专属）：
  - 智能目标聚类：自动将相似目标（如"开发 app"、"修复 bug"）归为同一簇
  - 时间投入概览：总投入、日均投入、目标覆盖率、活跃聚类数四大指标
  - 目标时间分布：Top 10 目标簇的时间占比排行图
  - 未关联事件建议：识别可能与现有目标簇相关的无目标记录

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件**：Ionic React + Ant Design Mobile（混用）
- **样式方案**：Tailwind CSS
- **状态管理**：Zustand
- **数据库**：Dexie.js (IndexedDB 封装)
- **时间处理**：Day.js + date-fns
- **图表库**：Recharts（桌面端数据分析）
- **移动端打包**：Capacitor
- **桌面端打包**：Electron (via Capacitor Community Plugin)
- **PWA**：vite-plugin-pwa
- **UUID 生成**：uuid

## 📂 项目结构

```
time-tracker/
├── src/
│   ├── main.tsx              # 应用入口
│   ├── App.tsx               # 主应用组件（TabBar 导航 + 导出导入功能）
│   ├── components/
│   │   ├── TimeTracker/
│   │   │   └── TimeEntryForm.tsx    # 统一录入表单
│   │   ├── EntryList/
│   │   │   ├── EntryList.tsx        # 记录列表
│   │   │   └── EditEntryDialog.tsx  # 编辑对话框
│   │   ├── TimelineView/
│   │   │   ├── TimelineView.tsx     # 24小时时间轴
│   │   │   └── TimelineView.css     # 时间轴样式
│   │   ├── GoalManager/
│   │   │   └── GoalManager.tsx      # 目标管理（Ionic 组件）
│   │   └── RecordsPage/
│   │       └── RecordsPage.tsx      # 记录页面
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx        # 数据分析看板（桌面端）
│   │   │   └── Dashboard.css        # 看板样式
│   │   ├── TrendPage/
│   │   │   ├── TrendPage.tsx        # 趋势分析页面（桌面端）
│   │   │   └── TrendPage.css        # 趋势页面样式
│   │   ├── GoalAnalysisPage/
│   │   │   ├── GoalAnalysisPage.tsx # 目标深度分析页面（桌面端）
│   │   │   └── GoalAnalysisPage.css # 目标分析页面样式
│   │   └── Desktop/
│   │       └── DesktopSidebar.tsx   # 桌面端侧边栏导航
│   ├── config/
│   │   └── categoryColors.ts # 类别颜色配置
│   ├── types/
│   │   ├── analysis.ts       # 数据分析类型定义
│   │   └── goalAnalysis.ts   # 目标分析类型定义
│   ├── stores/               # 状态管理
│   │   ├── entryStore.ts
│   │   ├── goalStore.ts
│   │   └── categoryStore.ts
│   └── services/
│       ├── db.ts             # 数据库配置
│       ├── export.ts         # 数据导出导入功能
│       └── analysis/
│           ├── processor.ts  # 数据分析处理器
│           ├── goalCluster.ts        # 目标聚类算法
│           └── goalAnalysisProcessor.ts  # 目标分析处理器
├── android/                  # Android 原生项目
├── tailwind.config.js        # Tailwind CSS 配置
├── postcss.config.js         # PostCSS 配置
├── vite.config.ts           # Vite 配置
├── capacitor.config.ts      # Capacitor 配置
└── package.json             # 依赖管理
```

---

## 🚀 第一次安装和运行

### 前置要求

- **Node.js**：>= 18.0.0 (推荐使用最新 LTS 版本)
- **npm**：>= 9.0.0 (Node.js 自带)
- **Git**：用于版本控制

**Android 开发需要（可选）：**
- **JDK**：>= 17
- **Android Studio**：最新版本
- **Android SDK**：API Level 33 或更高

### 1️⃣ 克隆项目

```bash
git clone <your-repository-url>
cd time-tracker
```

### 2️⃣ 安装依赖

```bash
npm install
```

这会安装所有必需的依赖，包括：
- React 相关：`react`, `react-dom`
- UI 组件：`@ionic/react`, `ionicons`
- 样式工具：`tailwindcss`
- 状态管理：`zustand`
- 数据库：`dexie`
- 工具库：`dayjs`, `uuid`
- Capacitor：`@capacitor/core`, `@capacitor/android`

### 3️⃣ 配置多端同步（可选）

如果需要使用多端同步功能，需要配置阿里云 OSS。

**详细配置说明**：请参考 [多端同步功能文档](./sync.md)

> 💡 **提示**：如果不配置 OSS，同步功能不会显示，但其他功能正常使用。

### 4️⃣ 启动开发服务器（Web 端）

```bash
npm run dev
```

- 启动 Vite 开发服务器
- 默认地址：`http://localhost:5173`
- 支持热模块替换（HMR）
- **不会生成任何构建文件**

在浏览器中打开显示的 URL，即可开始开发和测试。

---

## 📱 Android 开发和部署

### 首次设置（仅需一次）

如果是第一次克隆项目，Android 项目已经存在于 `android/` 目录中，但你需要：

#### 1. 配置 Android SDK 路径

创建或编辑 `android/local.properties` 文件（**此文件已被 git 忽略**）：

```properties
sdk.dir=/Users/你的用户名/Library/Android/sdk
```

或者在 Windows 上：
```properties
sdk.dir=C\:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
```

**如何找到 SDK 路径**：
- 打开 Android Studio
- 进入 `Preferences` → `Appearance & Behavior` → `System Settings` → `Android SDK`
- 复制 `Android SDK Location` 的路径

#### 2. 构建并同步到 Android

```bash
# 构建 Web 应用
npm run build

# 同步到 Android 项目
npx cap copy
```

**这两个命令的作用**：
- `npm run build`：
  - 执行 TypeScript 类型检查（`tsc -b`）
  - 使用 Vite 构建生产版本
  - 生成 `dist/` 目录（包含压缩后的 HTML/CSS/JS）
  
- `npx cap copy`：
  - 复制 `dist/` 目录到 `android/app/src/main/assets/public/`
  - 更新 Capacitor 配置文件

#### 3. 打开 Android Studio

```bash
npx cap open android
```

或者手动打开：
- 启动 Android Studio
- 选择 "Open an Existing Project"
- 选择项目中的 `android` 目录

#### 4. 运行应用

**使用模拟器**：
1. 在 Android Studio 中点击 `Device Manager`
2. 创建虚拟设备（推荐 Pixel 6，Android 14）
3. 启动模拟器
4. 点击绿色的 Run 按钮（或 Cmd+R / Ctrl+R）

**使用真机**：
1. 手机开启开发者选项：
   - 设置 → 关于手机 → 连续点击"版本号" 7次
2. 开启 USB 调试：
   - 设置 → 开发者选项 → USB 调试（打开）
3. USB 连接手机到电脑
4. 手机上允许 USB 调试
5. 在 Android Studio 中选择你的设备
6. 点击 Run 按钮

---

## 💻 macOS 桌面端开发和部署

本项目支持打包为 macOS 桌面应用，采用 Electron 技术，数据与 Web 端隔离（存储在本地应用数据目录），但可以通过 OSS 同步。

### 1️⃣ 安装 Electron 依赖

```bash
# 安装 Capacitor Electron 社区插件
npm install @capacitor-community/electron

# 添加 Electron 平台
npx cap add @capacitor-community/electron
```

### 2️⃣ 初始化与同步

这会在项目根目录下生成一个 `electron` 文件夹，包含 Electron 的主进程代码。

```bash
# 同步构建文件到 electron 目录
npx cap sync @capacitor-community/electron
```

### 3️⃣ 启动开发预览

```bash
# 在 Electron 窗口中运行应用
npx cap open @capacitor-community/electron
```

此命令会启动一个 Electron 窗口加载你的应用。你可以在这里测试桌面端的布局（如分栏效果）。

### 4️⃣ 打包发布 (.dmg / .app)

进入 `electron` 目录进行打包：

```bash
cd electron
npm install          # 确保 electron 目录下的依赖已安装
npm run electron:build
```

**打包结果**：
- 打包完成后，查看 `electron/dist` 目录。
- 你会找到 `.dmg` 安装包或 `.app` 应用程序文件。
- 直接双击安装即可使用。

**数据存储说明**：
- 桌面应用的数据存储在 macOS 的 `~/Library/Application Support/时间追踪工具/` 目录下。
- 即使更新应用（只要 App ID 不变），数据也会自动保留。

---

## 🔄 日常开发流程

### Web 端开发

**开发模式**（推荐用于快速迭代）：

```bash
npm run dev
```

- 实时热更新
- 在浏览器中查看变化
- 修改代码后自动刷新

**预览生产构建**：

```bash
npm run build    # 构建
npm run preview  # 预览
```

### Android 端开发

每次修改代码后，需要重新构建并同步：

```bash
# 一键构建并同步（推荐）
npm run build && npx cap copy

# 或者使用部署脚本（如果有）
./deploy-android.sh
```

### macOS 端开发

每次修改代码后，需要同步到 Electron 目录：

```bash
# 1. 构建 Web 资源
npm run build

# 2. 同步到 Electron
npx cap sync @capacitor-community/electron

# 3. 预览
npx cap open @capacitor-community/electron
```

**完整流程**：

```
1. 修改源代码（src/ 目录）
   ↓
2. npm run build
   → 执行 tsc -b (TypeScript 类型检查)
   → 执行 vite build (构建生产版本)
   → 生成 dist/ 目录
   ↓
3. npx cap copy
   → 复制 dist/ 到 android/app/src/main/assets/public/
   → 更新 Capacitor 配置文件
   ↓
4. 在 Android Studio 中点击 Run
   → Gradle 构建
   → 打包 APK
   → 安装到设备
   → 启动应用
```

**开发技巧**：
- 如果只是修改样式或 UI，可以先在浏览器中测试（`npm run dev`）
- 确认无误后再构建到 Android
- 如果修改了 Capacitor 配置或添加了插件，需要执行 `npx cap sync`

---

## 📦 可用的 npm 脚本

```bash
npm run dev         # 启动开发服务器（http://localhost:5173）
npm run build       # 构建生产版本到 dist/
npm run preview     # 预览生产构建
npm run lint        # 运行 ESLint 检查代码
```

## 🗄️ 数据存储

应用使用 IndexedDB 存储数据，数据库名称：`TimeTrackerDB`

**包含的表**：
- `entries`：时间记录（包含活动、类别、目标等信息）
- `goals`：目标管理（包含用户自定义颜色）
- `categories`：活动类别（仅存储ID和名称，颜色从代码配置读取）
- `syncMetadata`：同步元数据

**数据位置**：
- **Web 端**：浏览器的 IndexedDB
- **Android 端**：应用的 WebView 存储
- **macOS 端**：`~/Library/Application Support/时间追踪工具/` 目录

**数据持久化**：
- 数据保存在本地，不会丢失
- 卸载应用会清空数据
- 可使用导出功能备份数据

---

## 🎨 UI 框架说明

项目采用 **Ionic React + Ant Design Mobile** 的组合方案，既保留 Ionic 的原生体验，又利用 AntD Mobile 的高可用表单组件。

### 分工

- **Ionic React**：负责页面框架、TabBar、Modal、Card、List、Button 等核心交互，所有主要视图（如 GoalManager、RecordsPage）都以 Ionic 组件编写。
- **Ant Design Mobile**：继续承担日期/时间选择、弹窗确认、Toast 等移动端工具组件，补足 Ionic 没有的细粒度表单体验。

### 优势

- 保持一致的 Ionic 视觉和手势反馈，方便与 Capacitor 原生功能衔接。
- 保留已经验证的 AntD 表单能力，无需重复造轮子。
- Tailwind 仅用作少量间距/排版修饰，样式逻辑简单清晰。

### 配置说明

- ✅ Tailwind CSS（包含 PostCSS）
- ✅ TypeScript 路径别名（`@/*` 指向 `src/*`）
- ✅ Ionic 全局样式（`src/main.tsx` 中引入）
- ✅ CSS 变量和主题配置（`src/index.css`）

---

## 📤 数据导出与导入

### 数据导出

应用支持多种导出方式：
- **全量导出**：导出所有记录、目标和类别
- **增量导出**：只导出自上次同步后的新数据
- **时间范围导出**：导出指定时间段的数据

导出格式为 **JSON**，包含完整的数据结构（entries, goals, categories）。**注意**：
- categories 的 color 字段会被自动过滤（颜色从代码配置读取）
- goals 的 color 字段会保留（用户自定义颜色）
- 适合数据备份和 Python 分析

**导出步骤**：
1. 进入"导出"页面
2. 选择导出方式（推荐日常使用增量导出）
3. 文件自动下载或分享
4. 文件名格式：`time-tracker-full-YYYYMMDD-HHmmss.json` 或 `time-tracker-sync-YYYYMMDD-HHmmss.json`

### 数据导入

从导出的 JSON 文件恢复数据，支持两种导入策略：

**1. 合并模式（推荐）**
- 保留现有数据
- 导入新数据
- 相同 ID 的记录会被更新
- 适合：日常同步、多设备数据合并

**2. 替换模式**
- ⚠️ 清空所有现有数据
- 导入新数据
- 此操作不可撤销
- 适合：全新恢复、重置数据

**导入步骤**：
1. 进入"导出"页面
2. 点击"📥 导入数据"按钮
3. 选择导入策略（合并/替换）
4. 选择之前导出的 JSON 文件
5. 等待导入完成，查看导入结果

**导入结果**：
- 显示导入的记录数、目标数、类别数
- 显示跳过的重复数据数量
- 显示错误信息（如果有）

**注意事项**：
- 支持全量导出和增量导出的 JSON 文件
- 自动兼容旧版本数据（包含 categories.color 的数据）
- 导入时会自动过滤 categories 的 color 字段
- 建议导入前先备份当前数据
- 替换模式会清空所有数据，请谨慎使用
- 导入完成后页面会自动刷新

---

## 🔧 常见问题

### Q1: 运行 `npm run dev` 后无法访问？

**解决方案**：
- 检查端口 5173 是否被占用
- 查看终端输出的实际 URL
- 尝试清除浏览器缓存

### Q2: Android Studio 无法找到 SDK？

**解决方案**：
- 确保已安装 Android SDK
- 正确配置 `android/local.properties`
- 重启 Android Studio

### Q3: `npm run build` 后运行 Android 应用显示旧版本？

**解决方案**：
```bash
# 确保同步到 Android
npx cap copy

# 或者强制同步
npx cap sync android

# 在 Android Studio 中清理构建
Build → Clean Project
Build → Rebuild Project
```

### Q4: 修改代码后 Android 应用没有更新？

**解决方案**：
- 必须执行 `npm run build` 重新构建
- 执行 `npx cap copy` 同步文件
- 在 Android Studio 中重新运行应用

### Q5: IndexedDB 数据如何清空？

**Web 端**：
- 浏览器开发者工具 → Application → Storage → Clear Site Data

**Android 端**：
- 设置 → 应用 → 时间追踪工具 → 清除数据

### Q6: 如何在新设备上恢复数据？

**解决方案**：
1. 在旧设备上使用"全量导出"功能导出数据
2. 将导出的 JSON 文件传输到新设备（通过云盘、邮件等）
3. 在新设备上打开应用，进入"导出"页面
4. 点击"导入数据"，选择"替换模式"
5. 选择之前导出的 JSON 文件
6. 等待导入完成

### Q7: 多设备如何同步数据？

**解决方案**：
1. 在设备A上使用"增量导出"（或首次使用"全量导出"）
2. 将文件传输到设备B
3. 在设备B上使用"合并模式"导入
4. 在设备B上工作后，再次导出
5. 传输回设备A并导入

**提示**：建议每次同步前先导出当前数据作为备份

### Q8: 导入失败怎么办？

**可能原因**：
- JSON 文件格式不正确
- 文件不是本应用导出的
- 数据中存在无效字段

**解决方案**：
1. 确认文件是从本应用导出的
2. 检查文件是否完整（未被截断）
3. 查看导入结果对话框中的错误详情
4. 如果部分数据导入成功，可以继续使用
5. 联系支持并提供错误信息

---

## 🤝 开发指南

### Git 工作流

```bash
# 查看修改
git status

# 添加修改
git add .

# 提交（使用规范的提交信息）
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复 bug"
git commit -m "docs: 更新文档"

# 推送到远程
git push
```

详细的 Git 使用说明请查看 [`GIT_GUIDE.md`](./GIT_GUIDE.md)。

### 推荐的提交信息格式

- `feat: 新功能`
- `fix: Bug 修复`
- `docs: 文档更新`
- `style: 代码格式调整`
- `refactor: 代码重构`
- `perf: 性能优化`
- `test: 测试相关`
- `chore: 构建/工具链相关`

---

## 📚 相关文档

- [Vite 文档](https://vitejs.dev/)
- [React 文档](https://react.dev/)
- [Ant Design Mobile](https://mobile.ant.design/)
- [Capacitor 文档](https://capacitorjs.com/)
- [Dexie.js 文档](https://dexie.org/)
- [Day.js 文档](https://day.js.org/)
- [Zustand 文档](https://github.com/pmndrs/zustand)

---

## 📄 许可证

本项目为个人项目，仅供学习和个人使用。

---

## 🎨 颜色配置

类别颜色从代码配置文件读取（`src/config/categoryColors.ts`），不存储在数据库中。

**修改颜色方法**：
1. 编辑 `src/config/categoryColors.ts` 文件
2. 修改对应类别的 color 值
3. 运行 `npm run build && npx cap copy`
4. 重新部署应用

**当前配色**（渐变同色系）：
- 🔵 学习 `#1890FF` / 工作 `#40A9FF`（蓝色组）
- 🟠 日常 `#FFA940` / 运动 `#FF7A45`（橙色组）
- 🟣 休息 `#9254DE` / 娱乐 `#B37FEB`（紫色组）

**优势**：
- 修改颜色无需数据库迁移
- 导出数据不包含颜色配置
- 多设备同步时颜色统一由代码控制

---

## ✨ 更新日志

完整更新日志请查看 [CHANGELOG.md](./CHANGELOG.md)。

**最新版本**：v2.3.0 (2025-01)
- 目标深度分析：智能聚类、时间投入概览、目标时间分布


