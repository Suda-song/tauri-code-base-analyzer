# 后端核心模块详细实现方案

## 📊 当前进度分析

### ✅ 已完成模块（70%）

#### 1. 代码实体提取器（extractors）

```
src-tauri/src/tool_execution/codebase/extractors/
├── mod.rs              ✅ 核心数据结构定义
├── typescript.rs       ✅ TypeScript/TSX 提取器
├── vue.rs              ✅ Vue 文件提取器
└── type_utils.rs       ✅ 类型判断工具
```

**已有数据结构**：

```rust
pub struct CodeEntity {
    pub id: String,           // "Component:Button"
    pub entity_type: String,  // "component", "function", "class"
    pub file: String,         // 相对路径
    pub loc: LocationInfo,    // 行号范围
    pub raw_name: String,     // 实体名称
}
```

**已有能力**：

- ✅ 解析 TypeScript/TSX 文件（基于 tree-sitter AST）
- ✅ 解析 Vue 文件（基于正则表达式）
- ✅ 识别组件、函数、类、变量
- ✅ 智能类型判断（区分组件和普通函数）

**缺失的关键信息**：

- ❌ **实际代码内容**（只有位置，没有代码文本）
- ❌ 上下文信息（导入、导出、注释）
- ❌ 依赖关系（引用了哪些其他实体）

---

### ❌ 待实现模块（30%）

```
src-tauri/src/tool_execution/codebase/
├── chunking.rs         ❌ 代码分块增强模块
├── embeddings.rs       ❌ 向量化模块
└── vector_store.rs     ❌ 向量存储模块（可选，后续阶段）
```

---

## 🎯 实现策略：增量扩展

我们采用**最小侵入式**的设计，在现有代码基础上扩展，而不是重写。

### 核心思路

```
已有: CodeEntity（位置信息）
      ↓ 增强
新增: CodeChunk（位置 + 代码内容 + 上下文）
      ↓ 向量化
新增: EmbeddedChunk（Chunk + 向量）
```

---

## 📦 模块 1：代码分块增强模块（chunking.rs）

### 目标

将轻量级的 `CodeEntity` 转换为包含完整信息的 `CodeChunk`。

### 详细设计

#### 1.1 数据结构定义

```rust
// src-tauri/src/tool_execution/codebase/chunking.rs

use super::extractors::{CodeEntity, LocationInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 增强的代码块（包含完整上下文）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    // ========== 基础信息（继承自 CodeEntity） ==========
    pub id: String,
    pub entity_type: String,
    pub file: String,
    pub raw_name: String,
    pub loc: LocationInfo,

    // ========== 新增：代码内容 ==========
    /// 实际的代码文本
    pub code: String,

    /// 代码长度（字符数）
    pub code_length: usize,

    // ========== 新增：上下文信息 ==========
    /// 导入的模块/库
    /// 例如: ["react", "@/utils/helpers", "./Button.css"]
    pub imports: Vec<String>,

    /// 导出的内容
    /// 例如: ["Button", "ButtonProps"]
    pub exports: Vec<String>,

    /// 注释内容（JSDoc、单行、多行）
    pub comments: Vec<String>,

    /// 依赖的其他实体 ID
    /// 例如: ["Component:Icon", "Function:validateProps"]
    pub dependencies: Vec<String>,

    // ========== 新增：元数据 ==========
    /// 代码复杂度（简单估算：行数 + 缩进层级）
    pub complexity: u32,

    /// 是否为测试代码
    pub is_test: bool,

    /// 文件的相对路径（去除 workspace 前缀）
    pub relative_file: String,

    // ========== 新增：用于 Embedding 的格式化文本 ==========
    /// 经过优化的文本，用于生成向量
    /// 包含结构化的元数据 + 代码
    pub embedding_text: String,
}

/// 分块统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkStats {
    pub total_chunks: usize,
    pub total_code_size: usize,
    pub avg_chunk_size: usize,
    pub by_type: HashMap<String, usize>,  // 各类型数量统计
}
```

#### 1.2 核心实现：ChunkBuilder

