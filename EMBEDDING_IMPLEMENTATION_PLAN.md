# 代码向量化与语义搜索实现计划

## 项目概述

基于 **OpenAI Embeddings API + Qdrant** 的代码语义搜索系统，为 `tauri-code-base-analyzer` 项目添加智能代码检索功能。

**核心目标**：

- 将代码库转换为语义向量
- 支持自然语言搜索代码
- 理解代码的功能和意图
- 实现跨文件的代码关联

**技术栈**：

- **后端**：Rust + Tauri
- **向量化**：OpenAI Embeddings API (text-embedding-3-small)
- **向量数据库**：Qdrant
- **代码解析**：tree-sitter（已有）

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面 (前端)                           │
│                    自然语言搜索 + 结果展示                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Tauri 后端 (Rust)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 代码提取模块  │→ │ 分块增强模块  │→ │ 向量化模块    │          │
│  │ (已完成 70%) │  │ (待实现)     │  │ (待实现)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────┐          │
│  │             向量存储与检索模块                      │          │
│  │              (Qdrant Client)                     │          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      外部服务                                     │
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │ OpenAI API       │        │ Qdrant Server    │              │
│  │ (Embeddings)     │        │ (本地/云端)       │              │
│  └──────────────────┘        └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实施阶段

### 📦 阶段 0：环境准备与依赖安装 (1-2 天)

#### 任务清单

- [ ] **安装 Qdrant**

  ```bash
  # 方式 1: Docker (推荐)
  docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage \
    qdrant/qdrant

  # 方式 2: 本地二进制
  # https://qdrant.tech/documentation/quick-start/
  ```

- [ ] **注册 OpenAI API**

  - 访问：https://platform.openai.com/api-keys
  - 创建 API Key
  - 配置环境变量：`OPENAI_API_KEY`

- [ ] **添加 Rust 依赖**

  ```toml
  # src-tauri/Cargo.toml
  [dependencies]
  # 现有依赖
  tree-sitter = "0.22"
  tree-sitter-typescript = "0.21"
  tree-sitter-rust = "0.21"
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"

  # 新增依赖
  qdrant-client = "1.7"           # Qdrant 客户端
  reqwest = { version = "0.11", features = ["json"] }  # HTTP 客户端
  tokio = { version = "1", features = ["full"] }       # 异步运行时
  anyhow = "1.0"                  # 错误处理
  regex = "1.10"                  # 正则表达式
  lazy_static = "1.4"             # 全局变量
  ```

- [ ] **项目结构调整**
  ```
  src-tauri/src/
  ├── tool_execution/
  │   └── codebase/
  │       ├── extractors/         (已有)
  │       │   ├── mod.rs
  │       │   ├── typescript.rs
  │       │   ├── vue.rs
  │       │   └── type_utils.rs
  │       ├── chunking.rs         (新增)
  │       ├── embeddings.rs       (新增)
  │       ├── vector_store.rs     (新增)
  │       └── indexer.rs          (新增)
  ```

#### 验收标准

- ✅ Qdrant 服务正常运行，访问 http://localhost:6333/dashboard
- ✅ OpenAI API 密钥有效，能成功调用
- ✅ 所有依赖编译通过

---

### 🔨 阶段 1：代码分块模块 (2-3 天)

#### 目标

将提取的 `CodeEntity` 转换为包含完整代码内容和上下文的 `CodeChunk`。

#### 任务清单

- [ ] **创建 CodeChunk 数据结构**

  ```rust
  // src-tauri/src/tool_execution/codebase/chunking.rs

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct CodeChunk {
      // 基础信息
      pub id: String,
      pub entity_type: String,
      pub file: String,
      pub raw_name: String,
      pub loc: LocationInfo,

      // 代码内容
      pub code: String,

      // 上下文信息
      pub imports: Vec<String>,
      pub exports: Vec<String>,
      pub comments: Option<String>,

      // 用于 embedding 的格式化文本
      pub embedding_text: String,
  }
  ```

- [ ] **实现代码提取功能**

  - 从文件中读取指定行范围的代码
  - 处理边界情况（文件开头/结尾）
  - 保留代码缩进

