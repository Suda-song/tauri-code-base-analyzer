use std::collections::HashMap;
use crate::claude_client::{ClaudeClient, Message, Tool, ContentBlock, MessageContent};
use crate::tool_execution::{AgentTool, ToolResult};
use crate::agent_core::types::{AgentQuery, AgentResponse, AgentConfig};
use crate::agent_core::prompts::DEFAULT_SYSTEM_PROMPT;

/// Claude Agent 核心实现（使用原生 Tool Use API）
pub struct ClaudeAgent {
    /// Claude API 客户端
    claude: ClaudeClient,
    /// 注册的工具
    tools: HashMap<String, Box<dyn AgentTool>>,
    /// Agent 配置
    config: AgentConfig,
    /// 对话历史
    conversation_history: Vec<Message>,
}

impl ClaudeAgent {
    /// 创建新的 Agent
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Self::with_config(AgentConfig::default())
    }

    /// 使用自定义配置创建 Agent
    pub fn with_config(config: AgentConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let mut claude = ClaudeClient::new()?;
        claude.set_model(config.model.clone());

        Ok(Self {
            claude,
            tools: HashMap::new(),
            config,
            conversation_history: Vec::new(),
        })
    }

    /// 注册工具
    pub fn register_tool(&mut self, tool: Box<dyn AgentTool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    /// 构建工具定义列表
    fn build_tool_definitions(&self) -> Vec<Tool> {
        self.tools
            .iter()
            .map(|(_, tool)| Tool {
                name: tool.name().to_string(),
                description: tool.description().to_string(),
                input_schema: tool.parameters_schema(),
            })
            .collect()
    }

    /// 执行查询（使用原生 Tool Use API）
    pub async fn query(&mut self, query: AgentQuery) -> Result<AgentResponse, Box<dyn std::error::Error>> {
        // 添加用户消息到历史
        self.conversation_history.push(Message::user(query.prompt.clone()));

        // 构建系统提示词
        let system_prompt = query.system_prompt
            .unwrap_or_else(|| DEFAULT_SYSTEM_PROMPT.to_string());

        // 准备工具定义
        let tools = if self.config.enable_tools && !self.tools.is_empty() {
            Some(self.build_tool_definitions())
        } else {
            None
        };

        let max_tokens = query.max_tokens.unwrap_or(self.config.default_max_tokens);
        let mut response = AgentResponse::success(String::new());

        // 工具调用循环
        for iteration in 0..self.config.max_tool_iterations {
            println!("🔄 API 调用 - 第 {} 轮", iteration + 1);

            // 调用 Claude API
            let claude_response = self.claude.send_message(
                self.conversation_history.clone(),
                Some(system_prompt.clone()),
                max_tokens,
                tools.clone(),
            ).await?;

            println!("📝 Claude 回复: {}", claude_response.get_text());
            println!("   stop_reason: {:?}", claude_response.stop_reason);

            // 提取文本和工具调用
            let text_content = claude_response.get_text();
            let tool_uses = claude_response.get_tool_uses();

            // 将 Claude 的响应添加到历史
            self.conversation_history.push(Message::with_blocks(
                "assistant".to_string(),
                claude_response.content.clone(),
            ));

            // 更新响应内容
            if !text_content.is_empty() {
                response.content = text_content;
            }

            // 检查是否有工具调用
            if tool_uses.is_empty() {
                println!("✅ 没有工具调用，完成！");
                response.success = true;
                return Ok(response);
            }

            // 执行所有工具调用
            println!("🔧 执行 {} 个工具调用", tool_uses.len());
            let mut tool_results = Vec::new();

            for tool_use in tool_uses {
                println!("   工具: {} (id: {})", tool_use.name, tool_use.id);
                
                if let Some(tool) = self.tools.get(&tool_use.name) {
                    match tool.execute(tool_use.input.clone()).await {
                        Ok(result) => {
                            let result_text = if result.success {
                                format!("成功: {}", result.output)
                            } else {
                                format!("失败: {}", result.error.unwrap_or_else(|| "未知错误".to_string()))
                            };

                            println!("   ✅ 结果: {}", 
                                if result_text.len() > 100 {
                                    format!("{}...", &result_text[..100])
                                } else {
                                    result_text.clone()
                                }
                            );

                            tool_results.push(ContentBlock::ToolResult {
                                tool_use_id: tool_use.id.clone(),
                                content: result_text,
                                is_error: Some(!result.success),
                            });

                            response = response.with_tool(tool_use.name.clone());
                        }
                        Err(e) => {
                            println!("   ❌ 错误: {}", e);
                            tool_results.push(ContentBlock::ToolResult {
                                tool_use_id: tool_use.id.clone(),
                                content: format!("工具执行错误: {}", e),
                                is_error: Some(true),
                            });
                        }
                    }
                } else {
                    println!("   ❌ 工具不存在: {}", tool_use.name);
                    tool_results.push(ContentBlock::ToolResult {
                        tool_use_id: tool_use.id.clone(),
                        content: format!("工具不存在: {}", tool_use.name),
                        is_error: Some(true),
                    });
                }
            }

            // 将工具结果添加到对话历史
            self.conversation_history.push(Message::with_blocks(
                "user".to_string(),
                tool_results,
            ));
        }

        // 达到最大迭代次数
        println!("⚠️ 达到最大工具调用次数 ({})", self.config.max_tool_iterations);
        response.error = Some(format!(
            "达到最大工具调用次数 ({})",
            self.config.max_tool_iterations
        ));

        Ok(response)
    }

    /// 简单查询（无历史记录）
    pub async fn simple_query(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>> {
        let response = self.claude.query(prompt).await?;
        Ok(response)
    }

    /// 清除对话历史
    pub fn clear_history(&mut self) {
        self.conversation_history.clear();
    }

    /// 获取对话历史
    pub fn get_history(&self) -> &[Message] {
        &self.conversation_history
    }

    /// 获取已注册的工具列表
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_execution::system::BashTool;

    #[tokio::test]
    #[ignore] // 需要 API 密钥
    async fn test_agent_simple_query() {
        let agent = ClaudeAgent::new().unwrap();
        let response = agent.simple_query("你好！请介绍你自己。".to_string()).await.unwrap();
        println!("Response: {}", response);
        assert!(!response.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_agent_with_tools() {
        let mut agent = ClaudeAgent::new().unwrap();
        agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));
        
        let query = AgentQuery {
            prompt: "使用 bash 工具列出 /tmp 目录的内容".to_string(),
            system_prompt: None,
            max_tokens: Some(2048),
        };
        
        let response = agent.query(query).await.unwrap();
        
        println!("Response: {}", response.content);
        println!("Tools used: {:?}", response.tools_used);
        assert!(response.success);
        assert!(!response.tools_used.is_empty());
    }
}