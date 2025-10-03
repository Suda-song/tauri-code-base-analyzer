/// Enrichment Agent 模块
///
/// 负责对提取的代码实体进行富化处理：
/// 1. 静态分析：提取导入、调用、事件等信息
/// 2. LLM 标注：生成摘要和标签
/// 3. 持久化：保存富化后的实体
pub mod interfaces;
pub mod loader;
pub mod orchestrator;
pub mod persistence;
pub mod static_analyzer;

// 重新导出核心类型
pub use interfaces::{EnrichedEntity, EnrichmentConfig, StaticAnalysisResult};
pub use loader::load_entities;
pub use orchestrator::EnrichmentOrchestrator;
pub use persistence::save_enriched_entities;
pub use static_analyzer::StaticAnalyzer;
