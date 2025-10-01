use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Claude API 消息
/// content 可以是字符串或内容块数组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<MessageContent>,
}

/// 消息内容（可以是字符串或内容块数组）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

impl Message {
    /// 创建用户文本消息
    pub fn user(text: String) -> Self {
        Self {
            role: "user".to_string(),
            content: Some(MessageContent::Text(text)),
        }
    }

    /// 创建助手文本消息
    pub fn assistant(text: String) -> Self {
        Self {
            role: "assistant".to_string(),
            content: Some(MessageContent::Text(text)),
        }
    }

    /// 创建带内容块的消息
    pub fn with_blocks(role: String, blocks: Vec<ContentBlock>) -> Self {
        Self {
            role,
            content: Some(MessageContent::Blocks(blocks)),
        }
    }
}

/// 内容块（支持 text, tool_use, tool_result）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: JsonValue,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

/// 工具定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: JsonValue,
}

/// Claude API 请求体
#[derive(Debug, Serialize)]
pub struct ClaudeRequest {
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

/// Claude API 响应体
#[derive(Debug, Deserialize)]
pub struct ClaudeResponse {
    pub id: String,
    pub model: String,
    pub content: Vec<ContentBlock>,
    pub stop_reason: Option<String>,
    pub usage: Usage,
}

impl ClaudeResponse {
    /// 提取所有文本内容
    pub fn get_text(&self) -> String {
        self.content
            .iter()
            .filter_map(|block| {
                if let ContentBlock::Text { text } = block {
                    Some(text.as_str())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// 提取所有工具调用
    pub fn get_tool_uses(&self) -> Vec<ToolUseBlock> {
        self.content
            .iter()
            .filter_map(|block| {
                if let ContentBlock::ToolUse { id, name, input } = block {
                    Some(ToolUseBlock {
                        id: id.clone(),
                        name: name.clone(),
                        input: input.clone(),
                    })
                } else {
                    None
                }
            })
            .collect()
    }
}

/// 工具使用块（方便提取）
#[derive(Debug, Clone)]
pub struct ToolUseBlock {
    pub id: String,
    pub name: String,
    pub input: JsonValue,
}

/// API 使用统计
#[derive(Debug, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// 流式响应事件
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: PartialMessage },
    #[serde(rename = "content_block_start")]
    ContentBlockStart { index: u32, content_block: ContentBlock },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: u32, delta: Delta },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: u32 },
    #[serde(rename = "message_delta")]
    MessageDelta { delta: MessageDeltaInfo, usage: Usage },
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Debug, Deserialize)]
pub struct PartialMessage {
    pub id: String,
    pub model: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct Delta {
    #[serde(rename = "type")]
    pub delta_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MessageDeltaInfo {
    pub stop_reason: Option<String>,
}