```rust
use std::fs;
use std::path::Path;
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    // 导入语句正则
    static ref IMPORT_REGEX: Regex = Regex::new(
        r#"import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]"#
    ).unwrap();

    // 导出语句正则
    static ref EXPORT_REGEX: Regex = Regex::new(
        r"export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)"
    ).unwrap();

    // JSDoc 注释正则
    static ref JSDOC_REGEX: Regex = Regex::new(
        r"/\*\*([\s\S]*?)\*/"
    ).unwrap();

    // 单行注释正则
    static ref SINGLE_COMMENT_REGEX: Regex = Regex::new(
        r"//\s*(.+?)$"
    ).unwrap();
}

pub struct ChunkBuilder {
    workspace_root: String,
}

impl ChunkBuilder {
    pub fn new(workspace_root: String) -> Self {
        Self { workspace_root }
    }

    /// 从 CodeEntity 创建 CodeChunk
    pub fn build_chunk(
        &self,
        entity: CodeEntity,
    ) -> Result<CodeChunk, Box<dyn std::error::Error>> {
        // 1. 读取文件内容
        let full_path = Path::new(&self.workspace_root).join(&entity.file);
        let file_content = fs::read_to_string(&full_path)?;

        // 2. 提取指定行范围的代码
        let code = self.extract_code_from_lines(
            &file_content,
            entity.loc.start_line,
            entity.loc.end_line,
        )?;

        // 3. 分析上下文
        let imports = self.extract_imports(&code);
        let exports = self.extract_exports(&code);
        let comments = self.extract_comments(&code);

        // 4. 计算复杂度
        let complexity = self.calculate_complexity(&code);

        // 5. 判断是否为测试代码
        let is_test = self.is_test_file(&entity.file) || self.is_test_code(&code);

        // 6. 计算相对路径
        let relative_file = entity.file
            .strip_prefix(&self.workspace_root)
            .unwrap_or(&entity.file)
            .to_string();

        // 7. 生成 embedding 文本
        let embedding_text = self.format_for_embedding(
            &entity,
            &code,
            &imports,
            &exports,
            &comments,
            &relative_file,
        );

        Ok(CodeChunk {
            id: entity.id,
            entity_type: entity.entity_type,
            file: entity.file,
            raw_name: entity.raw_name,
            loc: entity.loc,
            code: code.clone(),
            code_length: code.len(),
            imports,
            exports,
            comments,
            dependencies: Vec::new(), // 第一阶段先留空，后续可以分析
            complexity,
            is_test,
            relative_file,
            embedding_text,
        })
    }

    /// 从文件内容提取指定行范围的代码
    fn extract_code_from_lines(
        &self,
        content: &str,
        start_line: usize,
        end_line: usize,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let lines: Vec<&str> = content.lines().collect();

        // 校验行号范围
        if start_line == 0 || start_line > lines.len() {
            return Err(format!("Invalid start_line: {}", start_line).into());
        }

        // 转换为 0-based 索引
        let start_idx = start_line - 1;
        let end_idx = std::cmp::min(end_line, lines.len());

        // 提取代码
        let code = lines[start_idx..end_idx].join("\n");

        Ok(code)
    }

    /// 提取导入语句
    fn extract_imports(&self, code: &str) -> Vec<String> {
        IMPORT_REGEX
            .captures_iter(code)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect()
    }

    /// 提取导出内容
    fn extract_exports(&self, code: &str) -> Vec<String> {
        EXPORT_REGEX
            .captures_iter(code)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect()
    }

    /// 提取注释
    fn extract_comments(&self, code: &str) -> Vec<String> {
        let mut comments = Vec::new();

        // 提取 JSDoc
        for cap in JSDOC_REGEX.captures_iter(code) {
            if let Some(comment) = cap.get(1) {
                let cleaned = comment.as_str()
                    .lines()
                    .map(|line| line.trim_start_matches('*').trim())
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                comments.push(cleaned);
            }
        }

        // 提取单行注释（只保留有意义的注释）
        for cap in SINGLE_COMMENT_REGEX.captures_iter(code) {
            if let Some(comment) = cap.get(1) {
                let text = comment.as_str().trim();
                // 过滤掉太短或纯符号的注释
                if text.len() > 5 && text.chars().any(|c| c.is_alphabetic()) {
                    comments.push(text.to_string());
                }
            }
        }

        comments
    }

    /// 计算代码复杂度（简化版）
    fn calculate_complexity(&self, code: &str) -> u32 {
        let line_count = code.lines().count() as u32;

        // 统计控制流关键字
        let control_flow_keywords = [
            "if", "else", "for", "while", "switch", "case",
            "try", "catch", "async", "await"
        ];

        let mut control_flow_count = 0u32;
        for keyword in &control_flow_keywords {
            control_flow_count += code.matches(keyword).count() as u32;
        }

        // 简单的复杂度公式
        line_count + control_flow_count * 2
    }

    /// 判断是否为测试文件
    fn is_test_file(&self, file_path: &str) -> bool {
        let path = file_path.to_lowercase();
        path.contains("test") || path.contains("spec") || path.contains("__tests__")
    }

    /// 判断是否为测试代码
    fn is_test_code(&self, code: &str) -> bool {
        let test_keywords = ["describe", "it(", "test(", "expect("];
        test_keywords.iter().any(|keyword| code.contains(keyword))
    }

    /// 格式化为适合 embedding 的文本
    /// 这是最关键的函数，决定了 AI 如何理解代码
    fn format_for_embedding(
        &self,
        entity: &CodeEntity,
        code: &str,
        imports: &[String],
        exports: &[String],
        comments: &[String],
        relative_file: &str,
    ) -> String {
        let mut parts = Vec::new();

        // 1. 文件路径（帮助 AI 理解代码位置）
        parts.push(format!("File: {}", relative_file));

        // 2. 实体类型和名称
        parts.push(format!("Type: {} | Name: {}", entity.entity_type, entity.raw_name));

        // 3. 位置信息
        parts.push(format!(
            "Location: Lines {}-{}",
            entity.loc.start_line,
            entity.loc.end_line
        ));

        // 4. 导入信息（显示依赖）
        if !imports.is_empty() {
            parts.push(format!("Imports: {}", imports.join(", ")));
        }

        // 5. 导出信息
        if !exports.is_empty() {
            parts.push(format!("Exports: {}", exports.join(", ")));
        }

        // 6. 注释（重要的语义信息）
        if !comments.is_empty() {
            parts.push(format!("Comments: {}", comments.join(" | ")));
        }

        // 7. 分隔符
        parts.push("---".to_string());

        // 8. 实际代码
        parts.push(code.to_string());

        parts.join("\n")
    }

    /// 批量构建 chunks
    pub fn build_chunks(
        &self,
        entities: Vec<CodeEntity>,
    ) -> Result<(Vec<CodeChunk>, ChunkStats), Box<dyn std::error::Error>> {
        let mut chunks = Vec::new();
        let mut stats = ChunkStats {
            total_chunks: 0,
            total_code_size: 0,
            avg_chunk_size: 0,
            by_type: HashMap::new(),
        };

        for entity in entities {
            match self.build_chunk(entity) {
                Ok(chunk) => {
                    // 更新统计
                    stats.total_code_size += chunk.code_length;
                    *stats.by_type.entry(chunk.entity_type.clone()).or_insert(0) += 1;

                    chunks.push(chunk);
                }
                Err(e) => {
                    eprintln!("⚠️ Failed to build chunk: {}", e);
                    // 继续处理其他 entity
                }
            }
        }

        stats.total_chunks = chunks.len();
        stats.avg_chunk_size = if stats.total_chunks > 0 {
            stats.total_code_size / stats.total_chunks
        } else {
            0
        };

        Ok((chunks, stats))
    }
}
```

