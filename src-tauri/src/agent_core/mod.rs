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
pub mod agent_sdk_coding_agent; // 基于 @anthropic-ai/claude-agent-sdk 理念（旧版）
pub mod coding_agent;
pub mod enhanced_coding_agent;
mod prompts;
pub mod real_agent_sdk_coding_agent; // ✅ 真正使用 @anthropic-ai/claude-agent-sdk@0.1.5
mod ts_agent;
mod types;

pub use agent::ClaudeAgent;
pub use agent_sdk_coding_agent::{
    AgentConfig as AgentSdkConfig, AgentMode as AgentSdkMode, AgentSdkCodingAgent,
    CodingTask as AgentSdkTask,
};
pub use coding_agent::{
    AgentMode, CodingAgent, CodingAgentConfig, CodingQuery, CodingResponse, ConversationTurn,
};
pub use enhanced_coding_agent::{
    AgentConfig as EnhancedAgentConfig, AgentMode as EnhancedAgentMode, CodingTask,
    EnhancedCodingAgent,
};
pub use prompts::{CODE_ANALYSIS_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT, WEB_SEARCH_SYSTEM_PROMPT};
pub use real_agent_sdk_coding_agent::{
    AgentConfig as RealAgentSdkConfig, AgentMode as RealAgentSdkMode,
    CodingTask as RealAgentSdkTask, RealAgentSdkCodingAgent,
};
pub use ts_agent::TypeScriptAgent;
pub use types::{AgentConfig, AgentQuery, AgentResponse, ConversationMessage};
