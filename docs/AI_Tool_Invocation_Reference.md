# AI 工具调用与信息获取技术参考文档

> **文档说明**
> 本文档面向开发者，系统性介绍当前 LLM 生态中三种主要的工具调用与信息获取范式：
> RAG（检索增强生成）、MCP（模型上下文协议）、Skills（AI 技能包）。
> 文档侧重技术细节、实现方式、生态现状与各自的适用边界，
> 不做主观推荐倾向，供读者结合具体场景自行判断与选型。

---

## 目录

1. [背景：LLM 的信息获取困境](#1-背景llm-的信息获取困境)
2. [RAG（检索增强生成）](#2-rag检索增强生成)
3. [MCP（模型上下文协议）](#3-mcp模型上下文协议)
4. [Skills（AI 技能包）](#4-skillsai-技能包)
5. [三者的关系与边界](#5-三者的关系与边界)
6. [横向对比](#6-横向对比)
7. [组合架构模式](#7-组合架构模式)
8. [生态与工具清单](#8-生态与工具清单)

---

## 1. 背景：LLM 的信息获取困境

大型语言模型（LLM）的知识来自训练数据，存在三个结构性局限：

**知识截止问题（Knowledge Cutoff）**
训练完成后，模型对新发生的事件、变更的数据一无所知。

**上下文窗口限制（Context Window）**
即便模型支持百万 token 的上下文，将全量私有数据注入仍不现实，且成本极高。

**幻觉问题（Hallucination）**
模型在知识边界模糊时倾向于生成看起来合理但实际错误的内容。

为解决这三个问题，工程界发展出了不同层次的解决方案，形成了当前的三种主流范式。

---

## 2. RAG（检索增强生成）

### 2.1 定义

RAG（Retrieval-Augmented Generation）是一种在 LLM 推理阶段动态注入外部知识的架构模式。其核心思想是：在生成回答前，先从外部知识库中检索与当前问题最相关的文本片段，将其作为上下文一同送入模型，从而让模型基于真实、可溯源的信息生成回答。

原始论文：[Lewis et al., 2020, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"](https://arxiv.org/abs/2005.11401)

### 2.2 工作流程

```
原始文档
   │
   ▼
文档预处理（清洗、格式统一）
   │
   ▼
文本分块（Chunking）
   │
   ▼
Embedding 模型（文本 → 高维向量）
   │
   ▼
向量数据库（存储向量 + 原始文本）
   │
   ·─────────────────────────────────────────────.
   │（以上为离线索引阶段，以下为在线查询阶段）    │
   ·─────────────────────────────────────────────'
   │
用户输入 Query
   │
   ▼
Query Embedding（将问题转为向量）
   │
   ▼
向量相似度检索（ANN 近似最近邻搜索）
   │
   ▼
返回 Top-K 相关文本片段
   │
   ▼
构造增强 Prompt（原始问题 + 检索到的上下文）
   │
   ▼
LLM 生成回答
   │
   ▼
（可选）引用溯源、答案后处理
```

### 2.3 关键技术组件

#### 2.3.1 文本分块（Chunking）

分块策略直接影响检索质量，是 RAG 系统中最容易被忽视的核心环节。

**固定大小分块（Fixed-size Chunking）**
按固定 token 数切割，如每块 512 tokens，块间有 50 tokens 重叠（overlap）以保留上下文连续性。实现简单，但可能在句子中间截断。

**递归字符分块（Recursive Character Splitting）**
按段落 → 句子 → 词语的层级递归切割，优先保留语义完整性。LangChain 的 `RecursiveCharacterTextSplitter` 是标准实现。

**语义分块（Semantic Chunking）**
计算相邻句子的 Embedding 相似度，在语义跳变处切割。能较好保留语义完整性，但计算代价更高。LlamaIndex 提供 `SemanticSplitterNodeParser`。

**文档结构感知分块（Structure-aware Chunking）**
利用文档原有结构（Markdown 标题、HTML 标签、PDF 书签）作为分割依据。适合结构化良好的文档。

**父子分块（Parent-Child Chunking）**
索引小块（用于精准检索），但返回大块（用于保留上下文）。LlamaIndex 的 `ParentChildNodeParser` 实现了这一模式。

#### 2.3.2 Embedding 模型

Embedding 模型将文本转为固定维度的稠密向量，决定了语义理解能力的上限。

| 模型 | 提供方 | 维度 | 语言支持 | 部署方式 | 备注 |
|------|--------|------|----------|----------|------|
| text-embedding-3-large | OpenAI | 3072 | 多语言 | API | 商业最强，中文中等 |
| text-embedding-3-small | OpenAI | 1536 | 多语言 | API | 性价比高 |
| text-embedding-004 | Google | 768 | 多语言 | API | - |
| BAAI/bge-m3 | BAAI | 1024 | 100+ 语言 | 本地 | 中英文混合最优开源方案，支持稀疏+稠密混合检索 |
| BAAI/bge-large-zh-v1.5 | BAAI | 1024 | 中文 | 本地 | 中文专项最强 |
| text-embedding-inference | HuggingFace | 可变 | 多语言 | 本地服务 | 支持批量推理，生产级部署 |
| voyage-3 | Voyage AI | 1024 | 多语言 | API | 代码检索效果优秀 |
| jina-embeddings-v3 | Jina AI | 1024 | 多语言 | API/本地 | 支持 8192 token 长文本 |

**评估基准：** [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) 是 Embedding 模型的标准评测榜单。

#### 2.3.3 向量数据库

向量数据库负责存储向量并执行高效的近似最近邻（ANN）搜索。

| 数据库 | 开源 | 部署方式 | 核心特性 | 适用场景 |
|--------|------|----------|----------|----------|
| Qdrant | ✅ | 本地/云 | 高性能、支持 payload 过滤、Rust 实现 | 生产级本地部署 |
| Weaviate | ✅ | 本地/云 | 内置混合检索（向量+BM25）、GraphQL API | 需要混合检索 |
| ChromaDB | ✅ | 本地/嵌入 | 轻量、Python 原生、零配置 | 本地开发和原型 |
| Milvus | ✅ | 本地/云 | 高并发、分布式、多向量索引 | 大规模企业部署 |
| pgvector | ✅ | PostgreSQL 扩展 | 直接在 PostgreSQL 中存储向量 | 已有 PG 数据库 |
| Pinecone | ❌ | 全托管云 | 零运维、自动扩缩容 | 不想运维基础设施 |
| LanceDB | ✅ | 本地/嵌入 | 列式存储、支持多模态 | 本地多模态场景 |
| Elasticsearch | ✅ | 本地/云 | 成熟的全文检索 + 向量混合 | 已有 ES 基础设施 |

**ANN 算法：** 主流向量数据库使用 HNSW（Hierarchical Navigable Small World）算法，在检索精度和速度之间取得最佳平衡。

#### 2.3.4 检索策略

**稠密检索（Dense Retrieval）**
纯向量相似度检索，基于语义匹配，适合模糊查询。

**稀疏检索（Sparse Retrieval / BM25）**
基于关键词的传统全文检索，适合精确词语匹配。

**混合检索（Hybrid Retrieval）**
将稠密和稀疏检索结果融合，通常用 RRF（Reciprocal Rank Fusion）算法合并排名。在大多数场景下优于单一检索方式。

**多查询检索（Multi-Query Retrieval）**
用 LLM 将原始问题改写成多个角度的查询，分别检索后合并去重，提升召回率。

**HyDE（Hypothetical Document Embedding）**
先用 LLM 生成一个假设性回答，用这个假设答案的 Embedding 去检索实际文档。在某些场景下显著提升检索相关性。

#### 2.3.5 重排序（Reranking）

检索阶段召回 Top-K（如 20）文档后，用专门的重排序模型对结果精排，最终只取前 3-5 个送入 LLM。

| 重排序模型 | 提供方 | 部署方式 |
|------------|--------|----------|
| rerank-english-v3.0 | Cohere | API |
| BAAI/bge-reranker-v2-m3 | BAAI | 本地 |
| jina-reranker-v2-base | Jina AI | API/本地 |
| cross-encoder/ms-marco | HuggingFace | 本地 |

### 2.4 RAG 进阶架构

#### Advanced RAG

在 Naive RAG 的基础上，引入预检索和后检索优化：

- **预检索（Pre-retrieval）：** 查询改写、查询分解、HyDE
- **后检索（Post-retrieval）：** 重排序、上下文压缩、冗余过滤

#### Modular RAG

将 RAG 拆解为可替换的模块（检索器、重排序器、生成器），允许为不同任务组合不同模块。

#### Agentic RAG

将检索作为 Agent 可以反复调用的工具，支持多跳检索（Multi-hop Retrieval）——先检索 A，根据 A 的内容决定是否检索 B，形成推理链。

#### GraphRAG

微软提出的方案，在向量检索之外构建知识图谱，支持实体关系推理。适合文档间关系复杂、需要跨文档推理的场景。参见 [GraphRAG 项目](https://github.com/microsoft/graphrag)。

### 2.5 主流编排框架

#### LangChain
- **定位：** 通用 LLM 应用编排框架，生态最大
- **RAG 支持：** 提供完整的文档加载、分块、检索、链式调用组件
- **文档：** https://python.langchain.com
- **适用：** 需要大量预置集成、快速原型

```python
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA

# 加载文档
loader = DirectoryLoader("./docs", glob="**/*.md")
docs = loader.load()

# 分块
splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
chunks = splitter.split_documents(docs)

# 向量化 + 存储
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vectorstore = Qdrant.from_documents(
    chunks, embeddings,
    url="http://localhost:6333",
    collection_name="my_docs"
)

# 检索链
qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4o"),
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5})
)
result = qa_chain.invoke({"query": "你的问题"})
```

#### LlamaIndex
- **定位：** 专注数据索引与检索，数据连接器更丰富
- **RAG 支持：** 内置多种高级检索策略（父子块、关键词、混合）
- **文档：** https://docs.llamaindex.ai
- **适用：** RAG 是核心场景，需要精细化检索控制

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import Settings
import qdrant_client

Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-m3")
Settings.text_splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)

client = qdrant_client.QdrantClient(host="localhost", port=6333)
vector_store = QdrantVectorStore(client=client, collection_name="my_docs")

documents = SimpleDirectoryReader("./docs", recursive=True).load_data()
index = VectorStoreIndex.from_documents(documents, vector_store=vector_store)

query_engine = index.as_query_engine(similarity_top_k=5)
response = query_engine.query("你的问题")
print(response.source_nodes)  # 查看来源
```

#### Haystack
- **定位：** 企业级，pipeline 设计模式，适合生产部署
- **文档：** https://docs.haystack.deepset.ai

#### DSPy
- **定位：** 斯坦福出品，将 Prompt 工程转化为可优化的程序
- **特点：** 支持自动优化 RAG pipeline 中的 Prompt
- **文档：** https://dspy.ai

### 2.6 数据摄入支持格式

LlamaIndex 和 LangChain 均支持大量数据源：

| 类型 | 支持格式/来源 |
|------|--------------|
| 文件 | PDF, Word (.docx), Markdown, HTML, TXT, CSV, JSON, EPUB |
| 代码 | Python, JS, Java 等源码文件（按语法结构分块） |
| 数据库 | PostgreSQL, MySQL, MongoDB（结构化数据转文本） |
| 云存储 | S3, Google Drive, OneDrive, Dropbox |
| 知识管理 | Notion, Confluence, Obsidian |
| 协作工具 | Slack, Discord, GitHub Issues/PRs |
| 网页 | URL 爬取、Sitemap 批量抓取 |

### 2.7 评估指标

| 指标 | 说明 | 工具 |
|------|------|------|
| 检索召回率（Recall@K） | 真实相关文档在 Top-K 中的比例 | 自建评估集 |
| 答案正确性（Faithfulness） | 答案是否与检索到的上下文一致 | RAGAS |
| 答案相关性（Answer Relevancy） | 答案是否切题 | RAGAS |
| 上下文精准度（Context Precision） | 检索到的内容是否都有用 | RAGAS |
| 端到端准确率 | 最终答案是否正确 | 自建评估集 |

**评估框架：**
- [RAGAS](https://github.com/explodinggradients/ragas)：专为 RAG 设计的评估框架
- [DeepEval](https://github.com/confident-ai/deepeval)：LLM 应用通用评估框架

---

## 3. MCP（模型上下文协议）

### 3.1 定义

MCP（Model Context Protocol）是 Anthropic 于 2024 年 11 月发布并开源的开放标准协议，定义了 LLM 应用与外部数据源、工具之间的通信规范。其目标是将当前碎片化的工具集成方式标准化——每个 LLM 应用不再需要为每个外部系统单独开发集成代码，而是遵循同一协议。

协议规范：https://spec.modelcontextprotocol.io
官方 SDK 和 Server：https://github.com/modelcontextprotocol

### 3.2 架构设计

MCP 采用 **Client-Server 架构**：

```
┌──────────────────────────────────────────────┐
│              宿主应用（Host）                  │
│  （Claude Desktop / IDE / 自建 Agent）         │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         MCP Client                   │    │
│  │  - 与 Server 建立 1:1 连接           │    │
│  │  - 负责协议握手和消息路由             │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
           │                    │
    stdio / HTTP/SSE     stdio / HTTP/SSE
           │                    │
┌──────────────────┐  ┌──────────────────────┐
│   MCP Server A   │  │   MCP Server B        │
│  （本地文件系统）  │  │  （远程 API/数据库）   │
│                  │  │                       │
│  暴露：          │  │  暴露：               │
│  - Tools         │  │  - Tools              │
│  - Resources     │  │  - Resources          │
│  - Prompts       │  │  - Prompts            │
└──────────────────┘  └──────────────────────┘
```

**三个核心角色：**
- **Host（宿主）：** 运行 LLM 的应用程序，如 Claude Desktop、IDE 插件
- **Client（客户端）：** 嵌入在宿主中，管理与 MCP Server 的连接
- **Server（服务端）：** 暴露具体能力的独立进程，可以是本地进程或远程服务

### 3.3 协议能力模型

MCP Server 可以暴露三类原语（Primitives）：

#### Tools（工具）
LLM 可以主动调用以执行操作的函数。工具调用会产生副作用（写入、修改、触发外部系统）。

```json
{
  "name": "create_file",
  "description": "在指定路径创建文件并写入内容",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "文件路径"
      },
      "content": {
        "type": "string",
        "description": "文件内容"
      }
    },
    "required": ["path", "content"]
  }
}
```

#### Resources（资源）
Server 暴露的数据，Client 可以读取。类似 REST 中的 GET 端点，只读、无副作用。

```json
{
  "uri": "file:///home/user/documents/report.md",
  "name": "季度报告",
  "description": "2024 年 Q4 季度报告",
  "mimeType": "text/markdown"
}
```

#### Prompts（提示模板）
Server 预定义的提示模板，可以接受参数并返回结构化 Prompt。

### 3.4 传输层

MCP 支持两种传输方式：

**stdio（标准输入输出）**
- 适用于本地进程间通信
- Host 以子进程方式启动 Server，通过 stdin/stdout 交换 JSON-RPC 消息
- 无需网络，延迟最低，最适合本地工具

**HTTP + SSE（Server-Sent Events）**
- 适用于远程 Server 或需要持久连接的场景
- Client 通过 HTTP POST 发送请求，Server 通过 SSE 推送响应
- 支持部署为独立的网络服务

### 3.5 协议消息格式

MCP 使用 JSON-RPC 2.0 作为消息格式。

**工具发现（Client → Server）：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**工具调用（Client → Server）：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_database",
    "arguments": {
      "query": "SELECT * FROM orders WHERE date > '2024-01-01'",
      "limit": 100
    }
  }
}
```

**工具响应（Server → Client）：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\": 1, \"amount\": 299.00, ...}]"
      }
    ],
    "isError": false
  }
}
```

### 3.6 SDK 与实现

#### 官方 SDK

| 语言 | 包名 | 安装 |
|------|------|------|
| Python | `mcp` | `pip install mcp` |
| TypeScript/Node.js | `@modelcontextprotocol/sdk` | `npm install @modelcontextprotocol/sdk` |
| Kotlin/Java | `mcp-kotlin` | Maven/Gradle |

#### Python Server 实现示例

```python
# server.py - 一个完整的自定义 MCP Server
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types
import asyncio
import httpx
import json

server = Server("my-data-server")

# ---- 声明工具 ----
@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="query_database",
            description="执行 SQL 查询并返回结果",
            inputSchema={
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "SQL 查询语句（只允许 SELECT）"
                    }
                },
                "required": ["sql"]
            }
        ),
        types.Tool(
            name="call_api",
            description="调用内部 REST API",
            inputSchema={
                "type": "object",
                "properties": {
                    "endpoint": {"type": "string"},
                    "method": {"type": "string", "enum": ["GET", "POST"]},
                    "body": {"type": "object"}
                },
                "required": ["endpoint", "method"]
            }
        )
    ]

