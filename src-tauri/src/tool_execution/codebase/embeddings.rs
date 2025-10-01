//! 向量化模块
//!
//! 调用 OpenAI API 将代码块转换为向量

use super::chunking::CodeChunk;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::sleep;

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

/// Embeddings 客户端
pub struct EmbeddingsClient {
    api_key: String,
    client: Client,
    model: String,
    batch_size: usize,
    cache: HashMap<String, Vec<f32>>, // 简单的内存缓存
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
            batch_size: 100, // OpenAI 最多支持 2048，但我们用 100 更稳定
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
        let (embeddings, _tokens) = self.call_api(vec![chunk.embedding_text.clone()]).await?;

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
            println!(
                "📊 进度: {:.1}% ({}/{})",
                progress,
                embedded_chunks.len(),
                chunks.len()
            );
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

        let response = self
            .client
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
        let mut embeddings_with_index: Vec<_> = embedding_response
            .data
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_cache_key() {
        let client = EmbeddingsClient::new("test-key".to_string());
        let key1 = client.compute_cache_key("same text");
        let key2 = client.compute_cache_key("same text");
        let key3 = client.compute_cache_key("different text");

        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
    }
}
