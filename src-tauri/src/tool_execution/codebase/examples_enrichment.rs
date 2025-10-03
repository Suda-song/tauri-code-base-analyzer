//! Enrichment 使用示例
//!
//! 演示如何使用 EnrichmentOrchestrator 进行代码富化

#[cfg(test)]
mod tests {
    use crate::tool_execution::codebase::{EnrichmentConfig, EnrichmentOrchestrator, FileWalker};

    /// 示例 1: 完整的富化流程（扫描 → 富化 → 保存）
    #[tokio::test]
    #[ignore] // 需要手动运行: cargo test example_full_enrichment_flow -- --ignored
    async fn example_full_enrichment_flow() {
        dotenv::dotenv().ok();

        let project_dir =
            "/Users/songdingan/dev/aurora/packages/fulfillment/fulfillment-order-moon";

        println!("🚀 开始完整的代码富化流程...\n");

        // 步骤 1: 扫描项目，提取实体
        println!("📂 步骤 1: 扫描项目");
        let walker = FileWalker::with_default();
        let (entities, scan_stats) = walker.extract_all_entities(project_dir).expect("扫描失败");
        println!("✅ 扫描完成: {} 个实体", entities.len());

        // 步骤 2: 保存基础实体到 JSON
        println!("\n💾 步骤 2: 保存基础实体");
        let base_entities_path = walker
            .save_entities(entities.clone(), scan_stats, project_dir, Some("src/data"))
            .expect("保存失败");
        println!("✅ 基础实体已保存到: {}", base_entities_path.display());

        // 步骤 3: 执行富化处理
        println!("\n🔍 步骤 3: 富化实体");
        let config = EnrichmentConfig {
            concurrency: 5,
            max_retries: 3,
            retry_delay: 1000,
            input_path: base_entities_path.to_string_lossy().to_string(),
            output_path: "src/data/entities.enriched.json".to_string(),
            pre_initialize: false,
        };

        let mut orchestrator =
            EnrichmentOrchestrator::new(project_dir.to_string(), Some(config), Some(entities));

        let enriched_path = orchestrator.run().await.expect("富化失败");
        println!("✅ 富化完成: {}", enriched_path);

        println!("\n🎉 完整流程执行成功!");
    }
}
