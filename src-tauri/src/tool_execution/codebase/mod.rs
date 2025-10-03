//! 代码库分析工具模块
//!
//! 提供代码实体提取、分块增强和向量化功能

pub mod chunking;
pub mod embeddings;
pub mod enrichment;
pub mod examples_enrichment;
pub mod examples_file_walker;
pub mod extractors;
pub mod file_walker;

// 导出核心类型
pub use chunking::{ChunkBuilder, ChunkStats, CodeChunk};
pub use embeddings::{EmbeddedChunk, EmbeddingStats, EmbeddingsClient};
pub use enrichment::{
    EnrichedEntity, EnrichmentConfig, EnrichmentOrchestrator, StaticAnalysisResult,
};
pub use extractors::{CodeEntity, LocationInfo, TypeScriptExtractor, VueExtractor};
pub use file_walker::{
    EntityMetadata, FileWalker, SavedEntityData, ScanConfig, ScanStats, WorkspaceInfo,
};
