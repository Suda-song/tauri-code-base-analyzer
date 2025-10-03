// Library exports for examples and tests

// Core modules
pub mod agent_core;
pub mod claude_client;
pub mod tool_execution;

// Wrappers
pub mod agent_sdk_wrapper;
pub mod enhanced_claude_wrapper;
pub mod real_agent_sdk_wrapper;
pub mod ts_sdk_wrapper;

// Re-export commonly used types
pub use agent_core::{
    RealAgentSdkCodingAgent, RealAgentSdkConfig, RealAgentSdkMode, RealAgentSdkTask,
};
