# Git 仓库使用指南

## ✅ 已完成的设置

### 1. Git 仓库已初始化
- 仓库位置: `/Users/yxr/Documents/time_app/time-tracker`
- 默认分支: `main`
- 初始提交: `c5804ef` - "Initial commit: Time Tracker App with Capacitor Android support"

### 2. .gitignore 配置

已配置忽略以下文件和目录：

#### Node.js 相关
- `node_modules/` - 依赖包（通过 npm install 安装）
- `package-lock.json` 已提交（推荐保留以确保依赖版本一致）

#### 构建输出
- `dist/` - Vite 构建输出
- `dist-ssr/` - SSR 构建输出

#### Android 构建产物
- `android/.gradle/` - Gradle 缓存
- `android/build/` - Gradle 构建输出
- `android/app/build/` - App 构建输出
- `android/.idea/` - Android Studio 配置（部分）
- `android/local.properties` - 本地 SDK 路径配置

#### Capacitor 生成文件
- `android/app/src/main/assets/public/` - 复制的 web 资源
- `android/app/src/main/assets/capacitor.config.json` - 生成的配置
- `android/app/src/main/assets/capacitor.plugins.json` - 生成的插件配置
- `android/capacitor-cordova-android-plugins/` - Cordova 插件

#### 环境变量
- `.env`
- `.env.local`
- `.env.*.local`

#### 编辑器配置
- `.vscode/*` (除了 extensions.json)
- `.idea/`
- `.DS_Store` (macOS)

#### 其他
- `*.log` - 日志文件
- `.cache/` - 缓存目录
- `coverage/` - 测试覆盖率报告

## 📝 日常使用命令

### 查看状态
```bash
git status
```

### 查看修改
```bash
# 查看工作区修改
git diff

# 查看已暂存的修改
git diff --staged
```

### 添加文件到暂存区
```bash
# 添加所有修改
git add .

# 添加特定文件
git add src/App.tsx

# 添加特定目录
git add src/components/
```

### 提交修改
```bash
# 提交暂存的修改
git commit -m "feat: 添加双按钮开始功能"

# 修改上一次提交（未推送前）
git commit --amend -m "feat: 添加双按钮开始功能（修正）"
```

### 查看历史
```bash
# 简洁查看
git log --oneline

# 详细查看
git log

# 查看某个文件的历史
git log -- src/App.tsx

# 图形化查看分支
git log --graph --oneline --all
```

### 撤销修改
```bash
# 撤销工作区的修改（危险操作！）
git checkout -- src/App.tsx

# 取消暂存（保留工作区修改）
git reset HEAD src/App.tsx

# 回退到上一次提交（危险操作！）
git reset --hard HEAD^
```

## 🌿 分支管理

### 创建和切换分支
```bash
# 创建新分支
git branch feature/new-feature

# 切换分支
git checkout feature/new-feature

# 创建并切换（推荐）
git checkout -b feature/new-feature
```

### 合并分支
```bash
# 切换到主分支
git checkout main

# 合并特性分支
git merge feature/new-feature
```

### 删除分支
```bash
# 删除已合并的分支
git branch -d feature/new-feature

# 强制删除未合并的分支
git branch -D feature/new-feature
```

## 🔄 推荐的提交信息格式

使用约定式提交（Conventional Commits）：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整（不影响功能）
refactor: 代码重构
perf: 性能优化
test: 添加测试
chore: 构建过程或辅助工具的变动
```

示例：
```bash
git commit -m "feat: 实现从上次结束时间开始追踪功能"
git commit -m "fix: 修复时间选择器显示秒的问题"
git commit -m "docs: 更新 README 使用说明"
```

## 🚀 连接到远程仓库（可选）

### GitHub
```bash
# 添加远程仓库
git remote add origin https://github.com/your-username/time-tracker.git

# 推送到远程
git push -u origin main

# 之后可以简化为
git push
```

### GitLab/Gitee 类似
```bash
git remote add origin <你的仓库地址>
git push -u origin main
```

## 📦 构建前的检查清单

在执行 `npm run build` 之前：

1. ✅ 确保所有更改已提交
   ```bash
   git status  # 应该显示 "working tree clean"
   ```

2. ✅ 查看最近的提交
   ```bash
   git log --oneline -5
   ```

3. ✅ 如果需要，创建标签
   ```bash
   git tag v1.0.0
   git tag -a v1.0.0 -m "Release version 1.0.0"
   ```

## 🔍 查看被忽略的文件

如果想确认哪些文件被 .gitignore 忽略了：

```bash
# 查看所有被忽略的文件
git status --ignored

# 查看特定文件是否被忽略
git check-ignore -v node_modules
```

## 💡 实用技巧

### 1. 临时保存工作进度
```bash
# 保存当前工作
git stash

# 查看保存的工作
git stash list

# 恢复工作
git stash pop
```

### 2. 查看某次提交的内容
```bash
git show c5804ef
```

### 3. 比较两次提交
```bash
git diff c5804ef HEAD
```

### 4. 搜索历史提交
```bash
# 搜索提交信息
git log --grep="修复"

# 搜索代码变更
git log -S "function_name"
```

## ⚠️ 注意事项

1. **不要提交敏感信息**
   - API 密钥
   - 密码
   - 个人隐私数据
   - 使用 .env 文件存储敏感信息（已在 .gitignore 中）

2. **构建产物已被忽略**
   - `dist/` 目录不会被提交
   - `android/build/` 不会被提交
   - 每次需要时重新构建

3. **Android 项目的特殊文件**
   - `local.properties` 已忽略（包含本地 SDK 路径）
   - 如果团队协作，确保大家的 Android SDK 路径配置正确

4. **package-lock.json**
   - 已包含在仓库中
   - 建议保留，确保团队使用相同的依赖版本

## 📚 下一步

1. **如果要备份到云端**：创建 GitHub/GitLab 仓库并推送

2. **如果要团队协作**：
   - 创建 `.github` 目录添加 PR 模板
   - 设置分支保护规则
   - 配置 CI/CD

3. **版本标签**：使用 `git tag` 标记版本发布

---

**当前仓库状态**: ✅ 已初始化，包含 78 个文件，第一次提交完成
