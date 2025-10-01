use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// 工具执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// 是否成功
    pub success: bool,
    /// 输出内容
    pub output: String,
    /// 可选的错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// 可选的元数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<JsonValue>,
}

impl ToolResult {
    /// 创建成功的结果
    pub fn success(output: String) -> Self {
        Self {
            success: true,
            output,
            error: None,
            metadata: None,
        }
    }

    /// 创建失败的结果
    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            output: String::new(),
            error: Some(error),
            metadata: None,
        }
    }

    /// 添加元数据
    pub fn with_metadata(mut self, metadata: JsonValue) -> Self {
        self.metadata = Some(metadata);
        self
    }
}

/// Agent 工具 Trait
/// 
/// 所有工具都需要实现此 trait，以便 Agent 可以统一调用
#[async_trait]
pub trait AgentTool: Send + Sync {
    /// 工具名称（唯一标识）
    fn name(&self) -> &str;

    /// 工具描述（用于 Agent 理解工具功能）
    fn description(&self) -> &str;

    /// 工具参数 Schema（JSON Schema 格式）
    fn parameters_schema(&self) -> JsonValue;

    /// 执行工具
    /// 
    /// # 参数
    /// - `input`: 工具输入参数（JSON 格式）
    /// 
    /// # 返回
    /// 返回工具执行结果
    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>>;

    /// 工具是否需要 AI 辅助
    fn requires_ai(&self) -> bool {
        false
    }

    /// 获取工具定义（用于 Claude API 的 tools 参数）
    fn to_tool_definition(&self) -> JsonValue {
        serde_json::json!({
            "name": self.name(),
            "description": self.description(),
            "input_schema": self.parameters_schema(),
        })
    }
}