# ---- 处理工具调用 ----
@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "query_database":
        sql = arguments["sql"]
        # 安全检查：只允许 SELECT
        if not sql.strip().upper().startswith("SELECT"):
            return [types.TextContent(type="text", text="错误：只允许 SELECT 查询")]
        # 执行查询（此处替换为实际数据库连接）
        result = await execute_query(sql)
        return [types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

    elif name == "call_api":
        async with httpx.AsyncClient() as client:
            if arguments["method"] == "GET":
                resp = await client.get(f"https://your-api.com{arguments['endpoint']}")
            else:
                resp = await client.post(
                    f"https://your-api.com{arguments['endpoint']}",
                    json=arguments.get("body", {})
                )
            return [types.TextContent(type="text", text=resp.text)]

# ---- 声明资源 ----
@server.list_resources()
async def list_resources() -> list[types.Resource]:
    return [
        types.Resource(
            uri="internal://config/app-settings",
            name="应用配置",
            description="当前应用的运行时配置",
            mimeType="application/json"
        )
    ]

@server.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "internal://config/app-settings":
        return json.dumps({"env": "production", "version": "2.1.0"})
    raise ValueError(f"未知资源: {uri}")

# ---- 启动 ----
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

#### TypeScript Server 实现示例

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-ts-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fetch_data",
      description: "从数据源获取数据",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string" },
          filters: { type: "object" }
        },
        required: ["source"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "fetch_data") {
    const data = await fetchFromSource(args.source, args.filters);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }
  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3.7 现有 MCP Server 生态

