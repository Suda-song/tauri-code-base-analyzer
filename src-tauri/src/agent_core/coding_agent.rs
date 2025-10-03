use crate::tool_execution::{AgentTool, ToolResult};
use crate::ts_sdk_wrapper::{ToolDefinition, ToolUse, TypeScriptSDKWrapper};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// AI Coding Agent 的完整实现
///
/// 功能包括：
/// - 代码分析和理解
/// - 文件读写操作
/// - 代码搜索和导航
/// - 代码执行和测试
/// - 多轮对话和上下文管理
pub struct CodingAgent {
    sdk: TypeScriptSDKWrapper,
    tools: HashMap<String, Box<dyn AgentTool>>,
    config: CodingAgentConfig,
    conversation_history: Vec<ConversationTurn>,
}

/// Coding Agent 配置
#[derive(Debug, Clone)]
pub struct CodingAgentConfig {
    /// 工作目录
    pub workspace: String,
    /// 最大工具调用轮数
    pub max_tool_iterations: usize,
    /// 默认最大 tokens
    pub default_max_tokens: u32,
    /// 是否启用工具
    pub enable_tools: bool,
    /// 是否保存对话历史
    pub save_history: bool,
    /// Agent 模式
    pub mode: AgentMode,
}

/// Agent 工作模式
#[derive(Debug, Clone, PartialEq)]
pub enum AgentMode {
    /// 代码分析模式 - 只读，专注理解代码
    Analysis,
    /// 代码编辑模式 - 可读写，修改代码
    Edit,
    /// 代码生成模式 - 创建新代码
    Generate,
    /// 调试模式 - 查找和修复问题
    Debug,
    /// 重构模式 - 改进代码结构
    Refactor,
}

/// 对话轮次
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationTurn {
    pub role: String,
    pub content: String,
    pub tools_used: Vec<String>,
    pub timestamp: String,
}

/// Coding 查询
#[derive(Debug, Clone)]
pub struct CodingQuery {
    /// 用户的请求
    pub prompt: String,
    /// 相关文件路径（可选）
    pub files: Vec<String>,
    /// 最大 tokens
    pub max_tokens: Option<u32>,
    /// 是否需要详细解释
    pub verbose: bool,
}

/// Coding 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingResponse {
    pub success: bool,
    pub content: String,
    pub tools_used: Vec<String>,
    pub files_modified: Vec<String>,
    pub suggestions: Vec<String>,
    pub error: Option<String>,
}

impl Default for CodingAgentConfig {
    fn default() -> Self {
        Self {
            workspace: ".".to_string(),
            max_tool_iterations: 10,
            default_max_tokens: 8192,
            enable_tools: true,
            save_history: true,
            mode: AgentMode::Analysis,
        }
    }
}

impl CodingAgent {
    /// 创建新的 Coding Agent
    pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>> {
        let config = CodingAgentConfig {
            workspace: workspace.clone(),
            ..Default::default()
        };
        Self::with_config(config)
    }

