use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// Real Agent SDK 请求（真正使用官方 @anthropic-ai/claude-agent-sdk）
#[derive(Debug, Serialize)]
pub struct RealAgentSdkRequest {
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
    pub mode: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PermissionConfig {
    pub allow_all: bool,
    pub allow_patterns: Vec<String>,
    pub deny_patterns: Vec<String>,
}

/// Real Agent SDK 响应
#[derive(Debug, Deserialize)]
pub struct RealAgentSdkResponse {
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
    pub agent_info: RealAgentInfo,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RealAgentInfo {
    pub sdk_version: String,
    pub model: String,
    pub total_tokens: u32,
    pub total_cost_usd: f64,
    pub thinking_enabled: bool,
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

/// Real Claude Agent SDK Wrapper
///
/// 真正使用官方 @anthropic-ai/claude-agent-sdk@0.1.5 的 Rust 包装器
pub struct RealAgentSdkWrapper {
    bridge_script: PathBuf,
}

impl RealAgentSdkWrapper {
    /// 创建新的 Real Agent SDK Wrapper
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // 获取项目根目录
        let current = std::env::current_dir()?;

        // 尝试多个可能的路径
        let mut possible_paths = vec![
            current
                .join("scripts")
                .join("dist")
                .join("real-agent-sdk-bridge.js"),
            current
                .join("..")
                .join("scripts")
                .join("dist")
                .join("real-agent-sdk-bridge.js"),
        ];

        if let Some(parent) = current.parent() {
            possible_paths.push(
                parent
                    .join("scripts")
                    .join("dist")
                    .join("real-agent-sdk-bridge.js"),
            );
        }

        let bridge_script = possible_paths
            .into_iter()
            .find(|p| p.exists())
            .ok_or_else(|| {
                format!(
                    "Real Agent SDK bridge script not found.\n\
                    当前目录: {:?}\n\
                    请先运行: cd scripts && pnpm install && pnpm run build:real-agent\n\n\
                    这个 bridge 使用的是官方 @anthropic-ai/claude-agent-sdk@0.1.5",
                    current
                )
            })?;

        Ok(Self { bridge_script })
    }

    /// 执行 Agent 任务（真正调用 Claude Agent SDK）
    pub async fn execute(
        &self,
        request: RealAgentSdkRequest,
    ) -> Result<RealAgentSdkResponse, Box<dyn std::error::Error>> {
        let request_json = serde_json::to_string(&request)?;

        println!("🤖 Real Claude Agent SDK 启动");
        println!("   SDK 版本: @anthropic-ai/claude-agent-sdk@0.1.5");
        println!("   模式: {}", request.action);
        println!("   工作空间: {}", request.workspace);
        println!("   工具: {:?}", request.allowed_tools);
        println!("   最大轮数: {}", request.max_turns);

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
            return Err(format!("Real Agent SDK bridge process failed: {}", stderr).into());
        }

        let stdout = String::from_utf8(output.stdout)?;
        let response: RealAgentSdkResponse = serde_json::from_str(&stdout)?;

        if response.success {
            println!("\n✅ Real Agent SDK 任务完成!");
            println!("   对话 ID: {}", response.conversation_id);
            println!("   轮数: {}", response.turn_count);
            println!("   修改的文件: {}", response.files_modified.len());
            println!("   代码变更: {}", response.code_changes.len());
            println!("   工具调用: {}", response.tool_uses.len());
            println!("   Token 使用: {}", response.agent_info.total_tokens);
            println!("   成本: ${:.4}", response.agent_info.total_cost_usd);
            println!("   模型: {}", response.agent_info.model);

            if !response.warnings.is_empty() {
                println!("\n⚠️  警告:");
                for warning in &response.warnings {
                    println!("   - {}", warning);
                }
            }

            if !response.suggestions.is_empty() {
                println!("\n💡 建议:");
                for suggestion in &response.suggestions {
                    println!("   - {}", suggestion);
                }
            }
        } else {
            eprintln!("\n❌ Real Agent SDK 任务失败: {:?}", response.error);
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
                "Bash(sudo *)".to_string(),
                "Write(/etc/*)".to_string(),
                "Write(/sys/*)".to_string(),
                "Write(/usr/*)".to_string(),
            ],
        }
    }
}

impl Default for RealAgentSdkWrapper {
    fn default() -> Self {
        Self::new().expect("Failed to create RealAgentSdkWrapper")
    }
}
