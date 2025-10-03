use crate::enhanced_claude_wrapper::{
    EnhancedClaudeRequest, EnhancedClaudeResponse, EnhancedClaudeWrapper, PermissionConfig,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// 增强的 Coding Agent
///
/// 基于 Claude Code SDK 理念实现的完整 AI 编程助手
pub struct EnhancedCodingAgent {
    wrapper: EnhancedClaudeWrapper,
    workspace: String,
    mode: AgentMode,
    config: AgentConfig,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AgentMode {
    /// 代码分析模式 - 只读，理解代码
    Analysis,
    /// 代码编辑模式 - 修改现有代码
    Edit,
    /// 代码生成模式 - 创建新代码
    Generate,
    /// 调试模式 - 查找和修复问题
    Debug,
    /// 重构模式 - 改进代码结构
    Refactor,
}

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub max_turns: u32,
    pub max_tokens: u32,
    pub save_history: bool,
    pub auto_permissions: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingTask {
    pub prompt: String,
    pub files: Vec<String>,
    pub verbose: bool,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_turns: 10,
            max_tokens: 8192,
            save_history: true,
            auto_permissions: true,
        }
    }
}

impl EnhancedCodingAgent {
    /// 创建新的 Agent
    pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            wrapper: EnhancedClaudeWrapper::new()?,
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
            wrapper: EnhancedClaudeWrapper::new()?,
            workspace,
            mode: AgentMode::Analysis,
            config,
        })
    }

    /// 设置工作模式
    pub fn set_mode(&mut self, mode: AgentMode) {
        self.mode = mode;
    }

    /// 执行编程任务
    pub async fn execute(
        &self,
        task: CodingTask,
    ) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>> {
        let request = EnhancedClaudeRequest {
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

    /// 生成代码
    pub async fn generate(
        &self,
        prompt: String,
    ) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>> {
        let task = CodingTask {
            prompt,
            files: vec![],
            verbose: true,
        };

        self.execute(task).await
    }

    /// 调试代码
    pub async fn debug(
        &self,
        prompt: String,
        files: Vec<String>,
    ) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>> {
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
    ) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>> {
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
            AgentMode::Edit => "code",
            AgentMode::Generate => "code",
            AgentMode::Debug => "debug",
            AgentMode::Refactor => "refactor",
        }
        .to_string()
    }

    fn get_allowed_tools(&self) -> Vec<String> {
        match self.mode {
            AgentMode::Analysis => vec!["Read".to_string()],
            AgentMode::Edit => vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
            ],
            AgentMode::Generate => vec!["Read".to_string(), "Write".to_string()],
            AgentMode::Debug => vec!["Read".to_string(), "Bash".to_string()],
            AgentMode::Refactor => vec![
                "Read".to_string(),
                "Edit".to_string(),
                "Write".to_string(),
            ],
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
            AgentMode::Edit | AgentMode::Generate | AgentMode::Refactor => PermissionConfig {
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
                ],
            },
            AgentMode::Debug => PermissionConfig {
                allow_all: false,
                allow_patterns: vec![
                    "Read(*)".to_string(),
                    "Bash(cargo *)".to_string(),
                    "Bash(npm *)".to_string(),
                    "Bash(git *)".to_string(),
                ],
                deny_patterns: vec![
                    "Bash(rm -rf)".to_string(),
                    "Bash(sudo *)".to_string(),
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

        // 生成默认的 CLAUDE.md
        Some(format!(
            r#"# 项目信息
- 项目路径: {}
- 工作模式: {:?}

# 代码规范
- 使用一致的命名约定
- 添加清晰的注释
- 遵循项目的编码风格
- 编写单元测试

# 安全要求
- 文件操作限制在项目目录内
- 谨慎执行系统命令
- 不修改系统文件
- 验证所有输入

# 最佳实践
- 在修改前先理解代码
- 保持代码简洁和可读
- 遵循 DRY 原则
- 编写自文档化的代码
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
    async fn test_enhanced_agent_analyze() {
        dotenv::dotenv().ok();

        let workspace = std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let mut agent = EnhancedCodingAgent::new(workspace).unwrap();
        agent.set_mode(AgentMode::Analysis);

        let result = agent
            .analyze("分析 src/main.rs 的主要功能".to_string())
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
    async fn test_enhanced_agent_generate() {
        dotenv::dotenv().ok();

        let workspace = "/tmp/enhanced_agent_test".to_string();
        std::fs::create_dir_all(&workspace).unwrap();

        let mut agent = EnhancedCodingAgent::new(workspace).unwrap();
        agent.set_mode(AgentMode::Generate);

        let result = agent
            .generate("创建一个 hello.txt 文件，包含 Hello World".to_string())
            .await;

        match result {
            Ok(response) => {
                println!("✅ 生成结果:");
                println!("   内容: {}", response.content);
                println!("   修改的文件: {:?}", response.files_modified);
                assert!(response.success);
            }
            Err(e) => {
                eprintln!("❌ 测试失败: {}", e);
                panic!("Test failed");
            }
        }
    }
}

