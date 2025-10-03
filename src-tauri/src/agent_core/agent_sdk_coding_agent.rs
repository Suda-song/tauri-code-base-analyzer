use crate::agent_sdk_wrapper::{
    AgentSdkRequest, AgentSdkResponse, AgentSdkWrapper, PermissionConfig,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Claude Agent SDK 编程助手
///
/// 基于官方 @anthropic-ai/claude-agent-sdk 实现的完整 AI 编程助手
pub struct AgentSdkCodingAgent {
    wrapper: AgentSdkWrapper,
    workspace: String,
    mode: AgentMode,
    config: AgentConfig,
}

/// Agent 工作模式
#[derive(Debug, Clone, PartialEq)]
pub enum AgentMode {
    /// 代码分析模式 - 只读，理解代码
    Analysis,
    /// 代码编辑模式 - 修改现有代码
    Edit,
    /// 代码生成模式 - 创建新代码
    Code,
    /// 调试模式 - 查找和修复问题
    Debug,
    /// 重构模式 - 改进代码结构
    Refactor,
}

/// Agent 配置
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// 最大对话轮数
    pub max_turns: u32,
    /// 每次请求的最大 token 数
    pub max_tokens: u32,
    /// 是否保存对话历史
    pub save_history: bool,
    /// 是否自动配置权限
    pub auto_permissions: bool,
    /// Agent 工作模式（headless/interactive）
    pub sdk_mode: String,
}

/// 编程任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingTask {
    /// 任务提示
    pub prompt: String,
    /// 相关文件列表
    pub files: Vec<String>,
    /// 是否详细输出
    pub verbose: bool,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_turns: 10,
            max_tokens: 8192,
            save_history: true,
            auto_permissions: true,
            sdk_mode: "headless".to_string(),
        }
    }
}

