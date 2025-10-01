use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use std::fs;
use std::path::{Path, PathBuf};
use crate::tool_execution::tool_trait::{AgentTool, ToolResult};

/// 文件操作类型
#[derive(Debug)]
enum FileOperation {
    Read,
    Write,
    List,
    Delete,
}

/// 文件操作工具
pub struct FileOpsTool {
    /// 工作目录（限制操作范围）
    base_dir: PathBuf,
}

impl FileOpsTool {
    /// 创建新的文件操作工具
    pub fn new(base_dir: String) -> Self {
        Self {
            base_dir: PathBuf::from(base_dir),
        }
    }

    /// 验证路径是否在允许的范围内
    fn validate_path(&self, path: &str) -> Result<PathBuf, String> {
        let full_path = self.base_dir.join(path);
        
        // 规范化路径并检查是否在 base_dir 内
        let canonical_base = self.base_dir.canonicalize()
            .map_err(|e| format!("无法规范化基础目录: {}", e))?;
        
        let canonical_path = if full_path.exists() {
            full_path.canonicalize()
                .map_err(|e| format!("无法规范化路径: {}", e))?
        } else {
            // 对于不存在的路径，验证其父目录
            let parent = full_path.parent().ok_or("无效的路径")?;
            let canonical_parent = parent.canonicalize()
                .map_err(|e| format!("无法规范化父目录: {}", e))?;
            canonical_parent.join(full_path.file_name().ok_or("无效的文件名")?)
        };

        if !canonical_path.starts_with(&canonical_base) {
            return Err(format!("路径超出允许范围: {:?}", path));
        }

        Ok(canonical_path)
    }
}

#[async_trait]
impl AgentTool for FileOpsTool {
    fn name(&self) -> &str {
        "file_operations"
    }

    fn description(&self) -> &str {
        "文件操作工具，支持读取、写入、列出和删除文件"
    }

    fn parameters_schema(&self) -> JsonValue {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["read", "write", "list", "delete"],
                    "description": "操作类型"
                },
                "path": {
                    "type": "string",
                    "description": "文件或目录路径（相对于工作目录）"
                },
                "content": {
                    "type": "string",
                    "description": "写入的内容（仅用于 write 操作）"
                }
            },
            "required": ["operation", "path"]
        })
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>> {
        let operation = input["operation"].as_str().ok_or("缺少 'operation' 参数")?;
        let path = input["path"].as_str().ok_or("缺少 'path' 参数")?;

        let validated_path = match self.validate_path(path) {
            Ok(p) => p,
            Err(e) => return Ok(ToolResult::failure(e)),
        };

        match operation {
            "read" => self.read_file(&validated_path),
            "write" => {
                let content = input["content"].as_str().ok_or("缺少 'content' 参数")?;
                self.write_file(&validated_path, content)
            }
            "list" => self.list_directory(&validated_path),
            "delete" => self.delete_file(&validated_path),
            _ => Ok(ToolResult::failure(format!("未知操作: {}", operation))),
        }
    }

    fn requires_ai(&self) -> bool {
        false
    }
}

impl FileOpsTool {
    /// 读取文件
    fn read_file(&self, path: &Path) -> Result<ToolResult, Box<dyn std::error::Error>> {
        if !path.exists() {
            return Ok(ToolResult::failure(format!("文件不存在: {:?}", path)));
        }

        if !path.is_file() {
            return Ok(ToolResult::failure(format!("路径不是文件: {:?}", path)));
        }

        let content = fs::read_to_string(path)?;
        let file_size = content.len();
        Ok(ToolResult::success(content).with_metadata(json!({
            "file_size": file_size,
            "path": path.display().to_string(),
        })))
    }

    /// 写入文件
    fn write_file(&self, path: &Path, content: &str) -> Result<ToolResult, Box<dyn std::error::Error>> {
        // 确保父目录存在
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(path, content)?;
        Ok(ToolResult::success(format!("文件写入成功: {:?}", path))
            .with_metadata(json!({
                "bytes_written": content.len(),
                "path": path.display().to_string(),
            })))
    }

    /// 列出目录内容
    fn list_directory(&self, path: &Path) -> Result<ToolResult, Box<dyn std::error::Error>> {
        if !path.exists() {
            return Ok(ToolResult::failure(format!("目录不存在: {:?}", path)));
        }

        if !path.is_dir() {
            return Ok(ToolResult::failure(format!("路径不是目录: {:?}", path)));
        }

        let entries = fs::read_dir(path)?
            .filter_map(|entry| entry.ok())
            .map(|entry| {
                let path = entry.path();
                let is_dir = path.is_dir();
                let name = entry.file_name().to_string_lossy().to_string();
                format!("{}{}", name, if is_dir { "/" } else { "" })
            })
            .collect::<Vec<_>>();

        let output = entries.join("\n");
        Ok(ToolResult::success(output).with_metadata(json!({
            "count": entries.len(),
            "path": path.display().to_string(),
        })))
    }

    /// 删除文件
    fn delete_file(&self, path: &Path) -> Result<ToolResult, Box<dyn std::error::Error>> {
        if !path.exists() {
            return Ok(ToolResult::failure(format!("文件不存在: {:?}", path)));
        }

        if path.is_file() {
            fs::remove_file(path)?;
            Ok(ToolResult::success(format!("文件删除成功: {:?}", path)))
        } else if path.is_dir() {
            fs::remove_dir_all(path)?;
            Ok(ToolResult::success(format!("目录删除成功: {:?}", path)))
        } else {
            Ok(ToolResult::failure(format!("无法删除: {:?}", path)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    async fn test_file_read_write() {
        let temp_dir = env::temp_dir();
        let tool = FileOpsTool::new(temp_dir.to_string_lossy().to_string());

        // 写入文件
        let write_input = json!({
            "operation": "write",
            "path": "test_file.txt",
            "content": "Hello, World!"
        });

        let write_result = tool.execute(write_input).await.unwrap();
        assert!(write_result.success);

        // 读取文件
        let read_input = json!({
            "operation": "read",
            "path": "test_file.txt"
        });

        let read_result = tool.execute(read_input).await.unwrap();
        assert!(read_result.success);
        assert_eq!(read_result.output, "Hello, World!");

        // 删除文件
        let delete_input = json!({
            "operation": "delete",
            "path": "test_file.txt"
        });

        let delete_result = tool.execute(delete_input).await.unwrap();
        assert!(delete_result.success);
    }
}
