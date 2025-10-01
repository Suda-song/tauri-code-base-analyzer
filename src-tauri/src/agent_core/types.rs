use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Agent 查询请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentQuery {
    /// 用户查询内容
    pub prompt: String,
    /// 可选的系统提示词
    pub system_prompt: Option<String>,
    /// 最大令牌数
    pub max_tokens: Option<u32>,
}

/// Agent 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    /// 响应内容
    pub content: String,
    /// 使用的工具列表
    pub tools_used: Vec<String>,
    /// 总令牌数
    pub total_tokens: Option<u32>,
    /// 是否成功
    pub success: bool,
    /// 错误信息（如果有）
    pub error: Option<String>,
}

impl AgentResponse {
    /// 创建成功响应
    pub fn success(content: String) -> Self {
        Self {
            content,
            tools_used: Vec::new(),
            total_tokens: None,
            success: true,
            error: None,
        }
    }

    /// 创建失败响应
    pub fn failure(error: String) -> Self {
        Self {
            content: String::new(),
            tools_used: Vec::new(),
            total_tokens: None,
            success: false,
            error: Some(error),
        }
    }

    /// 添加使用的工具
    pub fn with_tool(mut self, tool_name: String) -> Self {
        self.tools_used.push(tool_name);
        self
    }
}

/// 工具调用请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// 工具名称
    pub name: String,
    /// 工具输入参数
    pub input: JsonValue,
}

/// 对话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    /// 角色（user、assistant、tool）
    pub role: String,
    /// 消息内容
    pub content: String,
    /// 可选的工具调用
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Agent 配置
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// 使用的模型
    pub model: String,
    /// 默认最大令牌数
    pub default_max_tokens: u32,
    /// 温度参数
    pub temperature: f32,
    /// 是否启用工具使用
    pub enable_tools: bool,
    /// 最大工具调用次数（防止无限循环）
    pub max_tool_iterations: usize,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            model: "claude-3-5-sonnet-20241022".to_string(),
            default_max_tokens: 4096,
            temperature: 0.7,
            enable_tools: true,
            max_tool_iterations: 10,
        }
    }
}
