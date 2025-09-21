use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntity {
    pub id: String,
    pub file_path: String,
    pub description: String,
    pub summary: String,
    pub imports: Vec<String>,
    pub calls: Vec<String>,
    pub exports: Vec<String>,
    pub file_type: String,
    pub size: u64,
    pub lines_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub entities: Vec<FileEntity>,
    pub total_files: usize,
    pub total_size: u64,
    pub analysis_timestamp: String,
}

pub struct CodeAnalyzer {
    import_regex: Regex,
    export_regex: Regex,
    function_call_regex: Regex,
    comment_regex: Regex,
}

impl CodeAnalyzer {
    pub fn new() -> Self {
        Self {
            // 匹配各种 import 语句
            import_regex: Regex::new(r#"(?:import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"`]([^'"`]+)['"`]|import\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))"#).unwrap(),
            // 匹配 export 语句
            export_regex: Regex::new(r#"export\s+(?:default\s+)?(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+)|\{([^}]+)\})"#).unwrap(),
            // 匹配函数调用
            function_call_regex: Regex::new(r#"(\w+)\s*\("#).unwrap(),
            // 匹配注释
            comment_regex: Regex::new(r#"(?://.*?$|/\*.*?\*/)"#).unwrap(),
        }
    }

    pub fn analyze_directory(&self, dir_path: &str) -> Result<AnalysisResult, Box<dyn std::error::Error>> {
        let mut entities = Vec::new();
        let mut total_size = 0u64;
        let mut file_count = 0usize;

        for entry in WalkDir::new(dir_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();

                    // 只分析前端相关文件
                    if self.is_frontend_file(&ext_str) {
                        match self.analyze_file(path) {
                            Ok(entity) => {
                                total_size += entity.size;
                                file_count += 1;
                                entities.push(entity);
                            }
                            Err(e) => {
                                eprintln!("Error analyzing file {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }

        Ok(AnalysisResult {
            entities,
            total_files: file_count,
            total_size,
            analysis_timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn is_frontend_file(&self, extension: &str) -> bool {
        matches!(
            extension,
            "js" | "jsx" | "ts" | "tsx" | "vue" | "svelte" | "json" | "css" | "scss" | "less" | "html" | "md"
        )
    }

    fn analyze_file(&self, file_path: &Path) -> Result<FileEntity, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let metadata = fs::metadata(file_path)?;

        let file_name = file_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_path_str = file_path.to_string_lossy().to_string();

        // 生成唯一ID
        let id = format!("{}_{}",
            file_path_str.replace(['/', '\\', '.'], "_"),
            metadata.len()
        );

        // 提取imports
        let imports = self.extract_imports(&content);

        // 提取exports
        let exports = self.extract_exports(&content);

        // 提取函数调用
        let calls = self.extract_function_calls(&content);

        // 生成描述和摘要
        let description = self.generate_description(&file_name, &content);
        let summary = self.generate_summary(&content, &imports, &exports, &calls);

        // 计算行数
        let lines_count = content.lines().count();

        // 获取文件类型
        let file_type = file_path.extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        Ok(FileEntity {
            id,
            file_path: file_path_str,
            description,
            summary,
            imports,
            calls,
            exports,
            file_type,
            size: metadata.len(),
            lines_count,
        })
    }

    fn extract_imports(&self, content: &str) -> Vec<String> {
        let mut imports = Vec::new();

        for caps in self.import_regex.captures_iter(content) {
            if let Some(import_path) = caps.get(1).or_else(|| caps.get(2)).or_else(|| caps.get(3)) {
                imports.push(import_path.as_str().to_string());
            }
        }

        imports.sort();
        imports.dedup();
        imports
    }

    fn extract_exports(&self, content: &str) -> Vec<String> {
        let mut exports = Vec::new();

        for caps in self.export_regex.captures_iter(content) {
            for i in 1..=6 {
                if let Some(export_name) = caps.get(i) {
                    let name = export_name.as_str();
                    if i == 6 {
                        // 处理 export { a, b, c } 的情况
                        for item in name.split(',') {
                            let cleaned = item.trim().split_whitespace().next().unwrap_or("");
                            if !cleaned.is_empty() {
                                exports.push(cleaned.to_string());
                            }
                        }
                    } else {
                        exports.push(name.to_string());
                    }
                    break;
                }
            }
        }

        exports.sort();
        exports.dedup();
        exports
    }

    fn extract_function_calls(&self, content: &str) -> Vec<String> {
        let mut calls = Vec::new();

        // 移除注释
        let content_without_comments = self.comment_regex.replace_all(content, "");

        for caps in self.function_call_regex.captures_iter(&content_without_comments) {
            if let Some(function_name) = caps.get(1) {
                let name = function_name.as_str();
                // 过滤掉一些常见的关键字
                if !matches!(name, "if" | "for" | "while" | "switch" | "catch" | "typeof" | "instanceof") {
                    calls.push(name.to_string());
                }
            }
        }

        calls.sort();
        calls.dedup();
        calls
    }

    fn generate_description(&self, file_name: &str, content: &str) -> String {
        let lines: Vec<&str> = content.lines().take(10).collect();

        // 查找第一个有意义的注释
        for line in &lines {
            let trimmed = line.trim();
            if trimmed.starts_with("//") || trimmed.starts_with("/*") {
                let comment = trimmed
                    .trim_start_matches("//")
                    .trim_start_matches("/*")
                    .trim_end_matches("*/")
                    .trim();
                if comment.len() > 10 {
                    return comment.to_string();
                }
            }
        }

        // 根据文件名和内容生成描述
        if file_name.contains("component") || content.contains("React.Component") || content.contains("function Component") {
            "React component file".to_string()
        } else if file_name.contains("hook") || content.contains("useState") || content.contains("useEffect") {
            "React hook file".to_string()
        } else if file_name.contains("util") || file_name.contains("helper") {
            "Utility/helper functions".to_string()
        } else if file_name.contains("api") || content.contains("fetch") || content.contains("axios") {
            "API related file".to_string()
        } else if file_name.contains("type") || content.contains("interface") || content.contains("type ") {
            "Type definitions file".to_string()
        } else {
            format!("Frontend file: {}", file_name)
        }
    }

    fn generate_summary(&self, content: &str, imports: &[String], exports: &[String], calls: &[String]) -> String {
        let lines_count = content.lines().count();

        format!(
            "File contains {} lines of code. Imports {} modules: {}. Exports: {}. Main function calls: {}.",
            lines_count,
            imports.len(),
            if imports.is_empty() { "none".to_string() } else { imports.join(", ") },
            if exports.is_empty() { "none".to_string() } else { exports.join(", ") },
            if calls.is_empty() { "none".to_string() } else { calls.iter().take(5).cloned().collect::<Vec<_>>().join(", ") }
        )
    }
}

// 添加 chrono 依赖需要更新 Cargo.toml