impl AgentSdkCodingAgent {
    /// 创建新的 Agent
    pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            wrapper: AgentSdkWrapper::new()?,
            workspace,
            mode: AgentMode::Analysis,
            config: AgentConfig::default(),
        })
    }

    /// 使用自定义配置创建
    pub fn with_config(
        workspace: String,
        config: AgentConfig,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            wrapper: AgentSdkWrapper::new()?,
            workspace,
            mode: AgentMode::Analysis,
            config,
        })
    }

    /// 设置工作模式
    pub fn set_mode(&mut self, mode: AgentMode) {
        self.mode = mode;
    }

    /// 设置配置
    pub fn set_config(&mut self, config: AgentConfig) {
        self.config = config;
    }

    /// 执行编程任务
    pub async fn execute(
        &self,
        task: CodingTask,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let request = AgentSdkRequest {
            action: self.get_action_string(),
            prompt: task.prompt,
            workspace: self.workspace.clone(),
            files: task.files,
            allowed_tools: self.get_allowed_tools(),
            permissions: self.get_permissions(),
            max_turns: self.config.max_turns,
            save_history: self.config.save_history,
            claude_md_content: self.generate_claude_md(),
            max_tokens: Some(self.config.max_tokens),
            mode: Some(self.config.sdk_mode.clone()),
        };

        self.wrapper.execute(request).await
    }

    /// 简单的代码分析
    pub async fn analyze(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files: vec![],
            verbose: false,
        };

        let response = self.execute(task).await?;
        Ok(response.content)
    }

    /// 分析指定文件
    pub async fn analyze_files(
        &self,
        prompt: String,
        files: Vec<String>,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files,
            verbose: true,
        };

        self.execute(task).await
    }

    /// 生成代码
    pub async fn generate_code(
        &self,
        prompt: String,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files: vec![],
            verbose: true,
        };

        self.execute(task).await
    }

    /// 编辑代码
    pub async fn edit_code(
        &self,
        prompt: String,
        files: Vec<String>,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files,
            verbose: true,
        };

        self.execute(task).await
    }

    /// 调试代码
    pub async fn debug(
        &self,
        prompt: String,
        files: Vec<String>,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files,
            verbose: true,
        };

        self.execute(task).await
    }

    /// 重构代码
    pub async fn refactor(
        &self,
        prompt: String,
        files: Vec<String>,
    ) -> Result<AgentSdkResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files,
            verbose: true,
        };

        self.execute(task).await
    }

    fn get_action_string(&self) -> String {
        match self.mode {
            AgentMode::Analysis => "analyze",
            AgentMode::Edit => "edit",
            AgentMode::Code => "code",
            AgentMode::Debug => "debug",
            AgentMode::Refactor => "refactor",
        }
        .to_string()
    }

    fn get_allowed_tools(&self) -> Vec<String> {
        match self.mode {
            AgentMode::Analysis => vec!["Read".to_string()],
            AgentMode::Edit => vec!["Read".to_string(), "Write".to_string(), "Edit".to_string()],
            AgentMode::Code => vec!["Read".to_string(), "Write".to_string()],
            AgentMode::Debug => vec!["Read".to_string(), "Bash".to_string()],
            AgentMode::Refactor => {
                vec!["Read".to_string(), "Edit".to_string(), "Write".to_string()]
            }
        }
    }

    fn get_permissions(&self) -> PermissionConfig {
        if !self.config.auto_permissions {
            return PermissionConfig::default();
        }

        let workspace_pattern = format!("{}/*", self.workspace);

        match self.mode {
            AgentMode::Analysis => PermissionConfig {
                allow_all: false,
                allow_patterns: vec!["Read(*)".to_string()],
                deny_patterns: vec![],
            },
            AgentMode::Edit | AgentMode::Code | AgentMode::Refactor => PermissionConfig {
                allow_all: false,
                allow_patterns: vec![
                    "Read(*)".to_string(),
                    format!("Write({})", workspace_pattern),
                    format!("Edit({})", workspace_pattern),
                ],
                deny_patterns: vec![
                    "Write(/etc/*)".to_string(),
                    "Write(/sys/*)".to_string(),
                    "Write(/usr/*)".to_string(),
                    "Write(/bin/*)".to_string(),
                ],
            },
            AgentMode::Debug => PermissionConfig {
                allow_all: false,
                allow_patterns: vec![
                    "Read(*)".to_string(),
                    "Bash(cargo *)".to_string(),
                    "Bash(npm *)".to_string(),
                    "Bash(yarn *)".to_string(),
                    "Bash(git *)".to_string(),
                    "Bash(cat *)".to_string(),
                    "Bash(ls *)".to_string(),
                ],
                deny_patterns: vec![
                    "Bash(rm -rf)".to_string(),
                    "Bash(sudo *)".to_string(),
                    "Bash(chmod *)".to_string(),
                ],
            },
        }
    }

    fn generate_claude_md(&self) -> Option<String> {
        // 检查是否已存在 CLAUDE.md
        let claude_md_path = Path::new(&self.workspace).join("CLAUDE.md");
        if claude_md_path.exists() {
            return None; // 使用现有文件
        }

        // 生成默认的 CLAUDE.md（基于 Agent SDK 理念）
        Some(format!(
            r#"# 项目信息
- 项目路径: {}
- 工作模式: {:?}
- Agent SDK: @anthropic-ai/claude-agent-sdk

# 代码规范
- 使用一致的命名约定
- 添加清晰的注释和文档
- 遵循项目的编码风格指南
- 编写单元测试和集成测试

# Agent 工作原则（Claude Agent SDK）
1. **收集上下文** - 充分理解环境和任务
   - 阅读相关文件和文档
   - 分析项目结构和依赖
   - 理解业务逻辑和需求

2. **执行操作** - 系统性地完成任务
   - 分解复杂任务为小步骤
   - 逐步实施解决方案
   - 记录决策过程和理由

3. **验证工作** - 确保质量和正确性
   - 检查语法和逻辑错误
   - 运行测试验证功能
   - 遵循最佳实践

4. **迭代改进** - 持续优化
   - 根据反馈调整方案
   - 完善实现细节
   - 确保任务完整完成

# 安全要求
- 文件操作限制在项目目录内
- 谨慎执行系统命令，避免破坏性操作
- 不修改系统文件（/etc、/sys、/usr）
- 验证所有用户输入

# 最佳实践
- 在修改前先充分理解代码
- 保持代码简洁、清晰和可读
- 遵循 DRY（Don't Repeat Yourself）原则
- 编写自文档化的代码
- 添加适当的错误处理
- 考虑边界情况和异常情况

# 工具使用指南
- **Read** - 理解现有代码和结构
- **Write** - 创建新文件或完全重写文件
- **Edit** - 精确修改文件的特定部分
- **Bash** - 运行测试、编译、检查等命令
"#,
            self.workspace, self.mode
        ))
    }

    /// 获取当前配置
    pub fn config(&self) -> &AgentConfig {
        &self.config
    }

    /// 获取当前模式
    pub fn mode(&self) -> &AgentMode {
        &self.mode
    }

    /// 获取工作空间
    pub fn workspace(&self) -> &str {
        &self.workspace
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_agent_sdk_analyze() {
        dotenv::dotenv().ok();

        let workspace = std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let mut agent = AgentSdkCodingAgent::new(workspace).unwrap();
        agent.set_mode(AgentMode::Analysis);

        let result = agent
            .analyze("分析 src/main.rs 的主要功能和架构".to_string())
            .await;

        match result {
            Ok(content) => {
                println!("✅ 分析结果:\n{}", content);
                assert!(!content.is_empty());
            }
            Err(e) => {
                eprintln!("❌ 测试失败: {}", e);
                panic!("Test failed");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_agent_sdk_generate() {
        dotenv::dotenv().ok();

        let workspace = "/tmp/agent_sdk_test".to_string();
        std::fs::create_dir_all(&workspace).unwrap();

        let mut agent = AgentSdkCodingAgent::new(workspace.clone()).unwrap();
        agent.set_mode(AgentMode::Code);

        let result = agent
            .generate_code(
                "创建一个 hello.rs 文件，包含一个打印 Hello, World! 的 main 函数".to_string(),
            )
            .await;

        match result {
            Ok(response) => {
                println!("✅ 生成结果:");
                println!("   内容: {}", response.content);
                println!("   修改的文件: {:?}", response.files_modified);
                println!("   Agent 信息: {:?}", response.agent_info);
                assert!(response.success);
            }
            Err(e) => {
                eprintln!("❌ 测试失败: {}", e);
                panic!("Test failed");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_agent_sdk_debug() {
        dotenv::dotenv().ok();

        let workspace = std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let mut agent = AgentSdkCodingAgent::new(workspace).unwrap();
        agent.set_mode(AgentMode::Debug);

        let result = agent
            .debug(
                "检查项目是否能成功编译，如果有错误请列出".to_string(),
                vec!["Cargo.toml".to_string()],
            )
            .await;

        match result {
            Ok(response) => {
                println!("✅ 调试结果:");
                println!("   内容: {}", response.content);
                println!("   执行的命令: {:?}", response.commands_executed);
                println!("   Token 使用: {}", response.agent_info.total_tokens);
            }
            Err(e) => {
                eprintln!("❌ 测试失败: {}", e);
            }
        }
    }
}