官方维护的 Server（https://github.com/modelcontextprotocol/servers）：

| Server 名称 | 功能 | 传输方式 |
|-------------|------|----------|
| `@modelcontextprotocol/server-filesystem` | 本地文件系统读写 | stdio |
| `@modelcontextprotocol/server-github` | GitHub 仓库操作 | stdio |
| `@modelcontextprotocol/server-postgres` | PostgreSQL 查询 | stdio |
| `@modelcontextprotocol/server-sqlite` | SQLite 操作 | stdio |
| `@modelcontextprotocol/server-google-drive` | Google Drive 集成 | stdio |
| `@modelcontextprotocol/server-slack` | Slack 消息和频道 | stdio |
| `@modelcontextprotocol/server-puppeteer` | 浏览器自动化 | stdio |
| `@modelcontextprotocol/server-brave-search` | Brave 搜索 API | stdio |
| `@modelcontextprotocol/server-memory` | 持久化键值记忆 | stdio |
| `@modelcontextprotocol/server-fetch` | HTTP 请求 | stdio |

社区维护的 Server 数量庞大，可在 https://glama.ai/mcp/servers 和 https://mcp.so 查阅。

### 3.8 MCP 支持的客户端（Host）

| 客户端 | 类型 | MCP 支持状态 |
|--------|------|-------------|
| Claude Desktop | 对话界面 | 官方支持，配置最完整 |
| Cursor | IDE | 内置支持 |
| Cline (VS Code 插件) | IDE 插件 | 完整支持 |
| Continue (VS Code/JetBrains) | IDE 插件 | 支持 |
| Zed | IDE | 支持 |
| LibreChat | 自托管对话界面 | 支持 |
| LangChain | 框架 | 通过 `langchain-mcp-adapters` |
| LlamaIndex | 框架 | 通过 `llama-index-tools-mcp` |