#### 1.3 使用示例

```rust
use crate::tool_execution::codebase::extractors::TypeScriptExtractor;
use crate::tool_execution::codebase::chunking::ChunkBuilder;

#[tokio::test]
async fn test_chunking() {
    // 1. 提取实体（已有功能）
    let mut extractor = TypeScriptExtractor::new(false).unwrap();
    let entities = extractor.extract(
        "/path/to/file.ts",
        "/path/to/workspace"
    ).unwrap();

    // 2. 构建 chunks（新功能）
    let builder = ChunkBuilder::new("/path/to/workspace".to_string());
    let (chunks, stats) = builder.build_chunks(entities).unwrap();

    println!("✅ 生成了 {} 个代码块", chunks.len());
    println!("📊 平均大小: {} 字符", stats.avg_chunk_size);
    println!("📋 类型分布: {:?}", stats.by_type);

    // 3. 查看第一个 chunk 的 embedding 文本
    if let Some(chunk) = chunks.first() {
        println!("\n📄 Embedding 文本示例:\n{}", chunk.embedding_text);
    }
}
```

---

## 🧠 模块 2：向量化模块（embeddings.rs）

### 目标

调用 OpenAI API 将 `CodeChunk` 转换为向量。

### 详细设计

#### 2.1 数据结构定义

