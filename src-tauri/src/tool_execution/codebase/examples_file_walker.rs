// src-tauri/src/tool_execution/codebase/examples_file_walker.rs

//! FileWalker 使用示例
//!
//! 演示如何使用 FileWalker 扫描整个项目并提取代码实体

#[cfg(test)]
mod tests {
    use crate::tool_execution::codebase::{ChunkBuilder, EmbeddingsClient, FileWalker, ScanConfig};

    /// 示例 1: 基础的项目扫描并保存
    #[test]
    fn example_scan_project() {
        let walker = FileWalker::with_default();
        let test_dir = "/Users/songdingan/dev/aurora/packages/fulfillment/fulfillment-order-moon";

        // 使用 scan_and_save 方法，一次性完成扫描和保存
        let (entities, stats, file_path) = walker
            .scan_and_save(test_dir, Some("src/data"))
            .expect("扫描失败");

        println!("\n✅ 项目扫描完成!");
        println!("  实体总数: {}", entities.len());
        println!("  成功文件: {}", stats.success_files);
        println!("  失败文件: {}", stats.failed_files);
        println!("  耗时: {}ms", stats.duration_ms);
        println!("  保存路径: {}", file_path.display());

        println!("\n📊 按文件类型统计:");
        for (ext, count) in &stats.by_extension {
            println!("  {}: {} 个文件", ext, count);
        }

        println!("\n📊 按实体类型统计:");
        for (entity_type, count) in &stats.by_entity_type {
            println!("  {}: {} 个", entity_type, count);
        }

        // 打印前 3 个实体的详细信息
        println!("\n📋 示例实体:");
        for (i, entity) in entities.iter().take(3).enumerate() {
            println!("  {}. {} - {}", i + 1, entity.entity_type, entity.raw_name);
            println!("     文件: {}", entity.file);
            println!(
                "     位置: 第 {}-{} 行",
                entity.loc.start_line, entity.loc.end_line
            );
        }

        assert!(!entities.is_empty());
        assert!(file_path.exists());
    }

    /// 示例 2: 分步保存（先扫描，后保存）
    #[test]
    fn example_scan_then_save() {
        let walker = FileWalker::with_default();
        let test_dir = "/Users/songdingan/dev/aurora/packages/fulfillment/fulfillment-order-moon";

        // 步骤 1: 扫描
        let (entities, stats) = walker.extract_all_entities(test_dir).expect("扫描失败");
        println!("✅ 扫描完成: {} 个实体", entities.len());

        // 步骤 2: 保存
        let file_path = walker
            .save_entities(entities, stats, test_dir, Some("src/data"))
            .expect("保存失败");
        println!("✅ 保存完成: {}", file_path.display());

        assert!(file_path.exists());
    }

    /// 示例 3: 完整的工作流（扫描 → 分块 → 向量化）
    #[tokio::test]
    #[ignore] // 需要手动运行: cargo test example_full_pipeline -- --ignored
    async fn example_full_pipeline() {
        let api_key = std::env::var("OPENAI_API_KEY").expect("请设置 OPENAI_API_KEY 环境变量");
        let test_dir = "/Users/songdingan/dev/aurora/packages/fulfillment/fulfillment-order-moon";

        println!("🚀 开始完整的代码分析流程...\n");

        // 步骤 1: 扫描项目
        println!("📂 步骤 1: 扫描项目文件");
        let walker = FileWalker::with_default();
        let (entities, scan_stats) = walker.extract_all_entities(test_dir).expect("扫描失败");
        println!("✅ 扫描完成: {} 个实体", entities.len());

        // 步骤 2: 构建代码块
        println!("\n📦 步骤 2: 构建代码块");
        let builder = ChunkBuilder::new(test_dir.to_string());
        let (chunks, chunk_stats) = builder.build_chunks(entities).expect("构建 chunks 失败");
        println!("✅ 构建完成: {} 个代码块", chunks.len());
        println!("  平均大小: {} 字符", chunk_stats.avg_chunk_size);

        // 步骤 3: 向量化（只处理前 5 个作为示例）
        println!("\n🧠 步骤 3: 向量化代码块");
        let sample_chunks: Vec<_> = chunks.into_iter().take(5).collect();
        let mut embeddings_client = EmbeddingsClient::new(api_key);
        let (embedded_chunks, embed_stats) = embeddings_client
            .embed_chunks(sample_chunks)
            .await
            .expect("向量化失败");

        println!("✅ 向量化完成: {} 个向量", embedded_chunks.len());
        println!("  API 调用: {}", embed_stats.api_calls);
        println!("  缓存命中: {}", embed_stats.cache_hits);
        println!("  预估成本: ${:.4}", embed_stats.estimated_cost);

        // 步骤 4: 保存结果
        println!("\n💾 步骤 4: 保存结果");
        let output = serde_json::json!({
            "scan_stats": scan_stats,
            "chunk_stats": chunk_stats,
            "embed_stats": embed_stats,
            "sample_chunks": embedded_chunks.iter().take(2).collect::<Vec<_>>(),
        });

        let json = serde_json::to_string_pretty(&output).unwrap();
        std::fs::write("full_pipeline_result.json", json).unwrap();
        println!("✅ 已保存到 full_pipeline_result.json");

        println!("\n🎉 完整流程执行成功!");
    }
}
