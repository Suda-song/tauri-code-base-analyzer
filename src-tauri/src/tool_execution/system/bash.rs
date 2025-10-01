use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use std::process::Command;
use crate::tool_execution::tool_trait::{AgentTool, ToolResult};

/// Bash 命令执行工具
pub struct BashTool {
    /// 工作目录
    cwd: String,
    /// 是否允许危险命令（rm, sudo 等）
    allow_dangerous: bool,
}

impl BashTool {
    /// 创建新的 Bash 工具
    pub fn new(cwd: String) -> Self {
        Self {
            cwd,
            allow_dangerous: false,
        }
    }

    /// 允许危险命令
    pub fn allow_dangerous(mut self) -> Self {
        self.allow_dangerous = true;
        self
    }

    /// 检查命令是否安全
    fn is_safe_command(&self, command: &str) -> bool {
        if self.allow_dangerous {
            return true;
        }

        let dangerous_patterns = [
            "rm -rf /",
            "sudo",
            "chmod -R",
            "chown -R",
            "> /dev/",
            "mkfs",
            "dd if=",
            ":(){ :|:& };:",  // fork bomb
        ];

        !dangerous_patterns.iter().any(|pattern| command.contains(pattern))
    }
}

#[async_trait]
impl AgentTool for BashTool {
    fn name(&self) -> &str {
        "bash"
    }

    fn description(&self) -> &str {
        "执行 Bash 命令。可以运行任何 shell 命令来完成系统操作。"
    }

    fn parameters_schema(&self) -> JsonValue {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的 Bash 命令"
                }
            },
            "required": ["command"]
        })
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>> {
        let command = input["command"]
            .as_str()
            .ok_or("缺少 'command' 参数")?;

        // 安全检查
        if !self.is_safe_command(command) {
            return Ok(ToolResult::failure(
                format!("命令被阻止：包含危险操作。命令: {}", command)
            ));
        }

        // 执行命令
        let output = Command::new("sh")
            .arg("-c")
            .arg(command)
            .current_dir(&self.cwd)
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let result = if output.status.success() {
            ToolResult::success(stdout).with_metadata(json!({
                "exit_code": output.status.code(),
                "stderr": stderr,
            }))
        } else {
            ToolResult::failure(format!(
                "命令执行失败 (退出码: {}):\nstdout: {}\nstderr: {}",
                output.status.code().unwrap_or(-1),
                stdout,
                stderr
            ))
        };

        Ok(result)
    }

    fn requires_ai(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bash_tool_success() {
        let tool = BashTool::new("/tmp".to_string());
        let input = json!({
            "command": "echo 'Hello, World!'"
        });

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);
        assert!(result.output.contains("Hello, World!"));
    }

    #[tokio::test]
    async fn test_bash_tool_dangerous_command() {
        let tool = BashTool::new("/tmp".to_string());
        let input = json!({
            "command": "sudo rm -rf /"
        });

        let result = tool.execute(input).await.unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("危险操作"));
    }
}