```rust
// src-tauri/src/tool_execution/codebase/embeddings.rs

use super::chunking::CodeChunk;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;
use std::time::Duration;

/// 带向量的代码块
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddedChunk {
    /// 原始 chunk
    pub chunk: CodeChunk,

    /// 向量（1536 维）
    pub embedding: Vec<f32>,
}

/// Embedding 统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingStats {
    /// 总共处理的 chunk 数量
    pub total_chunks: usize,

    /// 总共消耗的 tokens
    pub total_tokens: usize,

    /// 预估成本（美元）
    pub estimated_cost: f64,

    /// 缓存命中次数
    pub cache_hits: usize,

    /// API 调用次数
    pub api_calls: usize,

    /// 耗时（秒）
    pub duration_secs: f64,
}

/// OpenAI API 请求
#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: Vec<String>,
    encoding_format: String,
}

/// OpenAI API 响应
#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
    usage: Usage,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Deserialize)]
struct Usage {
    total_tokens: usize,
}
```

#### 2.2 核心实现：EmbeddingsClient

```rust
use std::time::Instant;
use tokio::time::sleep;

pub struct EmbeddingsClient {
    api_key: String,
    client: Client,
    model: String,
    batch_size: usize,
    cache: HashMap<String, Vec<f32>>,  // 简单的内存缓存
}

impl EmbeddingsClient {
    /// 创建客户端
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .unwrap(),
            model: "text-embedding-3-small".to_string(),
            batch_size: 100,  // OpenAI 最多支持 2048，但我们用 100 更稳定
            cache: HashMap::new(),
        }
    }

    /// 为单个 chunk 生成向量
    pub async fn embed_chunk(
        &mut self,
        chunk: &CodeChunk,
    ) -> Result<EmbeddedChunk, Box<dyn std::error::Error>> {
        // 检查缓存
        let cache_key = self.compute_cache_key(&chunk.embedding_text);
        if let Some(embedding) = self.cache.get(&cache_key) {
            return Ok(EmbeddedChunk {
                chunk: chunk.clone(),
                embedding: embedding.clone(),
            });
        }

        // 调用 API
        let embeddings = self.call_api(vec![chunk.embedding_text.clone()]).await?;

        // 更新缓存
        if let Some(embedding) = embeddings.first() {
            self.cache.insert(cache_key, embedding.clone());

            Ok(EmbeddedChunk {
                chunk: chunk.clone(),
                embedding: embedding.clone(),
            })
        } else {
            Err("No embedding returned".into())
        }
    }

    /// 批量生成向量（推荐使用）
    pub async fn embed_chunks(
        &mut self,
        chunks: Vec<CodeChunk>,
    ) -> Result<(Vec<EmbeddedChunk>, EmbeddingStats), Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        let mut embedded_chunks = Vec::new();
        let mut stats = EmbeddingStats {
            total_chunks: chunks.len(),
            total_tokens: 0,
            estimated_cost: 0.0,
            cache_hits: 0,
            api_calls: 0,
            duration_secs: 0.0,
        };

        // 分批处理
        for batch in chunks.chunks(self.batch_size) {
            println!("🧠 处理批次 ({} chunks)...", batch.len());

            // 分离缓存命中和需要调用 API 的
            let mut texts_to_embed = Vec::new();
            let mut indices_to_embed = Vec::new();

            for (idx, chunk) in batch.iter().enumerate() {
                let cache_key = self.compute_cache_key(&chunk.embedding_text);

                if let Some(embedding) = self.cache.get(&cache_key) {
                    // 缓存命中
                    embedded_chunks.push(EmbeddedChunk {
                        chunk: chunk.clone(),
                        embedding: embedding.clone(),
                    });
                    stats.cache_hits += 1;
                } else {
                    // 需要调用 API
                    texts_to_embed.push(chunk.embedding_text.clone());
                    indices_to_embed.push(idx);
                }
            }

            // 调用 API
            if !texts_to_embed.is_empty() {
                match self.call_api_with_retry(texts_to_embed.clone()).await {
                    Ok((embeddings, tokens)) => {
                        // 更新统计
                        stats.api_calls += 1;
                        stats.total_tokens += tokens;
                        stats.estimated_cost += (tokens as f64 / 1000.0) * 0.00002;

                        // 保存结果
                        for (i, embedding) in embeddings.iter().enumerate() {
                            let chunk_idx = indices_to_embed[i];
                            let chunk = &batch[chunk_idx];

                            // 更新缓存
                            let cache_key = self.compute_cache_key(&chunk.embedding_text);
                            self.cache.insert(cache_key, embedding.clone());

                            // 添加到结果
                            embedded_chunks.push(EmbeddedChunk {
                                chunk: chunk.clone(),
                                embedding: embedding.clone(),
                            });
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ API 调用失败: {}", e);
                        // 继续处理下一批
                    }
                }

                // 避免触发速率限制
                sleep(Duration::from_millis(200)).await;
            }

            // 打印进度
            let progress = (embedded_chunks.len() as f64 / chunks.len() as f64) * 100.0;
            println!("📊 进度: {:.1}% ({}/{})", progress, embedded_chunks.len(), chunks.len());
        }

        stats.duration_secs = start_time.elapsed().as_secs_f64();

        println!("\n✅ 向量化完成!");
        println!("  总数: {} chunks", stats.total_chunks);
        println!("  缓存命中: {}", stats.cache_hits);
        println!("  API 调用: {}", stats.api_calls);
        println!("  总 tokens: {}", stats.total_tokens);
        println!("  预估成本: ${:.4}", stats.estimated_cost);
        println!("  耗时: {:.2}s", stats.duration_secs);

        Ok((embedded_chunks, stats))
    }

    /// 调用 OpenAI API（带重试）
    async fn call_api_with_retry(
        &self,
        texts: Vec<String>,
    ) -> Result<(Vec<Vec<f32>>, usize), Box<dyn std::error::Error>> {
        let max_retries = 3;
        let mut last_error = None;

        for attempt in 1..=max_retries {
            match self.call_api(texts.clone()).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    eprintln!("⚠️ API 调用失败 (尝试 {}/{}): {}", attempt, max_retries, e);
                    last_error = Some(e);

                    // 指数退避
                    let delay = Duration::from_secs(2u64.pow(attempt as u32));
                    sleep(delay).await;
                }
            }
        }

        Err(last_error.unwrap_or_else(|| "Unknown error".into()))
    }

    /// 调用 OpenAI API（单次）
    async fn call_api(
        &self,
        texts: Vec<String>,
    ) -> Result<(Vec<Vec<f32>>, usize), Box<dyn std::error::Error>> {
        let request = EmbeddingRequest {
            model: self.model.clone(),
            input: texts,
            encoding_format: "float".to_string(),
        };

        let response = self.client
            .post("https://api.openai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        // 检查状态码
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(format!("API error ({}): {}", status, error_text).into());
        }

        // 解析响应
        let embedding_response: EmbeddingResponse = response.json().await?;

        // 提取向量（按 index 排序）
        let mut embeddings_with_index: Vec<_> = embedding_response.data
            .into_iter()
            .map(|d| (d.index, d.embedding))
            .collect();
        embeddings_with_index.sort_by_key(|(idx, _)| *idx);

        let embeddings: Vec<Vec<f32>> = embeddings_with_index
            .into_iter()
            .map(|(_, emb)| emb)
            .collect();

        Ok((embeddings, embedding_response.usage.total_tokens))
    }

    /// 计算缓存键（使用代码的 hash）
    fn compute_cache_key(&self, text: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}
```

