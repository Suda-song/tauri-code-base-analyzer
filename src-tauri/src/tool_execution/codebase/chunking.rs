//! 代码分块增强模块
//!
//! 将 CodeEntity 转换为包含完整代码内容和上下文信息的 CodeChunk

use super::extractors::{CodeEntity, LocationInfo};
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

lazy_static! {
    // 导入语句正则
    static ref IMPORT_REGEX: Regex = Regex::new(
        r#"import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]"#
    ).unwrap();

    // 导出语句正则
    static ref EXPORT_REGEX: Regex = Regex::new(
        r"export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)"
    ).unwrap();

    // JSDoc 注释正则
    static ref JSDOC_REGEX: Regex = Regex::new(
        r"/\*\*([\s\S]*?)\*/"
    ).unwrap();

    // 单行注释正则
    static ref SINGLE_COMMENT_REGEX: Regex = Regex::new(
        r"//\s*(.+?)$"
    ).unwrap();
}

/// 增强的代码块（包含完整上下文）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    // ========== 基础信息（继承自 CodeEntity） ==========
    pub id: String,
    pub entity_type: String,
    pub file: String,
    pub raw_name: String,
    pub loc: LocationInfo,

    // ========== 代码内容 ==========
    /// 实际的代码文本
    pub code: String,

    /// 代码长度（字符数）
    pub code_length: usize,

    // ========== 上下文信息 ==========
    /// 导入的模块/库
    /// 例如: ["react", "@/utils/helpers", "./Button.css"]
    pub imports: Vec<String>,

    /// 导出的内容
    /// 例如: ["Button", "ButtonProps"]
    pub exports: Vec<String>,

    /// 注释内容（JSDoc、单行、多行）
    pub comments: Vec<String>,

    /// 依赖的其他实体 ID
    /// 例如: ["Component:Icon", "Function:validateProps"]
    pub dependencies: Vec<String>,

    // ========== 元数据 ==========
    /// 代码复杂度（简单估算：行数 + 缩进层级）
    pub complexity: u32,

    /// 是否为测试代码
    pub is_test: bool,

    /// 文件的相对路径（去除 workspace 前缀）
    pub relative_file: String,

    // ========== 用于 Embedding 的格式化文本 ==========
    /// 经过优化的文本，用于生成向量
    /// 包含结构化的元数据 + 代码
    pub embedding_text: String,
}

/// 分块统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkStats {
    pub total_chunks: usize,
    pub total_code_size: usize,
    pub avg_chunk_size: usize,
    pub by_type: HashMap<String, usize>, // 各类型数量统计
}

/// 代码块构建器
pub struct ChunkBuilder {
    workspace_root: String,
}

impl ChunkBuilder {
    /// 创建新的构建器
    pub fn new(workspace_root: String) -> Self {
        Self { workspace_root }
    }

    /// 从 CodeEntity 创建 CodeChunk
    pub fn build_chunk(&self, entity: CodeEntity) -> Result<CodeChunk, Box<dyn std::error::Error>> {
        // 1. 读取文件内容
        let full_path = Path::new(&self.workspace_root).join(&entity.file);
        let file_content = fs::read_to_string(&full_path)?;

        // 2. 提取指定行范围的代码
        let code = self.extract_code_from_lines(
            &file_content,
            entity.loc.start_line,
            entity.loc.end_line,
        )?;

        // 3. 分析上下文
        let imports = self.extract_imports(&code);
        let exports = self.extract_exports(&code);
        let comments = self.extract_comments(&code);

        // 4. 计算复杂度
        let complexity = self.calculate_complexity(&code);

        // 5. 判断是否为测试代码
        let is_test = self.is_test_file(&entity.file) || self.is_test_code(&code);

        // 6. 计算相对路径
        let relative_file = entity
            .file
            .strip_prefix(&self.workspace_root)
            .unwrap_or(&entity.file)
            .to_string();

        // 7. 生成 embedding 文本
        let embedding_text = self.format_for_embedding(
            &entity,
            &code,
            &imports,
            &exports,
            &comments,
            &relative_file,
        );

        Ok(CodeChunk {
            id: entity.id,
            entity_type: entity.entity_type,
            file: entity.file,
            raw_name: entity.raw_name,
            loc: entity.loc,
            code: code.clone(),
            code_length: code.len(),
            imports,
            exports,
            comments,
            dependencies: Vec::new(), // 第一阶段先留空，后续可以分析
            complexity,
            is_test,
            relative_file,
            embedding_text,
        })
    }

    /// 从文件内容提取指定行范围的代码
    fn extract_code_from_lines(
        &self,
        content: &str,
        start_line: usize,
        end_line: usize,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let lines: Vec<&str> = content.lines().collect();

        // 校验行号范围
        if start_line == 0 || start_line > lines.len() {
            return Err(format!("Invalid start_line: {}", start_line).into());
        }

        // 转换为 0-based 索引
        let start_idx = start_line - 1;
        let end_idx = std::cmp::min(end_line, lines.len());

        // 提取代码
        let code = lines[start_idx..end_idx].join("\n");

        Ok(code)
    }

    /// 提取导入语句
    fn extract_imports(&self, code: &str) -> Vec<String> {
        IMPORT_REGEX
            .captures_iter(code)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect()
    }

    /// 提取导出内容
    fn extract_exports(&self, code: &str) -> Vec<String> {
        EXPORT_REGEX
            .captures_iter(code)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
            .collect()
    }