- [ ] **实现上下文分析**

  - 提取 import 语句
  - 提取 export 语句
  - 提取注释（JSDoc、单行、多行）
  - 识别依赖关系

- [ ] **实现 embedding 文本格式化**

  - 添加结构化元数据
  - 包含文件路径、类型、名称
  - 包含导入依赖信息
  - 优化 token 使用

- [ ] **单元测试**

  ```rust
  #[test]
  fn test_chunk_creation() {
      // 测试从 CodeEntity 创建 CodeChunk
  }

  #[test]
  fn test_import_extraction() {
      // 测试导入语句提取
  }

  #[test]
  fn test_embedding_text_format() {
      // 测试格式化文本生成
  }
  ```

#### 关键实现细节

**格式化模板**：

```
# File: src/components/Button.tsx
# Type: component
# Name: Button
# Location: Lines 10-25
# Imports: react, ./styles.css

## Code:
export function Button({ onClick, children }: ButtonProps) {
    return (
        <button onClick={onClick} className="btn">
            {children}
        </button>
    );
}
```

#### 验收标准

- ✅ 能从 CodeEntity 生成完整的 CodeChunk
- ✅ 正确提取代码内容和上下文
- ✅ embedding_text 格式符合要求
- ✅ 所有测试通过

---

### 🧠 阶段 2：向量化模块 (2-3 天)

#### 目标

调用 OpenAI API 将代码块转换为向量。

#### 任务清单

- [ ] **创建 EmbeddingsClient**

  ```rust
  // src-tauri/src/tool_execution/codebase/embeddings.rs

  pub struct EmbeddingsClient {
      api_key: String,
      client: reqwest::Client,
      model: String,
  }
  ```

- [ ] **实现单次 embedding 请求**

  - 构建 API 请求
  - 处理响应
  - 错误处理和重试

- [ ] **实现批量 embedding**

  - 支持批量请求（最多 100 个/批次）
  - 进度反馈
  - 速率限制（避免触发限流）

- [ ] **实现缓存机制**

  - 基于代码内容 hash 的缓存
  - 避免重复计算
  - 持久化到磁盘

- [ ] **成本估算与监控**

  ```rust
  pub struct EmbeddingStats {
      pub total_tokens: usize,
      pub total_cost: f64,
      pub cache_hit_rate: f64,
  }
  ```

- [ ] **单元测试与集成测试**

#### 关键实现细节

**API 调用示例**：

```rust
async fn call_openai_api(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
    let request = json!({
        "model": "text-embedding-3-small",
        "input": texts,
        "encoding_format": "float"
    });

    let response = self.client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", self.api_key))
        .json(&request)
        .send()
        .await?;

    // 处理响应...
}
```

**批量处理策略**：

- 每批 100 个 chunk
- 批次间延迟 100ms
- 失败自动重试 3 次

#### 成本估算

- text-embedding-3-small：$0.00002 / 1K tokens
- 平均每个 chunk：~200 tokens
- 1000 个 chunk：~$0.004（不到 1 分钱）

#### 验收标准

- ✅ 能成功调用 OpenAI API
- ✅ 批量处理正常工作
- ✅ 缓存机制有效
- ✅ 错误处理完善

---

### 💾 阶段 3：向量存储模块 (2-3 天)

#### 目标

将代码块和向量存储到 Qdrant，实现高效检索。

#### 任务清单

- [ ] **创建 VectorStore 客户端**

  ```rust
  // src-tauri/src/tool_execution/codebase/vector_store.rs

  pub struct VectorStore {
      client: QdrantClient,
      config: VectorStoreConfig,
  }
  ```

- [ ] **实现集合管理**

  - 创建集合（collection）
  - 删除集合
  - 列出所有集合

- [ ] **实现数据写入**

  - 批量插入向量
  - 更新向量
  - 删除向量

- [ ] **实现向量检索**

  - 相似度搜索
  - 混合搜索（向量 + 过滤条件）
  - 分页支持

- [ ] **实现元数据管理**

  - 存储代码块的完整信息
  - 支持按文件路径过滤
  - 支持按类型过滤

