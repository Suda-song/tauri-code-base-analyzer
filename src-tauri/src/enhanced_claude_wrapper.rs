use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Serialize)]
pub struct EnhancedClaudeRequest {
    pub action: String,
    pub prompt: String,
    pub workspace: String,
    pub files: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub permissions: PermissionConfig,
    pub max_turns: u32,
    pub save_history: bool,
    pub claude_md_content: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PermissionConfig {
    pub allow_all: bool,
    pub allow_patterns: Vec<String>,
    pub deny_patterns: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnhancedClaudeResponse {
    pub success: bool,
    pub content: String,
    pub code_changes: Vec<CodeChange>,
    pub tool_uses: Vec<ToolUse>,
    pub files_modified: Vec<String>,
    pub commands_executed: Vec<String>,
    pub conversation_id: String,
    pub turn_count: u32,
    pub is_complete: bool,
    pub error: Option<String>,
    pub warnings: Vec<String>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CodeChange {
    pub file_path: String,
    pub change_type: String,
    pub diff: String,
    pub language: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ToolUse {
    pub tool: String,
    pub action: String,
    pub target: String,
    pub result: String,
    pub success: bool,
}

pub struct EnhancedClaudeWrapper {
    bridge_script: PathBuf,
}

impl EnhancedClaudeWrapper {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let project_root = std::env::current_dir()?;
        let bridge_script = project_root
            .join("scripts")
            .join("dist")
            .join("enhanced-claude-bridge.js");

        if !bridge_script.exists() {
            return Err(format!(
                "Enhanced Claude bridge script not found at {:?}.\n\
                请先运行: cd scripts && npm install && npm run build:enhanced",
                bridge_script
            )
            .into());
        }

        Ok(Self { bridge_script })
    }

    pub async fn execute(
        &self,
        request: EnhancedClaudeRequest,
    ) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>> {
        let request_json = serde_json::to_string(&request)?;

        println!("🚀 启动增强型 Claude Agent...");
        println!("   模式: {}", request.action);
        println!("   工作空间: {}", request.workspace);
        println!("   工具: {:?}", request.allowed_tools);

        // 启动 Node.js 进程
        let mut child = Command::new("node")
            .arg(&self.bridge_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // 写入请求
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(request_json.as_bytes())?;
            stdin.flush()?;
            drop(stdin);
        }

        // 等待响应
        let output = child.wait_with_output()?;

        // 打印 stderr（日志）
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() {
            eprintln!("{}", stderr);
        }

        if !output.status.success() {
            return Err(format!("Bridge process failed: {}", stderr).into());
        }

        let stdout = String::from_utf8(output.stdout)?;
        let response: EnhancedClaudeResponse = serde_json::from_str(&stdout)?;

        if response.success {
            println!("✅ 任务完成!");
            println!("   修改的文件: {}", response.files_modified.len());
            println!("   代码变更: {}", response.code_changes.len());
            println!("   工具调用: {}", response.tool_uses.len());
        } else {
            eprintln!("❌ 任务失败: {:?}", response.error);
        }

        Ok(response)
    }
}

impl Default for PermissionConfig {
    fn default() -> Self {
        Self {
            allow_all: false,
            allow_patterns: vec!["Read(*)".to_string()],
            deny_patterns: vec![
                "Bash(rm -rf)".to_string(),
                "Write(/etc/*)".to_string(),
                "Write(/sys/*)".to_string(),
            ],
        }
    }
}