    /// 提取注释
    fn extract_comments(&self, code: &str) -> Vec<String> {
        let mut comments = Vec::new();

        // 提取 JSDoc
        for cap in JSDOC_REGEX.captures_iter(code) {
            if let Some(comment) = cap.get(1) {
                let cleaned = comment
                    .as_str()
                    .lines()
                    .map(|line| line.trim_start_matches('*').trim())
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                comments.push(cleaned);
            }
        }

        // 提取单行注释（只保留有意义的注释）
        for cap in SINGLE_COMMENT_REGEX.captures_iter(code) {
            if let Some(comment) = cap.get(1) {
                let text = comment.as_str().trim();
                // 过滤掉太短或纯符号的注释
                if text.len() > 5 && text.chars().any(|c| c.is_alphabetic()) {
                    comments.push(text.to_string());
                }
            }
        }

        comments
    }

    /// 计算代码复杂度（简化版）
    fn calculate_complexity(&self, code: &str) -> u32 {
        let line_count = code.lines().count() as u32;

        // 统计控制流关键字
        let control_flow_keywords = [
            "if", "else", "for", "while", "switch", "case", "try", "catch", "async", "await",
        ];

        let mut control_flow_count = 0u32;
        for keyword in &control_flow_keywords {
            control_flow_count += code.matches(keyword).count() as u32;
        }

        // 简单的复杂度公式
        line_count + control_flow_count * 2
    }

    /// 判断是否为测试文件
    fn is_test_file(&self, file_path: &str) -> bool {
        let path = file_path.to_lowercase();
        path.contains("test") || path.contains("spec") || path.contains("__tests__")
    }

    /// 判断是否为测试代码
    fn is_test_code(&self, code: &str) -> bool {
        let test_keywords = ["describe", "it(", "test(", "expect("];
        test_keywords.iter().any(|keyword| code.contains(keyword))
    }

    /// 格式化为适合 embedding 的文本
    /// 这是最关键的函数，决定了 AI 如何理解代码
    fn format_for_embedding(
        &self,
        entity: &CodeEntity,
        code: &str,
        imports: &[String],
        exports: &[String],
        comments: &[String],
        relative_file: &str,
    ) -> String {
        let mut parts = Vec::new();

        // 1. 文件路径（帮助 AI 理解代码位置）
        parts.push(format!("File: {}", relative_file));

        // 2. 实体类型和名称
        parts.push(format!(
            "Type: {} | Name: {}",
            entity.entity_type, entity.raw_name
        ));

        // 3. 位置信息
        parts.push(format!(
            "Location: Lines {}-{}",
            entity.loc.start_line, entity.loc.end_line
        ));

        // 4. 导入信息（显示依赖）
        if !imports.is_empty() {
            parts.push(format!("Imports: {}", imports.join(", ")));
        }

        // 5. 导出信息
        if !exports.is_empty() {
            parts.push(format!("Exports: {}", exports.join(", ")));
        }

        // 6. 注释（重要的语义信息）
        if !comments.is_empty() {
            parts.push(format!("Comments: {}", comments.join(" | ")));
        }

        // 7. 分隔符
        parts.push("---".to_string());

        // 8. 实际代码
        parts.push(code.to_string());

        parts.join("\n")
    }

    /// 批量构建 chunks
    pub fn build_chunks(
        &self,
        entities: Vec<CodeEntity>,
    ) -> Result<(Vec<CodeChunk>, ChunkStats), Box<dyn std::error::Error>> {
        let mut chunks = Vec::new();
        let mut stats = ChunkStats {
            total_chunks: 0,
            total_code_size: 0,
            avg_chunk_size: 0,
            by_type: HashMap::new(),
        };

        for entity in entities {
            match self.build_chunk(entity) {
                Ok(chunk) => {
                    // 更新统计
                    stats.total_code_size += chunk.code_length;
                    *stats.by_type.entry(chunk.entity_type.clone()).or_insert(0) += 1;

                    chunks.push(chunk);
                }
                Err(e) => {
                    eprintln!("⚠️ Failed to build chunk: {}", e);
                    // 继续处理其他 entity
                }
            }
        }

        stats.total_chunks = chunks.len();
        stats.avg_chunk_size = if stats.total_chunks > 0 {
            stats.total_code_size / stats.total_chunks
        } else {
            0
        };

        Ok((chunks, stats))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_imports() {
        let builder = ChunkBuilder::new("/workspace".to_string());
        let code = r#"
            import React from 'react';
            import { Button } from './components/Button';
            import styles from './styles.css';
        "#;

        let imports = builder.extract_imports(code);
        assert_eq!(imports.len(), 3);
        assert!(imports.contains(&"react".to_string()));
        assert!(imports.contains(&"./components/Button".to_string()));
    }

    #[test]
    fn test_calculate_complexity() {
        let builder = ChunkBuilder::new("/workspace".to_string());
        let simple_code = "const x = 1;";
        let complex_code = r#"
            if (condition) {
                for (let i = 0; i < 10; i++) {
                    if (i % 2 === 0) {
                        try {
                            doSomething();
                        } catch (error) {
                            handleError();
                        }
                    }
                }
            }
        "#;

        let simple_complexity = builder.calculate_complexity(simple_code);
        let complex_complexity = builder.calculate_complexity(complex_code);

        assert!(complex_complexity > simple_complexity);
    }

    #[test]
    fn test_is_test_file() {
        let builder = ChunkBuilder::new("/workspace".to_string());

        assert!(builder.is_test_file("/src/components/Button.test.ts"));
        assert!(builder.is_test_file("/src/components/__tests__/Button.ts"));
        assert!(!builder.is_test_file("/src/components/Button.ts"));
    }
}
