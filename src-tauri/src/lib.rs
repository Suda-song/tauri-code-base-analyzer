// Library exports for examples and tests

// 核心模块
pub mod claude_client; // Claude API 客户端
pub mod tool_execution; // 代码分析工具

// Re-export commonly used types
pub use tool_execution::codebase::{
    CodeEntity, EnrichmentConfig, EnrichmentOrchestrator, FileWalker, ScanConfig,
};
