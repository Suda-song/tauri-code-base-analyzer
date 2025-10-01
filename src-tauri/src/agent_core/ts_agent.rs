use std::collections::HashMap;
use crate::ts_sdk_wrapper::{TypeScriptSDKWrapper, ToolDefinition};
use crate::tool_execution::{AgentTool, ToolResult};
use crate::agent_core::types::{AgentQuery, AgentResponse, AgentConfig};

/// 使用 TypeScript SDK 的 Agent
/// 
/// 这个 Agent 通过 Node.js 桥接器调用官方的 @anthropic-ai/sdk
pub struct TypeScriptAgent {
    sdk: TypeScriptSDKWrapper,
    tools: HashMap<String, Box<dyn AgentTool>>,
    config: AgentConfig,
}

impl TypeScriptAgent {
    /// 创建新的 TypeScript SDK Agent
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Self::with_config(AgentConfig::default())
    }

    /// 使用自定义配置创建 Agent
    pub fn with_config(config: AgentConfig) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            sdk: TypeScriptSDKWrapper::new()?,
            tools: HashMap::new(),
            config,
        })
    }

    /// 注册工具
    pub fn register_tool(&mut self, tool: Box<dyn AgentTool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    /// 执行查询（带工具支持）
    pub async fn query(
        &mut self,
        query: AgentQuery,
    ) -> Result<AgentResponse, Box<dyn std::error::Error>> {
        let max_tokens = query.max_tokens.unwrap_or(self.config.default_max_tokens);
        
        if !self.config.enable_tools || self.tools.is_empty() {
            // 简单查询，无工具
            let content = self.sdk.query(
                query.prompt,
                query.system_prompt,
                Some(max_tokens),
            ).await?;
            
            return Ok(AgentResponse::success(content));
        }

        // 带工具的查询
        let mut response = AgentResponse::success(String::new());
        let mut current_prompt = query.prompt.clone();
        let system_prompt = query.system_prompt.clone();

        // 工具调用循环
        for iteration in 0..self.config.max_tool_iterations {
            println!("🔄 工具调用循环 - 第 {} 轮", iteration + 1);
            
            // 构建工具定义
            let tools: Vec<ToolDefinition> = self.tools
                .iter()
                .map(|(_, tool)| ToolDefinition {
                    name: tool.name().to_string(),
                    description: tool.description().to_string(),
                    input_schema: tool.parameters_schema(),
                })
                .collect();

            // 调用 TypeScript SDK
            let (content, tool_uses) = self.sdk.query_with_tools(
                current_prompt.clone(),
                system_prompt.clone(),
                Some(max_tokens),
                tools,
            ).await?;

            println!("📝 Claude 回复: {}", content);
            response.content = content.clone();

            // 检查是否有工具调用
            if tool_uses.is_empty() {
                println!("✅ 没有工具调用，完成！");
                response.success = true;
                return Ok(response);
            }

            // 执行所有工具调用
            let mut tool_results = Vec::new();
            for tool_use in &tool_uses {
                println!("🔧 执行工具: {} (id: {})", tool_use.name, tool_use.id);
                println!("   参数: {}", serde_json::to_string_pretty(&tool_use.input)?);
                
                if let Some(tool) = self.tools.get(&tool_use.name) {
                    match tool.execute(tool_use.input.clone()).await {
                        Ok(result) => {
                            println!("   ✅ 工具执行成功");
                            if result.success {
                                println!("   结果: {}", 
                                    if result.output.len() > 200 {
                                        format!("{}...", &result.output[..200])
                                    } else {
                                        result.output.clone()
                                    }
                                );
                            } else {
                                println!("   ⚠️ 工具返回失败: {:?}", result.error);
                            }
                            tool_results.push((tool_use.id.clone(), result));
                            response = response.with_tool(tool_use.name.clone());
                        }
                        Err(e) => {
                            println!("   ❌ 工具执行错误: {}", e);
                            tool_results.push((
                                tool_use.id.clone(),
                                ToolResult::failure(format!("工具执行错误: {}", e))
                            ));
                        }
                    }
                } else {
                    println!("   ❌ 工具不存在: {}", tool_use.name);
                    tool_results.push((
                        tool_use.id.clone(),
                        ToolResult::failure(format!("工具不存在: {}", tool_use.name))
                    ));
                }
            }

            // 构建下一轮的 prompt，包含工具执行结果
            let tool_results_text = tool_results
                .iter()
                .map(|(id, result)| {
                    let result_text = if result.success {
                        result.output.clone()
                    } else {
                        result.error.clone().unwrap_or_else(|| "未知错误".to_string())
                    };
                    
                    format!(
                        "工具调用 ID {}: {}\n结果: {}",
                        id,
                        if result.success { "成功" } else { "失败" },
                        result_text
                    )
                })
                .collect::<Vec<_>>()
                .join("\n\n");

            current_prompt = format!(
                "{}\n\n工具执行结果：\n{}\n\n请基于这些结果继续完成任务。",
                query.prompt,
                tool_results_text
            );
        }

        // 达到最大迭代次数
        println!("⚠️ 达到最大工具调用次数 ({})", self.config.max_tool_iterations);
        response.error = Some(format!(
            "达到最大工具调用次数 ({})",
            self.config.max_tool_iterations
        ));

        Ok(response)
    }

    /// 简单查询（无工具）
    pub async fn simple_query(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>> {
        self.sdk.query(prompt, None, Some(4096)).await
    }

    /// 获取已注册的工具列表
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }

    /// 清空工具
    pub fn clear_tools(&mut self) {
        self.tools.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_execution::system::BashTool;

    #[tokio::test]
    #[ignore] // 需要 API Key 和构建的 bridge
    async fn test_ts_agent_simple_query() {
        let agent = TypeScriptAgent::new().unwrap();
        let response = agent.simple_query("用一句话介绍 TypeScript".to_string())
            .await
            .unwrap();
        
        println!("Response: {}", response);
        assert!(!response.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_ts_agent_with_tools() {
        let mut agent = TypeScriptAgent::new().unwrap();
        
        // 注册 Bash 工具
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