- [ ] **实现工作区隔离**
  - 每个 workspace 一个独立集合
  - 跨 workspace 搜索支持

#### 关键实现细节

**集合配置**：

```rust
CreateCollection {
    collection_name: "workspace_my_project",
    vectors_config: VectorsConfig {
        size: 1536,              // text-embedding-3-small
        distance: Distance::Cosine,
        on_disk: true,           // 大数据集时使用磁盘
    },
}
```

**Payload 结构**：

```json
{
  "id": "Component:Button",
  "entity_type": "component",
  "file": "src/components/Button.tsx",
  "raw_name": "Button",
  "code": "export function Button() {...}",
  "start_line": 10,
  "end_line": 25,
  "imports": ["react"],
  "workspace": "my_project"
}
```

#### 验收标准

- ✅ 能创建和管理集合
- ✅ 能批量插入向量
- ✅ 搜索功能正常
- ✅ 工作区隔离有效

---

### 🔄 阶段 4：索引编排模块 (2-3 天)

#### 目标

将提取、分块、向量化、存储串联成完整的索引流程。

#### 任务清单

- [ ] **创建 CodebaseIndexer**

  ```rust
  // src-tauri/src/tool_execution/codebase/indexer.rs

  pub struct CodebaseIndexer {
      ts_extractor: TypeScriptExtractor,
      vue_extractor: VueExtractor,
      embeddings_client: EmbeddingsClient,
      vector_store: VectorStore,
  }
  ```

- [ ] **实现完整索引流程**

  ```rust
  pub async fn index_workspace(
      &mut self,
      workspace_path: &str,
      workspace_name: &str,
  ) -> Result<IndexStats>
  ```

- [ ] **实现增量索引**

  - 检测文件变化
  - 只更新修改的文件
  - 删除不存在文件的向量

- [ ] **实现进度反馈**

  - 实时进度更新
  - 预计剩余时间
  - 错误报告

- [ ] **实现索引统计**

  ```rust
  pub struct IndexStats {
      pub total_files: usize,
      pub total_entities: usize,
      pub total_chunks: usize,
      pub total_vectors: usize,
      pub total_cost: f64,
      pub duration: Duration,
  }
  ```

- [ ] **实现配置管理**
  - 支持 .cursorignore
  - 可配置的文件类型
  - 可配置的最大文件大小

#### 工作流程

```rust
async fn index_workspace(&mut self, path: &str, name: &str) -> Result<IndexStats> {
    // 1. 扫描文件
    let files = self.scan_files(path)?;
    println!("📁 发现 {} 个文件", files.len());

    // 2. 提取实体
    let entities = self.extract_entities(&files)?;
    println!("🔍 提取 {} 个实体", entities.len());

    // 3. 创建代码块
    let chunks = self.create_chunks(entities, path)?;
    println!("📦 创建 {} 个代码块", chunks.len());

    // 4. 向量化
    let embeddings = self.embeddings_client.embed_chunks(&chunks).await?;
    println!("🧠 生成 {} 个向量", embeddings.len());

    // 5. 存储
    self.vector_store.upsert_chunks(name, &chunks, embeddings).await?;
    println!("💾 存储完成");

    Ok(stats)
}
```

#### 验收标准

- ✅ 完整流程能跑通
- ✅ 进度反馈准确
- ✅ 增量索引有效
- ✅ 错误处理完善

---

### 🔍 阶段 5：搜索查询模块 (2-3 天)

#### 目标

实现自然语言搜索代码的功能。

#### 任务清单

- [ ] **创建 CodeSearcher**

  ```rust
  pub struct CodeSearcher {
      embeddings_client: EmbeddingsClient,
      vector_store: VectorStore,
  }
  ```

- [ ] **实现基础搜索**

  ```rust
  pub async fn search(
      &self,
      workspace: &str,
      query: &str,
      limit: usize,
  ) -> Result<Vec<SearchResult>>
  ```

- [ ] **实现高级搜索**

  - 过滤器支持（按类型、文件路径）
  - 相关度评分
  - 结果去重

