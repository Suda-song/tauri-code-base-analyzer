use crate::claude_client::error::ClaudeError;
use crate::claude_client::types::{
    ClaudeRequest, ClaudeResponse, DeerApiRequest, DeerApiResponse, Message, Tool,
};
use reqwest::Client;

// const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
// const CLAUDE_API_URL: &str = "http://api.daxiangai.vip/console/topup/v1/messages";
const CLAUDE_API_URL: &str = "https://api.deerapi.com/v1/messages";
const CLAUDE_API_VERSION: &str = "2023-06-01";

/// Claude API 客户端
pub struct ClaudeClient {
    client: Client,
    api_key: String,
    model: String,
    use_deer_api: bool, // 新增：是否使用 DeerAPI 格式
}

impl ClaudeClient {
    /// 创建新的 Claude 客户端
    ///
    /// # 错误
    /// 如果 ANTHROPIC_API_KEY 环境变量未设置，则返回错误
    pub fn new() -> Result<Self, ClaudeError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")?;

        Ok(Self {
            client: Client::new(),
            api_key,
            model: "deerapi-3-7-sonnet".to_string(),
            use_deer_api: true, // 默认使用 DeerAPI 格式
        })
    }

    /// 使用自定义模型创建客户端
    pub fn with_model(model: String) -> Result<Self, ClaudeError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")?;

        Ok(Self {
            client: Client::new(),
            api_key,
            model,
            use_deer_api: true, // 默认使用 DeerAPI 格式
        })
    }

    /// 创建使用标准 Claude API 格式的客户端
    pub fn new_standard() -> Result<Self, ClaudeError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")?;

        Ok(Self {
            client: Client::new(),
            api_key,
            model: "deerapi-3-7-sonnet".to_string(),
            use_deer_api: false,
        })
    }

    /// 发送消息到 Claude API（支持工具）
    ///
    /// # 参数
    /// - `messages`: 消息列表
    /// - `system_prompt`: 可选的系统提示词
    /// - `max_tokens`: 最大生成令牌数
    /// - `tools`: 可选的工具定义列表
    ///
    /// # 返回
    /// 返回完整的 Claude 响应
    pub async fn send_message(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        max_tokens: u32,
        tools: Option<Vec<Tool>>,
    ) -> Result<ClaudeResponse, ClaudeError> {
        println!("走了 send_message: {:?}", self.use_deer_api);
        if self.use_deer_api {
            self.send_message_deer_api(messages, system_prompt, max_tokens, tools)
                .await
        } else {
            self.send_message_standard(messages, system_prompt, max_tokens, tools)
                .await
        }
    }

    /// 使用标准 Claude API 格式发送消息
    async fn send_message_standard(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        max_tokens: u32,
        tools: Option<Vec<Tool>>,
    ) -> Result<ClaudeResponse, ClaudeError> {
        let request = ClaudeRequest {
            model: self.model.clone(),
            messages,
            system: system_prompt,
            max_tokens,
            temperature: Some(0.7),
            tools,
            stream: Some(false),
        };

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", CLAUDE_API_VERSION)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(ClaudeError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let response_body: ClaudeResponse = response.json().await?;
        Ok(response_body)
    }

    /// 使用 DeerAPI 格式发送消息
    async fn send_message_deer_api(
        &self,
        mut messages: Vec<Message>,
        system_prompt: Option<String>,
        max_tokens: u32,
        _tools: Option<Vec<Tool>>, // DeerAPI 可能不支持工具
    ) -> Result<ClaudeResponse, ClaudeError> {
        // 如果有系统提示词，将其作为第一条消息添加
        if let Some(system) = system_prompt {
            // 在 messages 开头添加系统消息（作为 user 角色，因为有些 API 不支持 system 角色）
            let system_message = Message {
                role: "user".to_string(),
                content: Some(crate::claude_client::types::MessageContent::Text(format!(
                    "System: {}",
                    system
                ))),
            };
            messages.insert(0, system_message);
        }

        let request = DeerApiRequest {
            model: self.model.clone(),
            messages,
            max_tokens,
            thinking: None, // 可选的思考配置
            temperature: Some(0.7),
            stream: Some(false),
        };
        println!("走了 DeerAPI 格式: {:?}", self.api_key);

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header(
                "Authorization",
                format!(
                    "Bearer {}",
                    "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb"
                ),
            )
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(ClaudeError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let response_body: DeerApiResponse = response.json().await?;

        // 先获取文本内容
        let response_text = response_body.get_text();

        // 转换为标准 ClaudeResponse 格式
        Ok(ClaudeResponse {
            id: response_body
                .id
                .unwrap_or_else(|| "deerapi_response".to_string()),
            model: response_body.model.unwrap_or_else(|| self.model.clone()),
            content: response_body.content.unwrap_or_else(|| {
                vec![crate::claude_client::types::ContentBlock::Text {
                    text: response_text,
                }]
            }),
            stop_reason: response_body.stop_reason,
            usage: response_body
                .usage
                .unwrap_or_else(|| crate::claude_client::types::Usage {
                    input_tokens: None,
                    output_tokens: None,
                    prompt_tokens: None,
                    completion_tokens: None,
                    total_tokens: None,
                }),
        })
    }

    /// 简单的文本查询（无工具）
    ///
    /// # 参数
    /// - `prompt`: 用户提示词
    ///
    /// # 返回
    /// 返回 Claude 的响应文本
    pub async fn query(&self, prompt: String) -> Result<String, ClaudeError> {
        let messages = vec![Message::user(prompt)];

        let response = self.send_message(messages, None, 4096, None).await?;
        Ok(response.get_text())
    }

    /// 带系统提示词的查询
    pub async fn query_with_system(
        &self,
        prompt: String,
        system_prompt: String,
    ) -> Result<String, ClaudeError> {
        let messages = vec![Message::user(prompt)];

        let response = self
            .send_message(messages, Some(system_prompt), 4096, None)
            .await?;
        Ok(response.get_text())
    }

    /// 获取当前使用的模型
    pub fn model(&self) -> &str {
        &self.model
    }

    /// 设置模型
    pub fn set_model(&mut self, model: String) {
        self.model = model;
    }

    /// 设置是否使用 DeerAPI 格式
    pub fn set_use_deer_api(&mut self, use_deer_api: bool) {
        self.use_deer_api = use_deer_api;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要实际的 API 密钥才能运行
    async fn test_send_message() {
        let client = ClaudeClient::new().expect("Failed to create client");

        let response = client
            .query("你好，请用一句话介绍你自己。".to_string())
            .await
            .expect("Failed to send message");

        println!("Response: {}", response);
        assert!(!response.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_with_tools() {
        use crate::claude_client::types::Tool;

        let client = ClaudeClient::new().expect("Failed to create client");

        let tools = vec![Tool {
            name: "calculator".to_string(),
            description: "执行数学计算".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式"
                    }
                },
                "required": ["expression"]
            }),
        }];

        let response = client
            .send_message(
                vec![Message::user("1+1等于多少？请使用计算器工具".to_string())],
                None,
                1024,
                Some(tools),
            )
            .await
            .expect("Failed to send message");

        println!("Response: {:?}", response);
        println!("Text: {}", response.get_text());
        println!("Tool uses: {:?}", response.get_tool_uses());
    }
}