### 3.9 安全考量

- **最小权限原则：** Server 暴露的工具应有明确的权限边界，如数据库 Server 区分只读工具和写入工具
- **输入验证：** Server 需对所有工具调用参数进行严格验证，防止注入攻击
- **认证机制：** HTTP 传输模式下可通过 Header 传递 Token，stdio 模式下通过环境变量注入密钥
- **沙箱隔离：** 涉及代码执行或文件系统操作的 Server 应在容器或沙箱中运行
- **审计日志：** 生产环境的 Server 应记录所有工具调用日志

---

## 4. Skills（AI 技能包）

### 4.1 定义

Skills 是一种将特定任务的执行规程（Procedure）、最佳实践（Best Practices）和领域知识（Domain Knowledge）结构化封装的模式，使 AI 在执行该类任务时能够获得明确的操作指导。

Skills 不是一个统一的技术标准，而是一种**设计模式**，在不同的框架和产品中有不同的实现形态。其核心价值在于：将隐性的任务执行知识（如何做、用什么工具、避免哪些坑）转化为可复用、可版本管理的显性文档。

与 RAG 的区别：RAG 检索的是**数据/事实**，Skill 编码的是**操作方法/流程**。
与 MCP 的区别：MCP 解决的是**工具连接**问题，Skill 解决的是**任务执行策略**问题。