- [ ] **实现搜索结果排序**

  - 按相似度
  - 按文件名
  - 按类型

- [ ] **实现搜索优化**
  - 查询扩展（同义词）
  - 结果重排序
  - 上下文增强

#### 搜索结果结构

```rust
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub chunk: CodeChunk,
    pub score: f32,              // 相似度分数
    pub highlights: Vec<String>,  // 高亮片段
    pub context: Option<String>,  // 周围代码上下文
}
```

#### 验收标准

- ✅ 能执行自然语言搜索
- ✅ 结果相关性高
- ✅ 性能可接受（<500ms）

---

### 🖥️ 阶段 6：Tauri 命令集成 (2 天)

#### 目标

将索引和搜索功能暴露为 Tauri 命令，供前端调用。

#### 任务清单

- [ ] **定义 Tauri Commands**

  ```rust
  #[tauri::command]
  async fn index_workspace(
      workspace_path: String,
      workspace_name: String,
  ) -> Result<IndexStats, String>

  #[tauri::command]
  async fn search_code(
      workspace: String,
      query: String,
      limit: usize,
  ) -> Result<Vec<SearchResult>, String>

  #[tauri::command]
  async fn get_index_status(
      workspace: String,
  ) -> Result<IndexStatus, String>
  ```

- [ ] **实现状态管理**

  - 索引进度追踪
  - 错误状态
  - 配置管理

- [ ] **实现事件推送**
  ```rust
  // 向前端推送索引进度
  app.emit_all("indexing-progress", IndexProgress {
      current: 100,
      total: 500,
      message: "正在索引文件...",
  })?;
  ```

#### 验收标准

- ✅ 前端能调用所有命令
- ✅ 进度实时更新
- ✅ 错误正确传递

---

### 🎨 阶段 7：前端界面 (3-4 天)

#### 目标

构建用户友好的搜索界面。

#### 任务清单

- [ ] **搜索输入组件**

  - 自然语言输入框
  - 搜索历史
  - 快捷键支持

- [ ] **搜索结果展示**

  - 代码高亮
  - 相关度显示
  - 文件路径跳转

- [ ] **索引管理界面**

  - 索引进度条
  - 索引统计
  - 重新索引按钮

- [ ] **设置页面**
  - OpenAI API Key 配置
  - Qdrant 服务器配置
  - 索引选项配置

#### UI 设计参考

