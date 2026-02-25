# AI 时间助手 - 技术文档

> 本文档面向开发者，详细说明 AI 时间助手功能的技术架构、模块设计与数据流。
> 用户使用指南请查看 [manual.md](./manual.md)。

---

## 1. 架构概述

AI 时间助手采用 **Function Calling（工具调用）** 架构，让 LLM 自主决定查询哪些数据。核心设计：

- **前端本地数据**：所有时间记录存储在浏览器 IndexedDB（Dexie.js），LLM 无法直接访问
- **工具调用桥接**：将数据查询能力封装为 LLM 可调用的工具函数，在浏览器本地执行
- **多轮循环**：LLM 可多次调用工具，获取多个时间段、多种筛选维度的数据后综合回答

```
用户提问
   │
   ▼
┌──────────────────────────────────┐
│  buildSystemPrompt()             │
│  角色 + 当前日期 + 类别列表       │
│  + 工具使用指南 + 回答规则        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  LLM 请求（非流式 + tools）       │
│  LLM 分析用户意图，决定调用工具    │
│  ↓                               │
│  返回 tool_calls:                │
│  [query_time_entries(1月, 学习),  │
│   query_time_entries(2月, 学习)]  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  本地执行工具（IndexedDB 查询）   │
│  工具结果 → role: 'tool' 回填     │
└──────────────┬───────────────────┘
               │
               ▼  ← 可循环最多 5 轮
┌──────────────────────────────────┐
│  LLM 最终回答（流式输出）         │
└──────────────────────────────────┘
```

---

## 2. 模块结构

```
src/services/ai/
├── toolCallEngine.ts    # 工具调用循环引擎（核心编排）
├── toolDefinitions.ts   # 工具 schema 定义 + 本地执行函数
├── llmClient.ts         # LLM 网络层（流式/非流式/工具调用）
├── providers.ts         # 服务商预设配置
├── contextBuilder.ts    # [遗留] 旧版上下文构建器（已弃用）
└── intentParser.ts      # [遗留] 旧版正则时间解析（已弃用）

src/components/AIAssistant/
├── AIAssistant.tsx      # 对话界面主组件
├── AIAssistant.css      # 样式
└── AISettings.tsx       # 服务商配置弹窗

src/stores/
└── aiStore.ts           # AI 配置 + 对话状态管理（Zustand）
```

---

## 2.1 配置来源与优先级（UI + CLI 统一）

AI 配置支持统一从 `.env` 提供默认值，并允许用户后续覆盖。

### 环境变量

优先读取以下变量（CLI 同时兼容无 `VITE_` 前缀的同名变量）：

- `VITE_AI_PROVIDER_ID`（或 `VITE_AI_PROVIDER`）
- `VITE_AI_MODEL`
- `VITE_AI_BASE_URL`
- `VITE_AI_API_KEY`

### 生效规则

1. **UI 首次默认值**：从 `.env` 读取
2. **用户在 UI 修改后**：保存到 `localStorage(ai-config)`，后续优先使用用户值
3. **CLI 调试**：直接读取 `.env`（可被命令行参数覆盖）

这让 Web/Electron UI 与命令行调试保持同一套默认配置，避免重复维护。

---

## 2.2 CLI 调试入口

新增脚本：

```bash
npm run ai:debug -- [options]
```

常用参数：

- `--provider <id>`
- `--model <name>`
- `--base-url <url>`
- `--api-key <key>`
- `--data <file>`（加载导出的 JSON 数据）
- `--verbose`（显示完整调试日志）

CLI 会打印每轮 `phase`、`tool call`、工具参数与结果摘要，以及最终回答流式输出，便于调试 prompt / tool-use 行为。

---

## 3. 工具定义 (`toolDefinitions.ts`)

### 3.1 工具列表

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `query_time_entries` | `start_date`, `end_date`, `category?`, `goal?` | 查询时间记录，返回统计摘要 + 详细记录（最多 200 条） |
| `list_categories` | 无 | 获取所有活动类别名称 |
| `list_goals` | `start_date`, `end_date` | 获取指定日期范围的目标列表 |

### 3.2 工具 Schema（OpenAI Function Calling 格式）

每个工具按 OpenAI `tools` 标准格式声明，包含 `type: 'function'`、`function.name`、`function.description`、`function.parameters`（JSON Schema）。

### 3.3 执行路由

`executeTool(name, args)` 根据工具名分发到对应的本地函数：

- **`queryTimeEntries`**：
  1. 解析日期参数，创建 `DateRange`
  2. 如有 `category` / `goal` 参数，通过名称模糊匹配到 ID
  3. 调用 `loadRawData(filters)` 从 IndexedDB 查询
  4. 调用 `processEntries()` 关联类别名/目标名
  5. 聚合统计（类别分布、目标分布 Top 10）
  6. 格式化为结构化文本返回

- **`listCategories`**：直接从 `db.categories` 读取

- **`listGoals`**：从 `db.goals` 按日期范围过滤

---

## 4. 工具调用引擎 (`toolCallEngine.ts`)

### 4.1 入口函数

```typescript
runToolCallLoop(
  config: LLMConfig,
  userQuery: string,
  history: ChatMessage[],
  callbacks: ToolCallEngineCallbacks,
  signal?: AbortSignal,
): Promise<{ content: string; thinking?: string }>
```

### 4.2 执行流程

