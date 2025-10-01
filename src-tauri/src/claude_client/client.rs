use reqwest::Client;
use crate::claude_client::types::{ClaudeRequest, ClaudeResponse, Message, Tool};
use crate::claude_client::error::ClaudeError;

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION: &str = "2023-06-01";

/// Claude API 客户端
pub struct ClaudeClient {
    client: Client,
    api_key: String,
    model: String,
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
            model: "claude-3-5-sonnet-20241022".to_string(),
        })
    }

    /// 使用自定义模型创建客户端
    pub fn with_model(model: String) -> Result<Self, ClaudeError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")?;
        
        Ok(Self {
            client: Client::new(),
            api_key,
            model,
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

        let response = self.send_message(messages, Some(system_prompt), 4096, None).await?;
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
        
        let tools = vec![
            Tool {
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
            }
        ];

        let response = client.send_message(
            vec![Message::user("1+1等于多少？请使用计算器工具".to_string())],
            None,
            1024,
            Some(tools),
        ).await.expect("Failed to send message");

        println!("Response: {:?}", response);
        println!("Text: {}", response.get_text());
        println!("Tool uses: {:?}", response.get_tool_uses());
    }
}