### 4.2 Skills 的实现形态

#### 形态一：文本 Skill 文档（最轻量）

存储为 Markdown 或纯文本文件，由 AI 在任务开始前读取。

```markdown
# SKILL: 生成技术调研报告

## 适用场景
当用户要求对技术方案进行调研、对比、选型时。

## 执行流程
1. 明确调研目标（是什么问题，当前技术栈是什么）
2. 列出候选方案（至少 3 个）
3. 建立对比维度（根据下方维度清单选择相关项）
4. 收集各方案信息
5. 按报告模板输出

## 对比维度清单（根据场景选择相关项）
- 性能基准（吞吐量、延迟、并发）
- 成熟度（版本历史、社区规模、企业采用情况）
- 许可证（商用是否免费）
- 运维复杂度（部署难度、监控、扩缩容）
- 学习曲线
- 生态集成（与现有技术栈的兼容性）
- 成本（license、基础设施、人力）
- 中文社区活跃度

## 报告模板
### 一句话结论
[直接给出推荐，不使用"视情况而定"等模糊表述]

### 背景
[问题描述、当前状态、调研动因]

### 候选方案对比
[Markdown 表格，维度从维度清单中选取]

### 推荐方案
[详细论证推荐理由，包括适用前提]

### 风险与注意事项
[迁移成本、已知 bug、需要注意的配置项]

### 参考资料
[来源列表]

## 质量要求
- 对比表不得少于 4 个维度
- 推荐结论必须明确，给出具体的方案名称
- 所有性能数据需注明来源和测试条件
- 不得出现"各有利弊"等无实质内容的表述
```

#### 形态二：Agent 框架中的 Task Definition

在 CrewAI、AutoGen 等框架中，Skill 以任务定义或 Agent Role 的形式存在：