#### 2.3 使用示例

```rust
#[tokio::test]
async fn test_embeddings() {
    // 假设已经有了 chunks
    let chunks = vec![/* ... */];

    // 创建客户端
    let api_key = std::env::var("OPENAI_API_KEY").unwrap();
    let mut client = EmbeddingsClient::new(api_key);

    // 批量生成向量
    let (embedded_chunks, stats) = client.embed_chunks(chunks).await.unwrap();

    // 查看结果
    println!("向量维度: {}", embedded_chunks[0].embedding.len()); // 1536
    println!("总成本: ${:.4}", stats.estimated_cost);
}
```

---

## 🔗 集成：完整工作流

### 3.1 创建统一的 Indexer

```rust
// src-tauri/src/tool_execution/codebase/mod.rs

pub mod extractors;
pub mod chunking;
pub mod embeddings;

pub use extractors::{CodeEntity, TypeScriptExtractor, VueExtractor};
pub use chunking::{CodeChunk, ChunkBuilder};
pub use embeddings::{EmbeddedChunk, EmbeddingsClient};

use std::path::Path;
use walkdir::WalkDir;

/// 代码库索引器（协调所有模块）
pub struct CodebaseIndexer {
    workspace_root: String,
    ts_extractor: TypeScriptExtractor,
    vue_extractor: VueExtractor,
    chunk_builder: ChunkBuilder,
    embeddings_client: EmbeddingsClient,
}

impl CodebaseIndexer {
    pub fn new(workspace_root: String, openai_api_key: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            workspace_root: workspace_root.clone(),
            ts_extractor: TypeScriptExtractor::new(false)?,
            vue_extractor: VueExtractor::new(),
            chunk_builder: ChunkBuilder::new(workspace_root),
            embeddings_client: EmbeddingsClient::new(openai_api_key),
        })
    }

    /// 完整的索引流程
    pub async fn index_workspace(&mut self) -> Result<Vec<EmbeddedChunk>, Box<dyn std::error::Error>> {
        println!("🚀 开始索引工作区: {}", self.workspace_root);

        // 步骤 1: 扫描文件
        println!("\n📁 步骤 1/4: 扫描文件...");
        let files = self.scan_files()?;
        println!("  发现 {} 个文件", files.len());

        // 步骤 2: 提取实体
        println!("\n🔍 步骤 2/4: 提取代码实体...");
        let entities = self.extract_entities(&files)?;
        println!("  提取 {} 个实体", entities.len());

        // 步骤 3: 构建 chunks
        println!("\n📦 步骤 3/4: 构建代码块...");
        let (chunks, chunk_stats) = self.chunk_builder.build_chunks(entities)?;
        println!("  生成 {} 个代码块", chunks.len());
        println!("  平均大小: {} 字符", chunk_stats.avg_chunk_size);

        // 步骤 4: 向量化
        println!("\n🧠 步骤 4/4: 生成向量...");
        let (embedded_chunks, embed_stats) = self.embeddings_client.embed_chunks(chunks).await?;

        println!("\n✅ 索引完成!");
        println!("  总共: {} 个向量化代码块", embedded_chunks.len());
        println!("  成本: ${:.4}", embed_stats.estimated_cost);

        Ok(embedded_chunks)
    }

    /// 扫描文件
    fn scan_files(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();

        for entry in WalkDir::new(&self.workspace_root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if matches!(ext.to_str(), Some("ts") | Some("tsx") | Some("js") | Some("jsx") | Some("vue")) {
                        // 排除 node_modules 等
                        let path_str = path.to_string_lossy();
                        if !path_str.contains("node_modules") && !path_str.contains("dist") {
                            files.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        Ok(files)
    }

    /// 提取实体
    fn extract_entities(&mut self, files: &[String]) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let mut all_entities = Vec::new();

        for file in files {
            let entities = if file.ends_with(".vue") {
                self.vue_extractor.extract(file, &self.workspace_root)?
            } else if file.ends_with(".tsx") || file.ends_with(".jsx") {
                self.ts_extractor = TypeScriptExtractor::new(true)?;
                self.ts_extractor.extract(file, &self.workspace_root)?
            } else {
                self.ts_extractor = TypeScriptExtractor::new(false)?;
                self.ts_extractor.extract(file, &self.workspace_root)?
            };

            all_entities.extend(entities);
        }

        Ok(all_entities)
    }
}
```

