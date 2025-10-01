//! 工具执行层模块
//! 
//! 提供 Agent 可以使用的各类工具，包括：
//! - 系统工具（Bash、文件操作）
//! - 搜索工具（Grep、Glob）
//! - Web 工具（网页抓取和分析）
//! - 代码库分析工具
//! 
//! # 架构说明
//! 
//! 这个模块是独立的工具执行层，某些工具需要 AI 辅助（如 WebFetchTool），
//! 它们会创建自己的 ClaudeClient 实例。
//! 
//! # 使用示例
//! 
//! ```rust
//! use tool_execution::{AgentTool, system::BashTool};
//! use serde_json::json;
//! 
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let bash = BashTool::new("/tmp".to_string());
//!     let result = bash.execute(json!({
//!         "command": "ls -la"
//!     })).await?;
//!     
//!     println!("{}", result.output);
//!     Ok(())
//! }
//! ```

mod tool_trait;
pub mod system;
pub mod search;
pub mod web;
pub mod codebase;

pub use tool_trait::{AgentTool, ToolResult};