```python
# CrewAI 中的 Skill 化 Agent
from crewai import Agent, Task, Crew

# 定义具有特定能力的 Agent（相当于 Skill 角色定义）
code_reviewer = Agent(
    role="高级代码审查工程师",
    goal="识别代码中的安全漏洞、性能问题和可维护性问题",
    backstory="""
        你是一名拥有 10 年经验的后端工程师，专注于代码质量和安全。
        你熟悉 OWASP Top 10，对 SQL 注入、XSS、CSRF 等漏洞有丰富的识别经验。
        你总是先理解代码意图，再评估实现质量。
    """,
    verbose=True,
    tools=[code_analysis_tool, security_scanner_tool]
)

# 定义任务（包含执行规程）
review_task = Task(
    description="""
        审查以下代码文件：{file_path}
        
        执行步骤：
        1. 先阅读整体结构，理解代码意图
        2. 检查安全漏洞（重点检查输入验证、SQL 查询、文件操作）
        3. 检查性能问题（N+1 查询、无意义的循环、内存泄漏点）
        4. 检查代码质量（命名、注释、函数长度、耦合度）
        5. 生成结构化报告
        
        输出格式：
        - 严重问题（必须修复）
        - 建议改进（可选但推荐）
        - 值得肯定的地方
    """,
    expected_output="包含问题清单和改进建议的 Markdown 格式审查报告",
    agent=code_reviewer
)
```

#### 形态三：LangChain 的 Structured Tool

```python
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

class CodeReviewInput(BaseModel):
    code: str = Field(description="需要审查的代码")
    language: str = Field(description="编程语言", default="python")
    focus: list[str] = Field(
        description="重点检查方面",
        default=["security", "performance", "readability"]
    )

def code_review_skill(code: str, language: str, focus: list[str]) -> str:
    """
    执行代码审查 Skill。
    内置了审查流程、评判标准和输出格式规范。
    """
    checklist = build_checklist(focus)  # 根据 focus 构建检查清单
    issues = analyze_code(code, language, checklist)
    return format_review_report(issues)

code_review_tool = StructuredTool.from_function(
    func=code_review_skill,
    name="code_review",
    description="对代码进行安全、性能和可读性审查，输出结构化报告",
    args_schema=CodeReviewInput
)
```

#### 形态四：System Prompt 中的内嵌 Skill

对于使用频率极高的固定任务，直接将 Skill 规程写入 System Prompt：

```python
SYSTEM_PROMPT = """
你是一名技术文档工程师。

当用户要求你编写 API 文档时，你必须：
1. 采用 OpenAPI 3.0 规范格式
2. 为每个端点提供 curl 示例
3. 列出所有可能的状态码和错误码
4. 对参数类型和取值范围有明确说明
5. 提供至少一个完整的请求/响应示例

当用户要求你编写 README 时，你必须包含：
1. 项目简介（一段话）
2. 快速开始（最短路径，5 分钟能跑起来）
3. 完整配置说明
4. 常见问题
5. 贡献指南

如果用户没有明确说明文档类型，先询问确认。
"""
```

### 4.3 Skills 的版本管理与分发

技术上，Skills 文档与代码一样需要版本管理：

```
skills/
├── README.md               # Skills 索引和使用说明
├── dev/
│   ├── code-review.md      # 代码审查 Skill
│   ├── tech-research.md    # 技术调研 Skill
│   └── api-design.md       # API 设计 Skill
├── writing/
│   ├── technical-doc.md    # 技术文档 Skill
│   ├── weekly-report.md    # 周报生成 Skill
│   └── commit-message.md   # Git Commit 规范 Skill
└── analysis/
    ├── data-analysis.md    # 数据分析 Skill
    └── log-debugging.md    # 日志排查 Skill
```

通过 MCP filesystem Server，AI 可以在运行时按需加载对应的 Skill 文件，而不是将所有 Skill 常驻 System Prompt。

### 4.4 Skills 与 Prompt Engineering 的关系

Skills 是结构化 Prompt Engineering 的进化形态：

| 维度 | 普通 Prompt | Skills |
|------|-------------|--------|
| 粒度 | 单次对话级 | 任务类型级 |
| 复用性 | 通常一次性 | 设计为多次复用 |
| 管理方式 | 散落在各处 | 集中管理、版本控制 |
| 加载时机 | 随系统提示常驻 | 按需动态加载 |
| 迭代方式 | 依赖个人经验 | 可量化、可对比测试 |

### 4.5 Skills 的质量评估

由于 Skills 本质上是 Prompt，其质量评估依赖于：

- **一致性测试：** 对相同类型任务运行多次，检验输出格式和质量的稳定性
- **边界测试：** 提供模糊、不完整的输入，观察 Skill 的健壮性
- **A/B 对比：** 有/无 Skill 的输出质量对比
- **用户反馈循环：** 记录生产环境中 Skill 触发的任务的用户满意度

---

## 5. 三者的关系与边界

### 5.1 解决的核心问题

| 技术 | 核心问题 | 类比 |
|------|----------|------|
| RAG | LLM 不知道这个领域的知识（What） | 给 LLM 一个图书馆 |
| MCP | LLM 无法操作这个系统（How to Act） | 给 LLM 一双手 |
| Skills | LLM 不知道这个任务的正确做法（How to Do） | 给 LLM 一本操作手册 |