```
┌─────────────────────────────────────────────────────┐
│  🔍  搜索代码库                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │ 如何实现用户登录功能？                  [搜索]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  📊 搜索结果 (找到 5 个相关代码)                      │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 src/auth/login.ts                 95%    │   │
│  │ ─────────────────────────────────────────   │   │
│  │ export async function login(credentials) {  │   │
│  │     const response = await api.post(...)    │   │
│  │ }                                            │   │
│  └─────────────────────────────────────────────┘   │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

#### 验收标准

- ✅ 界面美观易用
- ✅ 搜索响应快速
- ✅ 代码高亮正确

---

### ✅ 阶段 8：测试与优化 (2-3 天)

#### 测试清单

- [ ] **单元测试**

  - 每个模块覆盖率 > 80%

- [ ] **集成测试**

  - 完整索引流程
  - 搜索准确性测试

- [ ] **性能测试**

  - 索引速度：目标 100 文件/分钟
  - 搜索延迟：目标 < 500ms
  - 内存占用：目标 < 500MB

- [ ] **用户测试**
  - 实际代码库测试
  - 收集反馈

#### 优化方向

- [ ] **性能优化**

  - 并行处理
  - 缓存优化
  - 批量操作

- [ ] **准确性优化**

  - 调整 embedding 格式
  - 优化搜索算法
  - 添加更多上下文

- [ ] **用户体验优化**
  - 加载状态优化
  - 错误提示优化
  - 快捷键支持

#### 验收标准

- ✅ 所有测试通过
- ✅ 性能达标
- ✅ 用户反馈良好

---

## 时间规划

| 阶段 | 任务         | 预计时间 | 优先级  |
| ---- | ------------ | -------- | ------- |
| 0    | 环境准备     | 1-2 天   | 🔴 最高 |
| 1    | 代码分块模块 | 2-3 天   | 🔴 最高 |
| 2    | 向量化模块   | 2-3 天   | 🔴 最高 |
| 3    | 向量存储模块 | 2-3 天   | 🔴 最高 |
| 4    | 索引编排模块 | 2-3 天   | 🟡 高   |
| 5    | 搜索查询模块 | 2-3 天   | 🟡 高   |
| 6    | Tauri 集成   | 2 天     | 🟡 高   |
| 7    | 前端界面     | 3-4 天   | 🟢 中   |
| 8    | 测试优化     | 2-3 天   | 🟢 中   |

**总计**：约 3-4 周

---

## 成本预算

### OpenAI API 成本

**模型**：text-embedding-3-small
**定价**：$0.00002 / 1K tokens

**示例计算**（中等规模项目）：

- 代码库：1000 个文件
- 平均提取：5 个实体/文件 = 5000 个实体
- 平均代码块大小：200 tokens
- 总 tokens：5000 × 200 = 1,000,000 tokens
- **总成本**：$0.02（2 分钱）

**月度成本估算**：

- 初次索引：$0.02
- 增量更新（每天 10%）：$0.002/天 × 30 = $0.06/月
- **月度总计**：< $0.1（约 0.7 元人民币）

### Qdrant 成本

- **本地部署**：0 元（推荐开发阶段）
- **Qdrant Cloud 免费层**：1GB 存储，足够小型项目
- **付费版**：$25/月起（生产环境）

### 总成本

- **开发阶段**：~$0.5/月
- **生产环境**：$25-50/月（如使用云服务）

---

## 技术难点与解决方案

### 难点 1：大型代码库索引速度慢

**解决方案**：

- 并行处理多个文件
- 批量调用 OpenAI API
- 使用缓存避免重复计算
- 增量索引

### 难点 2：搜索结果不够准确

**解决方案**：

- 优化 embedding 文本格式
- 添加更多上下文信息
- 实现混合搜索（向量 + 关键字）
- 结果重排序

### 难点 3：内存占用过高

**解决方案**：

- Qdrant 使用磁盘存储
- 流式处理大文件
- 及时释放临时数据
- 分批处理

### 难点 4：API 调用失败

**解决方案**：

- 实现重试机制
- 添加速率限制
- 本地缓存
- 降级方案（使用简单文本匹配）

---

## 里程碑

### M1：核心功能可用（2 周后）

- ✅ 能索引代码库
- ✅ 能进行基础搜索
- ✅ 搜索结果基本准确

### M2：功能完整（3 周后）

- ✅ 增量索引
- ✅ 高级搜索
- ✅ 前端界面完善

### M3：生产就绪（4 周后）

- ✅ 测试覆盖充分
- ✅ 性能优化完成
- ✅ 文档齐全

---

## 配置文件示例

### .env

```bash
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
```

### config.json

```json
{
  "embedding": {
    "model": "text-embedding-3-small",
    "batch_size": 100,
    "cache_enabled": true
  },
  "qdrant": {
    "url": "http://localhost:6333",
    "collection_prefix": "workspace_"
  },
  "indexing": {
    "max_file_size_mb": 1,
    "ignore_patterns": ["**/node_modules/**", "**/dist/**", "**/*.min.js"],
    "supported_extensions": [".ts", ".tsx", ".js", ".jsx", ".vue"]
  }
}
```

---

## 下一步行动

1. ✅ **立即开始**：阶段 0 - 环境准备
2. 📅 **本周目标**：完成阶段 1 - 代码分块模块
3. 📅 **下周目标**：完成阶段 2-3 - 向量化与存储

---

## 参考资源

### 文档

- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)

### 示例项目

- [code-search-example](https://github.com/openai/openai-cookbook/blob/main/examples/Code_search.ipynb)
- [qdrant-rust-examples](https://github.com/qdrant/qdrant-client/tree/master/examples)

---

**最后更新**：2025-10-01
**负责人**：开发团队
**状态**：待开始
