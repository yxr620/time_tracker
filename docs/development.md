# 开发指南

## 前置要求

- **Node.js** >= 18.0.0（推荐最新 LTS）
- **npm** >= 9.0.0
- **Git**

**Android 开发额外需要：**
- JDK >= 17
- Android Studio（最新版）
- Android SDK API Level 33+

**macOS 桌面端额外需要：**
- Xcode Command Line Tools

## 安装与启动

```bash
git clone https://github.com/yxr620/time_tracker.git
cd time_tracker
npm install
cp .env.example .env.local   # 按需配置 OSS 同步和 AI（可选）
npm run dev                   # http://localhost:5173
```

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器（HMR） |
| `npm run build` | TypeScript 编译 + Vite 生产构建 → `dist/` |
| `npm run lint` | ESLint 检查 |
| `npm run preview` | 预览生产构建 |
| `npm run ai:debug` | AI 助手 CLI 调试 |

## 环境变量

复制 `.env.example` → `.env.local`。所有变量均可选，不配置时对应功能不可用，但应用正常运行。

```dotenv
# 同步（可选）
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket-name
VITE_OSS_ACCESS_KEY_ID=your-access-key-id
VITE_OSS_ACCESS_KEY_SECRET=your-access-key-secret

# AI 助手（可选）
VITE_AI_PROVIDER_ID=qwen
VITE_AI_MODEL=qwen3.5-plus
VITE_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
VITE_AI_API_KEY=your-api-key
```

> **优先级**：应用内设置（localStorage）> `.env` 环境变量。

## AI CLI 调试

```bash
npm run ai:debug -- --data ./path/to/export.json --verbose
```

详细参数见 `npm run ai:debug -- --help`。

---

## Android 开发

### 首次设置

1. 配置 SDK 路径 — 创建 `android/local.properties`（已被 git 忽略）：

```properties
sdk.dir=/Users/你的用户名/Library/Android/sdk
```

> SDK 路径可在 Android Studio → Preferences → Android SDK 中找到。

2. 构建并同步：

```bash
npm run build && npx cap copy
```

3. 打开 Android Studio：

```bash
npx cap open android
```

### 日常开发流程

```bash
npm run build && npx cap copy
# 在 Android Studio 中点击 Run
```

- `npm run build` — TypeScript 检查 + 构建 `dist/`
- `npx cap copy` — 复制 `dist/` 到 `android/app/src/main/assets/public/`

### 真机调试

1. 手机 → 设置 → 关于手机 → 连续点击"版本号"7 次（启用开发者选项）
2. 开发者选项 → 打开 USB 调试
3. USB 连接手机，手机上允许调试
4. Android Studio 选择设备 → Run

### 发布 APK

将 Chrono 打包为签名 APK 并发布到 GitHub Release。

#### 前提条件

- Java 21（Android Studio 内置 JBR）
- [GitHub CLI (`gh`)](https://cli.github.com/)，已登录
- 签名密钥 `~/chrono-release-key.jks`（创建方法见末尾附录）

#### 快速参考

将 `<VERSION>` 替换为实际版本号（如 `0.0.2`）：

```bash
VERSION=0.0.2
cd /Users/lumosk/Workspace/time_tracker

# 安全构建（移除 .env 防止密钥泄露到 JS）
mv .env .env.backup 2>/dev/null; mv .env.local .env.local.backup 2>/dev/null
npm run build
mv .env.backup .env 2>/dev/null; mv .env.local.backup .env.local 2>/dev/null

# 验证构建产物无密钥
grep -r "LTAI\|sk-\|pUVf" dist/assets/*.js && echo "⚠️ 停止！" && exit 1

# 打包签名
npx cap sync android
cd android && ./gradlew assembleRelease
~/Library/Android/sdk/build-tools/36.1.0/apksigner sign \
  --ks ~/chrono-release-key.jks --ks-key-alias chrono \
  --out app/build/outputs/apk/release/chrono-v${VERSION}.apk \
  app/build/outputs/apk/release/app-release-unsigned.apk

# 发布
cd /Users/lumosk/Workspace/time_tracker
gh release create v${VERSION} \
  android/app/build/outputs/apk/release/chrono-v${VERSION}.apk \
  --title "Chrono v${VERSION}" --notes "Release notes" --prerelease
```

> `build-tools` 版本号按实际安装调整：`ls ~/Library/Android/sdk/build-tools/`

#### 安全注意事项

1. **永远不要在 `.env` 存在时构建发布 APK** — Vite 会把 `VITE_*` 变量编译进 JS
2. **Keystore 不要提交到 Git**
3. **密钥泄露处理**：删除 Release → 禁用旧 AccessKey → 重新生成 API Key

#### 版本号规范

采用 Semantic Versioning：`0.0.x`（早期）→ `0.x.0`（迭代）→ `1.0.0+`（正式）。每次发布前更新 `android/app/build.gradle` 中的 `versionCode` 和 `versionName`。

#### 附录：创建签名密钥（仅首次）

```bash
keytool -genkey -v -keystore ~/chrono-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias chrono
```

---

## macOS 桌面端开发（Electron）

### 首次设置

```bash
npm install @capacitor-community/electron
npx cap add @capacitor-community/electron
```

### 构建与运行

```bash
npm run build
npx cap sync @capacitor-community/electron
cd electron && npm run electron:start    # 调试端口 5858
```

### 打包发布

```bash
cd electron
npm install
npm run electron:make    # 生成 .dmg / .app
```

打包产物在 `electron/dist` 目录。

**数据存储**：`~/Library/Application Support/Chrono/`

---

## 数据导出与导入

### 导出

应用支持三种导出方式：
- **全量导出**：所有记录、目标、类别
- **增量导出**：自上次同步后的新数据
- **时间范围导出**：指定时间段

导出格式为 JSON。文件名格式：`time-tracker-{type}-YYYYMMDD-HHmmss.json`

### 导入

两种导入策略：
- **合并模式**（推荐）：保留现有数据，相同 ID 的记录会被更新
- **替换模式**：清空所有现有数据后导入（不可撤销）

操作：导出页 → 导入数据 → 选择策略 → 选择 JSON 文件。

---

## 常见问题

**端口 5173 被占用？** — 检查终端输出的实际 URL，或关闭占用进程。

**Android Studio 找不到 SDK？** — 检查 `android/local.properties` 的 `sdk.dir` 路径。

**Android 应用未更新？** — 必须先 `npm run build && npx cap copy`，再在 Android Studio 中 Build → Clean Project → Run。

**清空 IndexedDB 数据？**
- Web：浏览器 DevTools → Application → Storage → Clear Site Data
- Android：设置 → 应用 → Chrono → 清除数据

**多设备数据恢复？** — 旧设备全量导出 → 传输文件 → 新设备导入（替换模式）。如已配置 OSS 同步，数据会自动同步。

---

## Git 提交规范

```
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式
refactor: 重构
perf: 性能优化
chore: 构建/工具链
```