### 5.2 互补而非替代

三者在架构中处于不同层次，可以叠加使用：

```
┌──────────────────────────────────────────────────────────────┐
│  用户输入：帮我生成本周的技术周报                              │
└──────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Skills 层         │
                    │  加载 weekly-      │
                    │  report.md，      │
                    │  确定输出结构和    │
                    │  质量标准         │
                    └─────────┬─────────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  RAG 层           │ │  MCP 层（实时）   │ │  MCP 层（操作）  │
│                  │ │                  │ │                  │
│  检索个人笔记库   │ │  查询 GitHub     │ │  将生成的周报    │
│  中本周相关的     │ │  本周的 PR 和    │ │  写入文件系统    │
│  技术决策记录     │ │  commit 记录     │ │  或发布到 Notion │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  LLM 综合生成   │
                    │  周报内容       │
                    └─────────────────┘
```

### 5.3 边界与局限

**RAG 的局限：**
- 无法执行操作，只能读取和注入知识
- 对实时性要求高的数据效果有限（需要频繁更新索引）
- 检索质量依赖分块策略和 Embedding 模型质量
- 复杂推理链（多跳问题）需要 Agentic RAG 才能处理

**MCP 的局限：**
- 每个 Server 的工具 schema 都占用 context token
- 安全边界需要严格设计，权限过大有风险
- 对于纯知识性问题，调用 MCP 工具带来不必要的延迟
- 网络不稳定时影响远程 Server 的可用性

**Skills 的局限：**
- 没有统一的技术标准，各实现之间不通用
- 动态加载 Skill 需要与文件系统或检索系统集成
- 过于复杂的 Skill 文档本身也会增加 context 占用
- Skill 的质量和覆盖度依赖人工沉淀，初期投入较高

---

## 6. 横向对比

| 对比维度 | RAG | MCP | Skills |
|----------|-----|-----|--------|
| **解决问题** | 知识获取 | 工具调用与操作 | 任务执行规范 |
| **数据类型** | 非结构化文本 | 结构化数据、API 调用 | 操作流程、最佳实践 |
| **时效性** | 取决于索引更新频率 | 实时 | 相对稳定 |
| **能否执行副作用** | 否（只读） | 是 | 取决于调用的工具 |
| **context 占用** | 中（检索片段） | 中高（工具 schema） | 低-中（按需加载） |
| **延迟** | 中（向量检索） | 中（网络调用） | 低（文本读取） |
| **基础设施要求** | 向量数据库、Embedding 服务 | MCP Server 进程 | 无（纯文本文件） |
| **开发工作量** | 中（索引建立、检索调优） | 中-高（Server 开发） | 低（编写文档） |
| **扩展性** | 高（增加文档即可） | 高（增加 Server） | 高（增加文件） |
| **标准化程度** | 高（有大量成熟框架） | 高（有官方规范） | 低（各实现差异大） |
| **成熟度** | 非常成熟（2020 年起）| 新兴成熟（2024 年底起）| 新兴实践 |
| **主要框架** | LangChain、LlamaIndex | 官方 SDK、MCP Clients | CrewAI、AutoGen、自定义 |
| **典型使用场景** | 知识库问答、文档检索 | Agent 工具调用、自动化 | 标准化 Agent 任务 |

---

## 7. 组合架构模式

以下是生产环境中常见的架构组合模式。

### 模式一：RAG + MCP（知识检索 + 实时操作）

适合场景：需要同时访问私有知识库和实时外部系统。

```
用户查询
   ↓
路由判断（是知识问题还是操作问题）
   ├── 知识问题 → RAG 检索 → 注入上下文 → LLM 回答
   ├── 操作问题 → MCP 工具调用 → 执行操作 → 返回结果
   └── 复合问题 → 先 RAG 获取上下文，再 MCP 执行操作
```

### 模式二：Skills + RAG（规范执行 + 知识支撑）

适合场景：需要按固定规范完成任务，同时需要检索私有知识。

```
用户触发特定类型任务
   ↓
Skills 层：加载对应任务的执行规程
   ↓
执行规程中触发 RAG 检索
   ↓
将检索结果按 Skill 规范组织输出
```

### 模式三：三者全栈（Skills + RAG + MCP）

适合场景：复杂 Agent 系统，需要规范化执行、私有知识检索和实时系统操作的完整整合。

