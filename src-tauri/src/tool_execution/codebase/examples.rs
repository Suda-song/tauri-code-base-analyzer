//! 使用示例
//!
//! 演示如何使用代码分块和向量化模块

#[cfg(test)]
mod tests {
    use crate::tool_execution::codebase::{ChunkBuilder, EmbeddingsClient, TypeScriptExtractor};

    /// 示例 1: 基础的代码分块
    #[test]
    fn example_basic_chunking() {
        // 1. 使用 TypeScriptExtractor 提取实体
        let mut extractor = TypeScriptExtractor::new(false).expect("创建提取器失败");
        let test_file = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo/src/api/afterSale.ts";
        let root_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        let entities = extractor
            .extract(test_file, root_dir)
            .expect("提取实体失败");
        println!("✅ 提取到 {} 个实体", entities.len());

        // 2. 创建 ChunkBuilder
        let builder = ChunkBuilder::new(root_dir.to_string());

        // 3. 将实体转换为 chunks
        let (chunks, stats) = builder.build_chunks(entities).expect("构建 chunks 失败");

        println!("\n📦 代码块统计:");
        println!("  总数: {}", stats.total_chunks);
        println!("  总代码量: {} 字符", stats.total_code_size);
        println!("  平均大小: {} 字符", stats.avg_chunk_size);
        println!("  类型分布: {:?}", stats.by_type);

        // 4. 查看第一个 chunk 的详细信息
        if let Some(chunk) = chunks.first() {
            println!("\n📄 第一个代码块示例:");
            println!("  ID: {}", chunk.id);
            println!("  类型: {}", chunk.entity_type);
            println!("  文件: {}", chunk.relative_file);
            println!("  导入: {:?}", chunk.imports);
            println!("  导出: {:?}", chunk.exports);
            println!("  复杂度: {}", chunk.complexity);
            println!("  是否测试: {}", chunk.is_test);
            println!("\n  Embedding 文本预览:");
            let preview = chunk.embedding_text.chars().take(200).collect::<String>();
            println!("  {}", preview);
            if chunk.embedding_text.len() > 200 {
                println!("  ...(还有 {} 字符)", chunk.embedding_text.len() - 200);
            }
        }

        assert!(!chunks.is_empty());
    }

    /// 示例 2: 完整的向量化流程（需要 OpenAI API Key）
    #[tokio::test]
    #[ignore] // 默认忽略，需要手动运行: cargo test example_full_workflow -- --ignored
    async fn example_full_workflow() {
        // 确保设置了环境变量
        let api_key = std::env::var("OPENAI_API_KEY").expect("请设置 OPENAI_API_KEY 环境变量");

        // 1. 提取实体
        let mut extractor = TypeScriptExtractor::new(false).unwrap();
        let test_file = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo/src/api/afterSale.ts";
        let root_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        let entities = extractor.extract(test_file, root_dir).unwrap();
        println!("🔍 提取到 {} 个实体", entities.len());

        // 2. 构建 chunks
        let builder = ChunkBuilder::new(root_dir.to_string());
        let (chunks, stats) = builder.build_chunks(entities).unwrap();
        println!("📦 生成了 {} 个代码块", chunks.len());
        println!("📊 平均大小: {} 字符", stats.avg_chunk_size);

        // 3. 向量化（只处理前 3 个作为示例）
        let sample_chunks: Vec<_> = chunks.into_iter().take(3).collect();
        println!("\n🧠 开始向量化 {} 个代码块...", sample_chunks.len());

        let mut embeddings_client = EmbeddingsClient::new(api_key);
        let (embedded_chunks, embed_stats) =
            embeddings_client.embed_chunks(sample_chunks).await.unwrap();

        // 4. 查看结果
        println!("\n✅ 向量化完成!");
        println!("  总数: {}", embedded_chunks.len());
        println!("  向量维度: {}", embedded_chunks[0].embedding.len());
        println!("  总 tokens: {}", embed_stats.total_tokens);
        println!("  预估成本: ${:.4}", embed_stats.estimated_cost);
        println!("  耗时: {:.2}s", embed_stats.duration_secs);

        // 5. 保存结果（可选）
        let json = serde_json::to_string_pretty(&embedded_chunks).unwrap();
        std::fs::write("embedded_chunks_example.json", json).unwrap();
        println!("\n💾 已保存到 embedded_chunks_example.json");
    }

    /// 示例 3: 测试缓存功能
    #[tokio::test]
    #[ignore]
    async fn example_caching() {
        let api_key = std::env::var("OPENAI_API_KEY").expect("请设置 OPENAI_API_KEY 环境变量");

        let mut extractor = TypeScriptExtractor::new(false).unwrap();
        let test_file = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo/src/api/afterSale.ts";
        let root_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        let entities = extractor.extract(test_file, root_dir).unwrap();
        let builder = ChunkBuilder::new(root_dir.to_string());
        let (chunks, _) = builder.build_chunks(entities).unwrap();

        let mut embeddings_client = EmbeddingsClient::new(api_key);

        // 第一次调用（会调用 API）
        println!("🧠 第一次向量化...");
        let (_, stats1) = embeddings_client
            .embed_chunks(chunks.clone())
            .await
            .unwrap();

        println!("  API 调用: {}", stats1.api_calls);
        println!("  缓存命中: {}", stats1.cache_hits);

        // 第二次调用（应该全部命中缓存）
        println!("\n🧠 第二次向量化（应该命中缓存）...");
        let (_, stats2) = embeddings_client
            .embed_chunks(chunks.clone())
            .await
            .unwrap();

        println!("  API 调用: {}", stats2.api_calls);
        println!("  缓存命中: {}", stats2.cache_hits);

        assert_eq!(stats2.api_calls, 0, "第二次调用不应该有 API 调用");
        assert_eq!(stats2.cache_hits, chunks.len(), "应该全部命中缓存");
    }
}
