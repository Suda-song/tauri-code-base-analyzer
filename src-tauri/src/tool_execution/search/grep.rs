use async_trait::async_trait;
use regex::Regex;
use serde_json::{json, Value as JsonValue};
use std::fs;
use std::path::{Path, PathBuf};
use crate::tool_execution::tool_trait::{AgentTool, ToolResult};

/// Grep 搜索工具
pub struct GrepTool {
    /// 搜索根目录
    base_dir: PathBuf,
    /// 最大搜索结果数
    max_results: usize,
}

impl GrepTool {
    /// 创建新的 Grep 工具
    pub fn new(base_dir: String) -> Self {
        Self {
            base_dir: PathBuf::from(base_dir),
            max_results: 1000,
        }
    }

    /// 设置最大结果数
    pub fn with_max_results(mut self, max_results: usize) -> Self {
        self.max_results = max_results;
        self
    }

    /// 递归搜索文件内容
    fn search_in_directory(
        &self,
        dir: &Path,
        pattern: &Regex,
        file_pattern: Option<&Regex>,
        case_sensitive: bool,
        results: &mut Vec<SearchResult>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if results.len() >= self.max_results {
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            // 跳过隐藏文件和特定目录
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') 
                    || name_str == "node_modules" 
                    || name_str == "target" 
                    || name_str == ".git" {
                    continue;
                }
            }

            if path.is_dir() {
                self.search_in_directory(&path, pattern, file_pattern, case_sensitive, results)?;
            } else if path.is_file() {
                // 检查文件名是否匹配
                if let Some(file_pat) = file_pattern {
                    let file_name = path.file_name().unwrap().to_string_lossy();
                    if !file_pat.is_match(&file_name) {
                        continue;
                    }
                }

                // 搜索文件内容
                if let Ok(content) = fs::read_to_string(&path) {
                    for (line_num, line) in content.lines().enumerate() {
                        if results.len() >= self.max_results {
                            return Ok(());
                        }

                        let matches = if case_sensitive {
                            pattern.is_match(line)
                        } else {
                            pattern.is_match(&line.to_lowercase())
                        };

                        if matches {
                            results.push(SearchResult {
                                file: path.strip_prefix(&self.base_dir)
                                    .unwrap_or(&path)
                                    .to_string_lossy()
                                    .to_string(),
                                line_number: line_num + 1,
                                line_content: line.to_string(),
                            });
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug)]
struct SearchResult {
    file: String,
    line_number: usize,
    line_content: String,
}

#[async_trait]
impl AgentTool for GrepTool {
    fn name(&self) -> &str {
        "grep"
    }

    fn description(&self) -> &str {
        "在文件中搜索匹配的文本内容。支持正则表达式和文件名过滤。"
    }

    fn parameters_schema(&self) -> JsonValue {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "搜索模式（支持正则表达式）"
                },
                "file_pattern": {
                    "type": "string",
                    "description": "文件名过滤模式（可选，支持正则表达式）"
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "是否区分大小写（默认 false）"
                },
                "path": {
                    "type": "string",
                    "description": "搜索路径（相对于工作目录，默认为当前目录）"
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>> {
        let pattern_str = input["pattern"].as_str().ok_or("缺少 'pattern' 参数")?;
        let case_sensitive = input["case_sensitive"].as_bool().unwrap_or(false);
        
        // 构建搜索正则
        let pattern = if case_sensitive {
            Regex::new(pattern_str)?
        } else {
            Regex::new(&format!("(?i){}", pattern_str))?
        };

        // 文件名过滤
        let file_pattern = if let Some(file_pat) = input["file_pattern"].as_str() {
            Some(Regex::new(file_pat)?)
        } else {
            None
        };

        // 搜索路径
        let search_path = if let Some(path) = input["path"].as_str() {
            self.base_dir.join(path)
        } else {
            self.base_dir.clone()
        };

        if !search_path.exists() {
            return Ok(ToolResult::failure(format!("路径不存在: {:?}", search_path)));
        }

        // 执行搜索
        let mut results = Vec::new();
        self.search_in_directory(&search_path, &pattern, file_pattern.as_ref(), case_sensitive, &mut results)?;

        // 格式化输出
        let output = if results.is_empty() {
            "未找到匹配结果".to_string()
        } else {
            results.iter()
                .map(|r| format!("{}:{}:{}", r.file, r.line_number, r.line_content.trim()))
                .collect::<Vec<_>>()
                .join("\n")
        };

        Ok(ToolResult::success(output).with_metadata(json!({
            "total_matches": results.len(),
            "truncated": results.len() >= self.max_results,
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
    async fn test_grep_tool() {
        let tool = GrepTool::new(".".to_string());
        let input = json!({
            "pattern": "fn main",
            "file_pattern": ".*\\.rs$",
            "case_sensitive": true
        });

        let result = tool.execute(input).await.unwrap();
        println!("Search results: {}", result.output);
        // 结果依赖于实际文件系统，这里只检查不会出错
    }
}