```python
# 以 LangChain 为例的三者整合伪代码

from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools.retriever import create_retriever_tool

# 1. RAG 检索工具
retriever_tool = create_retriever_tool(
    retriever=vectorstore.as_retriever(),
    name="search_knowledge_base",
    description="检索内部知识库，获取文档、笔记和历史决策"
)

# 2. MCP 工具（通过 langchain-mcp-adapters 接入）
from langchain_mcp_adapters import MCPToolkit
mcp_tools = MCPToolkit(config_path="mcp_config.json").get_tools()

# 3. Skills 通过 System Prompt 注入
system_prompt = load_skill("skills/tech-research.md")

# 整合为 Agent
agent = create_openai_tools_agent(
    llm=llm,
    tools=[retriever_tool] + mcp_tools,
    prompt=ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad")
    ])
)

agent_executor = AgentExecutor(agent=agent, tools=[retriever_tool] + mcp_tools)
```

### 模式四：自托管全栈平台（Dify / AnythingLLM）

对于不想从零搭建的场景，Dify 提供了一站式平台：

| 平台 | RAG 支持 | MCP/工具 支持 | Workflow | 开源 | 自托管 |
|------|----------|---------------|----------|------|--------|
| Dify | ✅ 内置 | ✅ 内置 | ✅ | ✅ | ✅ |
| AnythingLLM | ✅ 内置 | ✅ Agent 工具 | 有限 | ✅ | ✅ |
| FlowiseAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| LangFlow | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenWebUI | ✅ | ✅ | 有限 | ✅ | ✅ |

---

## 8. 生态与工具清单

### 8.1 RAG 相关工具

| 类别 | 工具 | 说明 |
|------|------|------|
| 编排框架 | LangChain | 最大生态，通用 |
| 编排框架 | LlamaIndex | 专注检索，功能更深 |
| 编排框架 | Haystack | 企业级，Pipeline 架构 |
| 编排框架 | DSPy | 可优化的 Prompt 程序 |
| 向量数据库 | Qdrant | 高性能，Rust，本地/云 |
| 向量数据库 | Weaviate | 混合检索内置，GraphQL |
| 向量数据库 | ChromaDB | 轻量本地，开发首选 |
| 向量数据库 | pgvector | PostgreSQL 扩展 |
| 向量数据库 | Milvus | 分布式，大规模 |
| Embedding | BAAI/bge-m3 | 中英文最佳开源 |
| Embedding | text-embedding-3-large | OpenAI 商业最强 |
| Embedding | jina-embeddings-v3 | 长文本，8192 token |
| Reranking | BAAI/bge-reranker-v2-m3 | 开源跨语言 |
| Reranking | Cohere Rerank | 商业 API |
| 评估 | RAGAS | RAG 专用评估 |
| 评估 | DeepEval | LLM 应用通用评估 |
| 服务化 | HuggingFace TEI | Embedding 推理服务 |

### 8.2 MCP 相关工具

| 类别 | 工具 | 说明 |
|------|------|------|
| 官方 SDK | `mcp` (Python) | 官方 Python SDK |
| 官方 SDK | `@modelcontextprotocol/sdk` | 官方 TypeScript SDK |
| 客户端 | Claude Desktop | 官方桌面客户端 |
| 客户端 | Cursor | IDE，内置 MCP |
| 客户端 | Cline | VS Code 插件 |
| 框架集成 | langchain-mcp-adapters | LangChain 接入 MCP |
| 框架集成 | llama-index-tools-mcp | LlamaIndex 接入 MCP |
| Server 目录 | glama.ai/mcp/servers | 社区 Server 目录 |
| Server 目录 | mcp.so | 社区 Server 目录 |
| 调试工具 | MCP Inspector | 官方调试界面 |

### 8.3 Skills / Agent 相关框架

| 框架 | 语言 | 特点 |
|------|------|------|
| CrewAI | Python | 角色扮演多 Agent，直觉易用 |
| AutoGen | Python | 微软出品，多 Agent 对话 |
| LangGraph | Python | 基于图的 Agent 状态机，精细控制 |
| TaskWeaver | Python | 微软，专注数据分析场景 |
| OpenAgents | Python | 面向通用任务的 Agent |
| Semantic Kernel | Python/C# | 微软，企业级，Skills 概念最系统化 |

> **注：** Microsoft Semantic Kernel 是将 Skills 概念系统化实现最完整的框架，其中 Skills（现更名为 Plugins）是核心设计原语，包含 Native Functions 和 Semantic Functions 两种形式。

---

*文档版本：2025 年初整理*
*适用读者：具备编程能力的开发者*
*参考资料：*
- *https://arxiv.org/abs/2005.11401（RAG 原始论文）*
- *https://spec.modelcontextprotocol.io（MCP 官方规范）*
- *https://github.com/modelcontextprotocol（MCP 官方实现）*
- *https://python.langchain.com（LangChain 文档）*
- *https://docs.llamaindex.ai（LlamaIndex 文档）*
- *https://github.com/explodinggradients/ragas（RAGAS 评估框架）*
- *https://huggingface.co/spaces/mteb/leaderboard（MTEB Embedding 排行榜）*
