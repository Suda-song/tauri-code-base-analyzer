use async_trait::async_trait;
use glob::glob;
use serde_json::{json, Value as JsonValue};
use std::path::PathBuf;
use crate::tool_execution::tool_trait::{AgentTool, ToolResult};

/// Glob 文件搜索工具
pub struct GlobTool {
    /// 搜索根目录
    base_dir: PathBuf,
}

impl GlobTool {
    /// 创建新的 Glob 工具
    pub fn new(base_dir: String) -> Self {
        Self {
            base_dir: PathBuf::from(base_dir),
        }
    }
}

#[async_trait]
impl AgentTool for GlobTool {
    fn name(&self) -> &str {
        "glob"
    }

    fn description(&self) -> &str {
        "使用 glob 模式搜索文件。支持通配符如 *, **, ?, [abc] 等。"
    }

    fn parameters_schema(&self) -> JsonValue {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob 模式，如 '**/*.rs' 查找所有 Rust 文件"
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>> {
        let pattern = input["pattern"].as_str().ok_or("缺少 'pattern' 参数")?;

        // 构建完整的 glob 模式
        let full_pattern = self.base_dir.join(pattern);
        let pattern_str = full_pattern.to_string_lossy();

        // 执行 glob 搜索
        let mut files = Vec::new();
        for entry in glob(&pattern_str)? {
            match entry {
                Ok(path) => {
                    // 转换为相对路径
                    let relative = path.strip_prefix(&self.base_dir)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();
                    files.push(relative);
                }
                Err(e) => eprintln!("Glob 错误: {}", e),
            }
        }

        let output = if files.is_empty() {
            "未找到匹配的文件".to_string()
        } else {
            files.join("\n")
        };

        Ok(ToolResult::success(output).with_metadata(json!({
            "count": files.len(),
            "pattern": pattern,
        })))
    }

    fn requires_ai(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_glob_tool() {
        let tool = GlobTool::new(".".to_string());
        let input = json!({
            "pattern": "**/*.rs"
        });

        let result = tool.execute(input).await.unwrap();
        println!("Found files:\n{}", result.output);
        assert!(result.success);
    }
}
