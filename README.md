# 时间追踪工具 (Time Tracker)

一个基于 React + TypeScript + Capacitor 开发的个人时间追踪应用，支持 Web 和 Android 平台。

## 📱 功能特性

- ⏱️ **统一录入界面**：合并计时和手动添加，打开即用（v1.6.0）
- 🚀 **智能时间选择**：
  - 点击记录列表中的记录，自动设置开始时间为该记录的结束时间（v1.8.0）
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

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件**：Ionic React + Ant Design Mobile（混用）
- **样式方案**：Tailwind CSS
- **状态管理**：Zustand
- **数据库**：Dexie.js (IndexedDB 封装)
- **时间处理**：Day.js
- **移动端打包**：Capacitor
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
│   ├── config/
│   │   └── categoryColors.ts # 类别颜色配置
│   ├── stores/               # 状态管理
│   │   ├── entryStore.ts
│   │   ├── goalStore.ts
│   │   └── categoryStore.ts
│   └── services/
│       ├── db.ts             # 数据库配置
│       └── export.ts         # 数据导出导入功能
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
- UI 组件：`@ionic/react`, `ionicons`, `antd-mobile`
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

### v2.0.1 (2024-11-22)
- ✅ **手动同步管理**：重新设计同步界面，提供更精细的控制
  - 增量同步区（推荐）：增量同步、增量 Push、增量 Pull
  - 强制全量同步区（数据恢复）：强制全量同步、强制全量 Push、强制全量 Pull
  - 高级操作区：重置同步状态、清理操作日志
- ✅ **修复同步删除问题**：删除操作现在能正确在所有设备间同步
- ✅ **优化导出/导入**：自动过滤已删除的记录，导出文件更干净
- ✅ **文档整理**：创建独立的同步功能文档 [sync.md](./sync.md)

### v2.0.0 (2024-11-22)
- ✅ **多端同步功能**：基于阿里云 OSS 的同步功能 - [查看详情](./sync.md)
- ✅ 本地优先架构，离线可用
- ✅ 手动同步控制，支持增量和强制全量同步
- ✅ Last-Write-Wins 冲突解决
- ✅ 软删除支持
- ✅ 完全向后兼容

### v1.9.0 (2025-11-21)
- ✅ **UI 框架升级**：全面采用 Ionic React + Ant Design Mobile 组合
- ✅ 移除 shadcn/ui 相关依赖与冗余代码
- ✅ Tailwind 仅保留基础原子类配置，样式更轻量
- ✅ GoalManager 等页面应用 Ionic 组件，保持一致交互

### v1.8.0 (2025-11-17)
- ✅ **智能默认时间**：开始时间默认为最后一条记录的结束时间，无需手动设置
- ✅ **智能时间设置**：点击记录列表或时间轴中的记录，快速设置开始时间
- ✅ 移除冗余的"上次结束"按钮，通过点击记录实现相同功能
- ✅ 优化交互体验，操作更直观便捷
- ✅ 精简提示信息，减少干扰

### v1.7.0 (2025-11-17)
- ✅ **目标编辑功能**：支持修改已创建的目标名称
- ✅ 目标列表新增编辑按钮，操作更便捷
- ✅ 编辑弹窗与添加弹窗保持统一风格

### v1.6.0 (2025-11-16)
- ✅ **全新的统一录入界面**：合并"接续上次"和"手动添加"功能
- ✅ 直接显示录入表单，无需弹窗，打开即用
- ✅ 智能时间选择：
  - 开始时间：支持"现在"和"上次结束"快捷按钮
  - 结束时间：支持"现在"和"正在进行"快捷按钮
- ✅ 移除冗余的 5/15/30 分钟快捷按钮
- ✅ 根据结束时间状态自动切换按钮："开始计时"或"保存记录"
- ✅ 正在计时时显示渐变背景的计时器界面
- ✅ 同步更新编辑对话框的时间选择逻辑
- ✅ 改进用户体验，减少操作步骤

### v1.5.0 (2025-11-08)
- ✅ **颜色配置重构**：类别颜色从代码配置读取，不再存储数据库
- ✅ 导出/导入自动过滤 categories.color 字段
- ✅ 更新配色方案：渐变同色系（同组类别颜色相近）
- ✅ 向后兼容旧数据，自动处理旧版本的 color 字段

### v1.4.0 (2025-11-06)
- ✅ **24小时时间轴可视化**：进度条样式展示一天的时间分布
- ✅ 圆角进度条设计，美观现代
- ✅ 支持日期切换，查看历史数据
- ✅ 点击时间块查看详情（气泡提示）
- ✅ 当前时间红线指示（仅今天显示）
- ✅ 统计信息显示（记录数和总时长）
- ✅ 跨天记录自动裁剪到当天范围
- ✅ 鼠标悬停放大效果（桌面端优化）
- ✅ 时间块自动拼接，无缝衔接

### v1.3.0 (2025-11-04)
- ✅ **数据导入功能**：支持从导出的 JSON 文件恢复数据
- ✅ 两种导入策略：合并模式（推荐）和替换模式
- ✅ 导入结果详细报告（成功数量、跳过数量、错误信息）
- ✅ 数据验证和错误处理
- ✅ 多设备数据同步支持
- ✅ 更新文档：添加数据导入使用说明

### v1.2.0 (2025-11-04)
- ✅ 优化追踪页面布局（移除冗余标题）
- ✅ 修复类别选择器文字颜色问题（选中时文字变白色）
- ✅ 集成手动添加按钮到追踪区域
- ✅ 缩小各区块间距，界面更紧凑

### v1.1.0 (2025-11-04)
- ✅ 添加活动类别功能（6个预设类别）
- ✅ 类别在记录添加时必选
- ✅ 记录列表显示类别标签
- ✅ 导出功能包含类别信息
- ✅ 移除 Excel 导出（保留 JSON）
- ✅ 增量导出和全量导出支持

### v1.0.0 (2025-11-03)
- ✅ 初始版本发布
- ✅ 实时计时功能
- ✅ 手动添加记录
- ✅ 目标管理功能
- ✅ 记录列表展示
- ✅ 数据导出（JSON）
- ✅ Android 应用支持
- ✅ 时间选择器优化（只显示到分钟）