    /// 使用自定义配置创建
    pub fn with_config(config: CodingAgentConfig) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            sdk: TypeScriptSDKWrapper::new()?,
            tools: HashMap::new(),
            config,
            conversation_history: Vec::new(),
        })
    }

    /// 设置工作模式
    pub fn set_mode(&mut self, mode: AgentMode) {
        self.config.mode = mode;
    }

    /// 注册工具
    pub fn register_tool(&mut self, tool: Box<dyn AgentTool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    /// 注册所有编码工具
    pub fn register_coding_tools(&mut self) {
        use crate::tool_execution::{
            search::{GlobTool, GrepTool},
            system::{BashTool, FileOpsTool},
        };

        // 文件操作工具
        self.register_tool(Box::new(FileOpsTool::new(self.config.workspace.clone())));

        // 搜索工具
        self.register_tool(Box::new(GrepTool::new(self.config.workspace.clone())));
        self.register_tool(Box::new(GlobTool::new(self.config.workspace.clone())));

        // Bash 工具（根据模式决定是否允许）
        if self.config.mode != AgentMode::Analysis {
            self.register_tool(Box::new(BashTool::new(self.config.workspace.clone())));
        }
    }

    /// 执行编码任务
    pub async fn code(
        &mut self,
        query: CodingQuery,
    ) -> Result<CodingResponse, Box<dyn std::error::Error>> {
        let max_tokens = query.max_tokens.unwrap_or(self.config.default_max_tokens);

        // 构建系统提示词
        let system_prompt = self.build_system_prompt(&query);

        // 构建增强的用户提示词
        let enhanced_prompt = self.build_enhanced_prompt(&query)?;

        // 保存用户查询到历史
        if self.config.save_history {
            self.conversation_history.push(ConversationTurn {
                role: "user".to_string(),
                content: query.prompt.clone(),
                tools_used: vec![],
                timestamp: chrono::Utc::now().to_rfc3339(),
            });
        }

        let mut response = CodingResponse {
            success: false,
            content: String::new(),
            tools_used: Vec::new(),
            files_modified: Vec::new(),
            suggestions: Vec::new(),
            error: None,
        };

        // 如果没有工具或工具被禁用，使用简单查询
        if !self.config.enable_tools || self.tools.is_empty() {
            let content = self
                .sdk
                .query(enhanced_prompt, Some(system_prompt), Some(max_tokens))
                .await?;

            response.content = content;
            response.success = true;
            self.save_assistant_turn(&response);
            return Ok(response);
        }

        // 工具调用循环
        let mut current_prompt = enhanced_prompt;

        for iteration in 0..self.config.max_tool_iterations {
            println!("\n{}", "=".repeat(60));
            println!("🔄 Coding Agent - 第 {} 轮迭代", iteration + 1);
            println!("{}\n", "=".repeat(60));

            // 构建工具定义
            let tools: Vec<ToolDefinition> = self
                .tools
                .iter()
                .map(|(_, tool)| ToolDefinition {
                    name: tool.name().to_string(),
                    description: tool.description().to_string(),
                    input_schema: tool.parameters_schema(),
                })
                .collect();

            println!(
                "📋 可用工具: {}",
                tools
                    .iter()
                    .map(|t| t.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            );

            // 调用 Claude
            let (content, tool_uses) = self
                .sdk
                .query_with_tools(
                    current_prompt.clone(),
                    Some(system_prompt.clone()),
                    Some(max_tokens),
                    tools,
                )
                .await?;

            println!("\n💬 Claude 回复:");
            println!("{}", Self::format_response(&content));

            response.content = content.clone();

            // 检查是否有工具调用
            if tool_uses.is_empty() {
                println!("\n✅ 任务完成！没有更多工具需要调用。");
                response.success = true;
                self.save_assistant_turn(&response);
                return Ok(response);
            }

            // 执行工具调用
            println!("\n🔧 执行 {} 个工具调用:", tool_uses.len());
            let tool_results = self.execute_tools(&tool_uses, &mut response).await?;

            // 构建下一轮的提示词
            current_prompt = self.build_continuation_prompt(&query.prompt, &content, &tool_results);
        }

        // 达到最大迭代次数
        println!(
            "\n⚠️  达到最大迭代次数 ({})",
            self.config.max_tool_iterations
        );
        response.error = Some(format!(
            "达到最大工具调用次数 ({})，任务可能未完全完成",
            self.config.max_tool_iterations
        ));

        self.save_assistant_turn(&response);
        Ok(response)
    }

    /// 执行工具调用
    async fn execute_tools(
        &mut self,
        tool_uses: &[ToolUse],
        response: &mut CodingResponse,
    ) -> Result<Vec<(String, ToolResult)>, Box<dyn std::error::Error>> {
        let mut results = Vec::new();

        for (idx, tool_use) in tool_uses.iter().enumerate() {
            println!("\n  [{}] 🔨 工具: {}", idx + 1, tool_use.name);
            println!("      ID: {}", tool_use.id);
            println!(
                "      参数: {}",
                serde_json::to_string_pretty(&tool_use.input)?
            );

            if let Some(tool) = self.tools.get(&tool_use.name) {
                match tool.execute(tool_use.input.clone()).await {
                    Ok(result) => {
                        if result.success {
                            println!("      ✅ 成功");
                            println!("      输出: {}", Self::truncate_output(&result.output, 200));

                            // 记录文件修改
                            if tool_use.name == "file_ops" {
                                if let Some(file) = tool_use.input.get("file_path") {
                                    response
                                        .files_modified
                                        .push(file.as_str().unwrap_or("").to_string());
                                }
                            }
                        } else {
                            println!("      ⚠️  失败: {:?}", result.error);
                        }

                        response.tools_used.push(tool_use.name.clone());
                        results.push((tool_use.id.clone(), result));
                    }
                    Err(e) => {
                        println!("      ❌ 执行错误: {}", e);
                        results.push((
                            tool_use.id.clone(),
                            ToolResult::failure(format!("执行错误: {}", e)),
                        ));
                    }
                }
            } else {
                println!("      ❌ 工具不存在");
                results.push((
                    tool_use.id.clone(),
                    ToolResult::failure(format!("工具不存在: {}", tool_use.name)),
                ));
            }
        }

        Ok(results)
    }

    /// 构建系统提示词
    fn build_system_prompt(&self, query: &CodingQuery) -> String {
        let mode_description = match self.config.mode {
            AgentMode::Analysis => "你是一个代码分析专家。专注于理解代码结构、识别模式、发现问题。你只能读取文件，不能修改。",
            AgentMode::Edit => "你是一个代码编辑助手。可以读取和修改文件来改进代码。在修改前要充分理解代码上下文。",
            AgentMode::Generate => "你是一个代码生成专家。可以创建新的代码文件和模块。遵循最佳实践和代码规范。",
            AgentMode::Debug => "你是一个调试专家。帮助定位和修复代码问题。使用工具查找错误根源。",
            AgentMode::Refactor => "你是一个重构专家。改进代码结构和设计，同时保持功能不变。",
        };

        format!(
            r#"{}

工作目录: {}
可用工具: {}

指导原则:
1. 在执行操作前，先充分理解上下文
2. 使用工具收集必要的信息
3. 提供清晰的解释和建议
4. 如果不确定，询问用户
5. 注重代码质量和最佳实践
{}
"#,
            mode_description,
            self.config.workspace,
            self.tools
                .keys()
                .map(|k| k.as_str())
                .collect::<Vec<_>>()
                .join(", "),
            if query.verbose {
                "\n6. 提供详细的步骤说明和理由"
            } else {
                ""
            }
        )
    }

    /// 构建增强的用户提示词
    fn build_enhanced_prompt(
        &self,
        query: &CodingQuery,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut prompt = query.prompt.clone();

        // 如果指定了相关文件，添加文件内容
        if !query.files.is_empty() {
            prompt.push_str("\n\n相关文件：\n");
            for file_path in &query.files {
                let full_path = std::path::Path::new(&self.config.workspace).join(file_path);
                if full_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&full_path) {
                        prompt.push_str(&format!("\n### {}\n```\n{}\n```\n", file_path, content));
                    }
                }
            }
        }

        // 添加对话历史上下文（最近3轮）
        if self.config.save_history && !self.conversation_history.is_empty() {
            let recent_history: Vec<_> = self
                .conversation_history
                .iter()
                .rev()
                .take(6) // 3轮对话 = 6条消息
                .rev()
                .collect();

            if !recent_history.is_empty() {
                prompt.push_str("\n\n对话历史：\n");
                for turn in recent_history {
                    prompt.push_str(&format!("\n[{}] {}", turn.role, turn.content));
                }
            }
        }

        Ok(prompt)
    }

    /// 构建延续提示词
    fn build_continuation_prompt(
        &self,
        original_prompt: &str,
        last_response: &str,
        tool_results: &[(String, ToolResult)],
    ) -> String {
        let results_text = tool_results
            .iter()
            .map(|(id, result)| {
                let status = if result.success {
                    "✅ 成功"
                } else {
                    "❌ 失败"
                };
                let default_error = "未知错误".to_string();
                let output = if result.success {
                    &result.output
                } else {
                    result.error.as_ref().unwrap_or(&default_error)
                };

                format!("工具调用 [{}]: {}\n结果:\n{}", id, status, output)
            })
            .collect::<Vec<_>>()
            .join("\n\n");

        format!(
            r#"原始任务: {}

你的上一次回复: {}

工具执行结果：
{}

请基于这些结果继续完成任务。如果任务已完成，请总结结果。如果需要更多操作，请继续使用工具。"#,
            original_prompt, last_response, results_text
        )
    }

    /// 保存助手回复到历史
    fn save_assistant_turn(&mut self, response: &CodingResponse) {
        if self.config.save_history {
            self.conversation_history.push(ConversationTurn {
                role: "assistant".to_string(),
                content: response.content.clone(),
                tools_used: response.tools_used.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            });
        }
    }

    /// 格式化响应输出
    fn format_response(content: &str) -> String {
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() > 20 {
            format!(
                "{}...\n（共 {} 行，显示前 20 行）",
                lines[..20].join("\n"),
                lines.len()
            )
        } else {
            content.to_string()
        }
    }

    /// 截断输出
    fn truncate_output(output: &str, max_len: usize) -> String {
        if output.len() > max_len {
            format!("{}... (共 {} 字符)", &output[..max_len], output.len())
        } else {
            output.to_string()
        }
    }

    /// 获取对话历史
    pub fn get_history(&self) -> &[ConversationTurn] {
        &self.conversation_history
    }

    /// 清空对话历史
    pub fn clear_history(&mut self) {
        self.conversation_history.clear();
    }

    /// 导出对话历史为 JSON
    pub fn export_history(&self) -> Result<String, Box<dyn std::error::Error>> {
        Ok(serde_json::to_string_pretty(&self.conversation_history)?)
    }

    /// 简单查询（不使用工具）
    pub async fn simple_query(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>> {
        self.sdk.query(prompt, None, Some(4096)).await
    }
}

impl CodingResponse {
    pub fn success(content: String) -> Self {
        Self {
            success: true,
            content,
            tools_used: Vec::new(),
            files_modified: Vec::new(),
            suggestions: Vec::new(),
            error: None,
        }
    }

    pub fn with_suggestion(mut self, suggestion: String) -> Self {
        self.suggestions.push(suggestion);
        self
    }
}