1. **构建 System Prompt**：角色定义 + 当前日期 + 类别列表 + 工具使用指南 + 回答规则
2. **发起非流式请求**（带 `tools` 参数）
3. **检查响应**：
   - 有 `tool_calls` → 本地执行工具 → 结果以 `role: 'tool'` 回填消息列表 → 回到步骤 2
   - 无 `tool_calls` → LLM 直接返回了文本回答
4. **循环上限**：最多 5 轮工具调用，防止无限循环
5. **最终输出**：流式调用 `chatStream` 输出最终回答

### 4.3 回调接口

| 回调 | 用途 |
|------|------|
| `onPhase(phase, detail)` | 阶段更新（preparing / thinking / toolCall / answering） |
| `onChunk(delta)` | 流式文本增量 |
| `onThinking(delta)` | 推理过程增量（DeepSeek-R1 / QwQ 等 thinking 模型） |
| `onToolCall(info)` | 工具被调用的通知 |

### 4.4 Fallback 机制

如果 LLM 不支持 Function Calling（返回错误或直接回答），引擎会跳过工具调用循环，直接使用流式请求让 LLM 基于 system prompt 中的信息回答。

---

## 5. LLM 网络层 (`llmClient.ts`)

所有 LLM API 调用遵循 **OpenAI 兼容协议**（`/chat/completions`），零外部依赖，使用原生 `fetch` + `ReadableStream`。

### 5.1 三个调用函数

| 函数 | 模式 | 用途 |
|------|------|------|
| `chatStream(config, messages, onChunk, signal, onThinking)` | 流式 SSE | 最终回答的打字机输出 |
| `chatOnce(config, messages, signal)` | 非流式 | [遗留] 轻量单次调用 |
| `chatWithTools(config, messages, tools, signal)` | 非流式 + tools | 工具调用请求，返回含 `tool_calls` 的完整 message |

### 5.2 流式解析

- 解析 SSE（Server-Sent Events）`data:` 行
- 提取 `delta.content`（正文）和 `delta.reasoning_content` / `delta.thinking_content`（推理过程）
- 支持 `[DONE]` 信号和畸形 JSON 容错

### 5.3 请求参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `temperature` | 0.7 | 生成多样性 |
| `max_tokens` | 2048 | 单次最大输出 |
| `stream` | true/false | 根据调用函数决定 |

---

## 6. 服务商配置 (`providers.ts`)

内置以下 OpenAI 兼容服务商预设：

| 服务商 | ID | Base URL | 默认模型 |
|--------|-----|----------|----------|
| 通义千问 | `qwen` | `dashscope.aliyuncs.com/compatible-mode/v1` | qwen3.5-plus |
| Gemini | `gemini` | `generativelanguage.googleapis.com/v1beta/openai` | gemini-3-flash-preview |
| 智谱 GLM | `glm` | `open.bigmodel.cn/api/paas/v4` | glm-4-flash |
| Kimi | `kimi` | `api.moonshot.cn/v1` | moonshot-v1-auto |
| MiniMax | `minimax` | `api.minimax.chat/v1` | MiniMax-Text-01 |
| OpenAI | `openai` | `api.openai.com/v1` | gpt-4.1-mini |
| 自定义 | `custom` | 用户填写 | 用户填写 |

**每个 Provider 的配置独立保存**（`localStorage`），切换服务商时自动恢复对应的 API Key 和模型选择，无需重新填写。

---

## 7. 状态管理 (`aiStore.ts`)

使用 Zustand 管理两部分状态：

### 7.1 配置状态

```typescript
interface AIConfig {
  providerId: string;  // 当前服务商 ID
  baseURL: string;     // API 端点
  apiKey: string;      // API 密钥
  model: string;       // 模型名称
}
```

- 持久化到 `localStorage`（key: `ai-config`）
- 支持从旧版单配置格式自动迁移

### 7.2 对话状态

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  loading?: boolean;       // 是否正在生成
  error?: boolean;         // 是否出错
  phases?: Phase[];        // 执行阶段列表
  thinking?: string;       // 推理过程
}
```

- `phases` 数组记录每次对话的执行阶段（准备、分析、工具调用、生成），在 UI 上以步骤列表展示
- `thinking` 记录 thinking 模型的推理过程，在 UI 上以可折叠面板展示

---

## 8. UI 组件

### 8.1 AIAssistant.tsx（主面板）

- **欢迎界面**：无消息时显示快捷 Prompt 按钮（7 个预设问题）
- **对话区**：消息气泡列表，支持 Markdown 渲染（加粗、列表、标题、代码）
- **阶段指示器**（`PhasesIndicator`）：显示当前请求的处理阶段
  - 📋 准备上下文
  - 💭 分析问题
  - 🔧 查询数据（显示具体的查询参数）
  - ✍️ 生成回答
- **输入区**：自适应高度的 textarea + 发送/停止按钮
- **流式输出**：打字机效果 + 闪烁光标

### 8.2 AISettings.tsx（设置弹窗）

- 服务商下拉选择（已配置的标记 ✓）
- API Key 输入（password 类型，仅存本地）
- 模型选择（预设列表或自定义输入）
- 高级设置：Base URL 修改（支持 Ollama 本地模型等自定义端点）

---

## 9. 安全与隐私

- **API Key 仅存储在浏览器 localStorage**，不会上传到任何第三方服务器
- **时间记录数据不离开本地**，工具函数在浏览器内执行，仅将格式化后的文本摘要发送给 LLM
- **LLM API 调用直接从浏览器发往用户选择的服务商**，无中间代理
- 用户可随时在设置中清除 API Key
