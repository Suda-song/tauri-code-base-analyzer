//! Agent 核心模块
//! 
//! 提供 Claude AI Agent 的核心实现，包括：
//! - Agent 逻辑和对话管理
//! - 工具注册和调用
//! - Prompt 工程
//! - 会话状态管理
//! 
//! # 架构说明
//! 
//! Agent 依赖两个底层模块：
//! 1. `claude_client` - 用于与 Claude API 通信
//! 2. `tool_execution` - 提供可调用的工具
//! 
//! # 使用示例
//! 
//! ```rust
//! use agent_core::{ClaudeAgent, AgentQuery};
//! use tool_execution::system::BashTool;
//! 
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // 创建 Agent
//!     let mut agent = ClaudeAgent::new()?;
//!     
//!     // 注册工具
//!     agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));
//!     
//!     // 执行查询
//!     let query = AgentQuery {
//!         prompt: "列出当前目录的文件".to_string(),
//!         system_prompt: None,
//!         max_tokens: None,
//!     };
//!     
//!     let response = agent.query(query).await?;
//!     println!("{}", response.content);
//!     
//!     Ok(())
//! }
//! ```

mod agent;
mod types;
mod prompts;
mod ts_agent;

pub use agent::ClaudeAgent;
pub use ts_agent::TypeScriptAgent;
pub use types::{AgentQuery, AgentResponse, AgentConfig, ConversationMessage};
pub use prompts::{
    DEFAULT_SYSTEM_PROMPT,
    CODE_ANALYSIS_SYSTEM_PROMPT,
    WEB_SEARCH_SYSTEM_PROMPT,
};
