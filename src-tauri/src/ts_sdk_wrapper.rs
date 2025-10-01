use std::process::{Command, Stdio};
use std::io::Write;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize)]
struct SDKRequest {
    action: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "systemPrompt")]
    system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct SDKResponse {
    success: bool,
    content: Option<String>,
    #[serde(rename = "toolUses")]
    tool_uses: Option<Vec<ToolUse>>,
    error: Option<String>,
    #[serde(rename = "stopReason")]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ToolUse {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
}

/// TypeScript SDK 包装器
pub struct TypeScriptSDKWrapper {
    bridge_script: PathBuf,
}

impl TypeScriptSDKWrapper {
    /// 创建新的 SDK 包装器
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // 获取项目根目录
        let project_root = std::env::current_dir()?;
        let bridge_script = project_root
            .join("scripts")
            .join("dist")
            .join("claude-bridge.js");

        if !bridge_script.exists() {
            return Err(format!(
                "Bridge script not found at {:?}.\n\n请先运行: cd scripts && npm install && npm run build",
                bridge_script
            ).into());
        }

        Ok(Self { bridge_script })
    }

    /// 简单查询
    pub async fn query(
        &self,
        prompt: String,
        system_prompt: Option<String>,
        max_tokens: Option<u32>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let request = SDKRequest {
            action: "query".to_string(),
            prompt,
            system_prompt,
            max_tokens,
            tools: None,
        };

        let response = self.call_bridge(request).await?;
        
        if !response.success {
            return Err(response.error.unwrap_or("Unknown error".to_string()).into());
        }

        Ok(response.content.unwrap_or_default())
    }

    /// 带工具的查询
    pub async fn query_with_tools(
        &self,
        prompt: String,
        system_prompt: Option<String>,
        max_tokens: Option<u32>,
        tools: Vec<ToolDefinition>,
    ) -> Result<(String, Vec<ToolUse>), Box<dyn std::error::Error>> {
        let request = SDKRequest {
            action: "query_with_tools".to_string(),
            prompt,
            system_prompt,
            max_tokens,
            tools: Some(tools),
        };

        let response = self.call_bridge(request).await?;
        
        if !response.success {
            return Err(response.error.unwrap_or("Unknown error".to_string()).into());
        }

        Ok((
            response.content.unwrap_or_default(),
            response.tool_uses.unwrap_or_default(),
        ))
    }

    /// 调用 Node.js 桥接脚本
    async fn call_bridge(
        &self,
        request: SDKRequest,
    ) -> Result<SDKResponse, Box<dyn std::error::Error>> {
        let request_json = serde_json::to_string(&request)?;

        // 启动 Node.js 进程
        let mut child = Command::new("node")
            .arg(&self.bridge_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // 写入请求到 stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(request_json.as_bytes())?;
            stdin.flush()?;
            drop(stdin); // 关闭 stdin，让 Node.js 知道输入结束
        }

        // 等待并读取输出
        let output = child.wait_with_output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "Node.js process failed:\nstdout: {}\nstderr: {}",
                stdout, stderr
            ).into());
        }

        let stdout = String::from_utf8(output.stdout)?;
        let response: SDKResponse = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse response: {}. Output: {}", e, stdout))?;

        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要 API Key 和构建的 bridge
    async fn test_simple_query() {
        let wrapper = TypeScriptSDKWrapper::new().unwrap();
        let response = wrapper.query(
            "用一句话介绍 Rust".to_string(),
            None,
            Some(100),
        ).await.unwrap();

        println!("Response: {}", response);
        assert!(!response.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_with_tools() {
        let wrapper = TypeScriptSDKWrapper::new().unwrap();
        
        let tools = vec![
            ToolDefinition {
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

        let (content, tool_uses) = wrapper.query_with_tools(
            "1 + 1 等于多少？请使用计算器工具".to_string(),
            None,
            Some(1024),
            tools,
        ).await.unwrap();

        println!("Content: {}", content);
        println!("Tool uses: {:?}", tool_uses);
    }
}
