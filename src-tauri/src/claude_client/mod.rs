//! Claude API 客户端模块
//! 
//! 提供与 Claude API 交互的基础设施，包括：
//! - HTTP 客户端封装
//! - 请求/响应类型定义
//! - 错误处理
//! 
//! # 使用示例
//! 
//! ```rust
//! use claude_client::ClaudeClient;
//! 
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let client = ClaudeClient::new()?;
//!     let response = client.query("Hello, Claude!".to_string()).await?;
//!     println!("{}", response);
//!     Ok(())
//! }
//! ```

mod client;
mod types;
mod error;

pub use client::ClaudeClient;
pub use types::{
    Message, MessageContent, ContentBlock, Tool, ToolUseBlock,
    ClaudeRequest, ClaudeResponse, Usage
};
pub use error::ClaudeError;