### 3.2 完整使用示例

```rust
#[tokio::test]
async fn test_full_workflow() {
    // 创建索引器
    let workspace = "/path/to/your/project".to_string();
    let api_key = std::env::var("OPENAI_API_KEY").unwrap();

    let mut indexer = CodebaseIndexer::new(workspace, api_key).unwrap();

    // 执行完整索引
    let embedded_chunks = indexer.index_workspace().await.unwrap();

    // 此时你有了所有代码块的向量
    // 可以保存到文件，或者后续存入 Qdrant
    println!("✅ 生成了 {} 个向量化代码块", embedded_chunks.len());

    // 示例：保存到 JSON
    let json = serde_json::to_string_pretty(&embedded_chunks).unwrap();
    std::fs::write("embedded_chunks.json", json).unwrap();
}
```

---

## 📋 实施清单

### Week 1: 代码分块模块

- [ ] **Day 1-2**: 实现 CodeChunk 数据结构和 ChunkBuilder
  - [ ] 创建 `chunking.rs` 文件
  - [ ] 实现 `extract_code_from_lines`
  - [ ] 实现 `extract_imports` 和 `extract_exports`
  - [ ] 实现 `extract_comments`
- [ ] **Day 3**: 实现 embedding 文本格式化

  - [ ] 设计最优的格式化模板
  - [ ] 实现 `format_for_embedding`
  - [ ] 编写单元测试

