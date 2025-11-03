# 时间追踪工具 (Time Tracker)# React + TypeScript + Vite



一个基于 React + TypeScript + Capacitor 开发的个人时间追踪应用，支持 Web 和 Android 平台。This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.



## 📱 功能特性Currently, two official plugins are available:



- ⏱️ **实时计时**：实时追踪当前活动的时间- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh

- ➕ **手动添加**：支持手动添加历史时间记录- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- 📝 **记录管理**：查看、编辑和删除时间记录

- 📊 **数据导出**：支持导出为 JSON 和 Excel 格式## React Compiler

- 💾 **本地存储**：使用 IndexedDB 实现离线数据存储

- 📱 **PWA 支持**：可作为 Progressive Web App 安装The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

- 🤖 **Android 应用**：使用 Capacitor 打包为原生 Android 应用

## Expanding the ESLint configuration

## 🛠️ 技术栈

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

- **前端框架**：React 18 + TypeScript

- **构建工具**：Vite```js

- **UI 组件**：Ant Design Mobileexport default defineConfig([

- **状态管理**：Zustand  globalIgnores(['dist']),

- **数据库**：Dexie.js (IndexedDB 封装)  {

- **时间处理**：Day.js    files: ['**/*.{ts,tsx}'],

- **移动端打包**：Capacitor    extends: [

- **PWA**：vite-plugin-pwa      // Other configs...



## 📂 项目结构      // Remove tseslint.configs.recommended and replace with this

      tseslint.configs.recommendedTypeChecked,

```      // Alternatively, use this for stricter rules

time-tracker/      tseslint.configs.strictTypeChecked,

├── src/      // Optionally, add this for stylistic rules

│   ├── main.tsx              # 应用入口      tseslint.configs.stylisticTypeChecked,

│   ├── App.tsx               # 主应用组件（TabBar 导航）

│   ├── components/           # UI 组件      // Other configs...

│   │   ├── TimeTracker/    ],

│   │   │   ├── ActiveTracker.tsx    # 实时计时器    languageOptions: {

│   │   │   └── ManualEntry.tsx      # 手动添加记录      parserOptions: {

│   │   └── EntryList/        project: ['./tsconfig.node.json', './tsconfig.app.json'],

│   │       └── EntryList.tsx        # 记录列表        tsconfigRootDir: import.meta.dirname,

│   ├── stores/               # 状态管理      },

│   │   ├── entryStore.ts    # 时间记录状态      // other options...

│   │   └── goalStore.ts     # 目标管理状态    },

│   └── services/             # 服务层  },

│       ├── db.ts            # 数据库配置])

│       └── export.ts        # 数据导出功能```

├── android/                  # Android 原生项目

├── public/                   # 静态资源You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

├── vite.config.ts           # Vite 配置

├── capacitor.config.ts      # Capacitor 配置```js

└── package.json             # 依赖管理// eslint.config.js

```import reactX from 'eslint-plugin-react-x'

import reactDom from 'eslint-plugin-react-dom'

---

export default defineConfig([

## 🚀 第一次安装和运行  globalIgnores(['dist']),

  {

### 前置要求    files: ['**/*.{ts,tsx}'],

    extends: [

- **Node.js**：>= 18.0.0 (推荐使用最新 LTS 版本)      // Other configs...

- **npm**：>= 9.0.0 (Node.js 自带)      // Enable lint rules for React

- **Git**：用于版本控制      reactX.configs['recommended-typescript'],

      // Enable lint rules for React DOM

**Android 开发需要（可选）：**      reactDom.configs.recommended,

- **JDK**：>= 17    ],

- **Android Studio**：最新版本    languageOptions: {

- **Android SDK**：API Level 33 或更高      parserOptions: {

        project: ['./tsconfig.node.json', './tsconfig.app.json'],

### 1️⃣ 克隆项目        tsconfigRootDir: import.meta.dirname,

      },

```bash      // other options...

git clone <your-repository-url>    },

cd time-tracker  },

```])

```

### 2️⃣ 安装依赖

```bash
npm install
```

这会安装所有必需的依赖，包括：
- React 相关：`react`, `react-dom`
- UI 组件：`antd-mobile`
- 状态管理：`zustand`
- 数据库：`dexie`
- 工具库：`dayjs`, `uuid`, `xlsx`
- Capacitor：`@capacitor/core`, `@capacitor/android`

### 3️⃣ 启动开发服务器（Web 端）

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
- `entries`：时间记录
- `goals`：目标管理

**数据位置**：
- **Web 端**：浏览器的 IndexedDB
- **Android 端**：应用的 WebView 存储

**数据持久化**：
- 数据保存在本地，不会丢失
- 卸载应用会清空数据
- 可使用导出功能备份数据

---

## 📤 数据导出

应用支持导出数据为：
- **JSON 格式**：完整的数据结构
- **Excel 格式**：表格形式，方便查看和分析

导出的文件会保存到设备的下载目录。

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

## ✨ 更新日志

### v1.0.0 (2025-11-03)
- ✅ 初始版本发布
- ✅ 实时计时功能
- ✅ 手动添加记录
- ✅ 记录列表展示
- ✅ 数据导出（JSON/Excel）
- ✅ Android 应用支持
- ✅ 双按钮开始功能（从现在开始/接续上次）
- ✅ 时间选择器优化（只显示到分钟）

---

## 🔗 快速链接

- **完整开发参考**：查看 `reference.md`（如果存在）
- **Git 使用指南**：查看 [`GIT_GUIDE.md`](./GIT_GUIDE.md)
- **项目文档**：查看 `doc.md`（如果存在）

---

**如有问题或建议，欢迎提 Issue！**