- [ ] **Day 4**: 集成测试
  - [ ] 测试与现有 TypeScriptExtractor 的集成
  - [ ] 测试与 VueExtractor 的集成
  - [ ] 优化性能

### Week 2: 向量化模块

- [ ] **Day 1-2**: 实现 EmbeddingsClient

  - [ ] 创建 `embeddings.rs` 文件
  - [ ] 实现 API 调用逻辑
  - [ ] 实现错误处理和重试

- [ ] **Day 3**: 实现批量处理和缓存

  - [ ] 批量 API 调用
  - [ ] 内存缓存
  - [ ] 进度显示

- [ ] **Day 4**: 集成测试
  - [ ] 端到端测试
  - [ ] 性能测试
  - [ ] 成本测试

### Week 3: 集成和优化

- [ ] **Day 1-2**: 创建 CodebaseIndexer
  - [ ] 实现完整工作流
  - [ ] 添加配置选项
- [ ] **Day 3-4**: 优化和文档
  - [ ] 性能优化
  - [ ] 编写使用文档
  - [ ] 准备示例

---

## 🔧 配置建议

### Cargo.toml 更新

```toml
[dependencies]
# 现有依赖保持不变...

# 新增依赖（如果还没有的话）
tokio = { version = "1.0", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
regex = "1.10"
lazy_static = "1.4"
walkdir = "2.3"
anyhow = "1.0"
```

### 环境变量配置

```bash
# .env
OPENAI_API_KEY=sk-your-key-here
WORKSPACE_ROOT=/path/to/your/project
```

---

## 📊 预期输出示例

### CodeChunk 示例

```json
{
  "id": "Component:Button",
  "entity_type": "component",
  "file": "src/components/Button.tsx",
  "raw_name": "Button",
  "loc": { "start_line": 10, "end_line": 25 },
  "code": "export function Button({ onClick, children }) {...}",
  "code_length": 156,
  "imports": ["react", "./Button.css"],
  "exports": ["Button", "ButtonProps"],
  "comments": ["Reusable button component with various styles"],
  "complexity": 8,
  "is_test": false,
  "relative_file": "src/components/Button.tsx",
  "embedding_text": "File: src/components/Button.tsx\nType: component | Name: Button\n..."
}
```

### EmbeddedChunk 示例

```json
{
  "chunk": { /* CodeChunk */ },
  "embedding": [0.023, -0.145, 0.567, ..., 0.012]  // 1536 个数字
}
```

---

## ⏱️ 时间估算

| 模块         | 预计时间    | 关键任务                     |
| ------------ | ----------- | ---------------------------- |
| 代码分块模块 | 3-4 天      | ChunkBuilder 实现 + 测试     |
| 向量化模块   | 3-4 天      | EmbeddingsClient + 批量处理  |
| 集成和测试   | 2-3 天      | CodebaseIndexer + 端到端测试 |
| **总计**     | **8-11 天** | 约 2 周                      |

---

## 💰 成本估算

**示例项目**（中等规模）：

- 文件数：500
- 实体数：2500
- 平均 embedding 文本：200 tokens/实体
- 总 tokens：500,000

**成本**：

- 模型：text-embedding-3-small ($0.00002/1K tokens)
- 总成本：500,000 ÷ 1000 × $0.00002 = **$0.01**（约 0.07 元）

---

## 🎯 验收标准

### 代码分块模块

- ✅ 能从 CodeEntity 生成 CodeChunk
- ✅ 正确提取代码内容（保持格式）
- ✅ 准确提取 imports 和 exports
- ✅ embedding_text 格式合理
- ✅ 单元测试覆盖率 > 80%

### 向量化模块

- ✅ 能成功调用 OpenAI API
- ✅ 批量处理正常工作
- ✅ 缓存机制有效（减少重复调用）
- ✅ 错误重试机制可靠
- ✅ 成本控制在预期范围内

### 整体集成

- ✅ 端到端流程顺畅
- ✅ 处理速度：> 50 文件/分钟
- ✅ 内存占用：< 500MB
- ✅ 错误日志清晰

---

## 📚 参考资源

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [tree-sitter Rust Bindings](https://docs.rs/tree-sitter/latest/tree_sitter/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)

---

**最后更新**：2025-10-01  
**作者**：AI Assistant  
**状态**：待实施
