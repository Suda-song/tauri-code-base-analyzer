use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityLocation {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    pub id: String,
    #[serde(rename = "type")]
    pub entity_type: String,
    pub file: String,
    pub loc: EntityLocation,
    #[serde(rename = "rawName")]
    pub raw_name: String,
    #[serde(rename = "isWorkspace")]
    pub is_workspace: bool,
    #[serde(rename = "isDDD")]
    pub is_ddd: bool,
}

pub struct EntityAnalyzer {
    // 各种正则表达式用于匹配不同类型的代码实体
    function_regex: Regex,
    class_regex: Regex,
    interface_regex: Regex,
    variable_regex: Regex,
    const_regex: Regex,
    export_function_regex: Regex,
    export_class_regex: Regex,
    vue_export_regex: Regex,
    ts_function_regex: Regex,
    arrow_function_regex: Regex,
}

impl EntityAnalyzer {
    pub fn new() -> Self {
        Self {
            // JavaScript/TypeScript 函数
            function_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(").unwrap(),
            // 类定义
            class_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)").unwrap(),
            // 接口定义
            interface_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?interface\s+(\w+)").unwrap(),
            // 变量声明
            variable_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?(?:const|let|var)\s+(\w+)").unwrap(),
            // 常量声明
            const_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?const\s+(\w+)").unwrap(),
            // 导出函数
            export_function_regex: Regex::new(r"export\s+(?:async\s+)?function\s+(\w+)").unwrap(),
            // 导出类
            export_class_regex: Regex::new(r"export\s+(?:default\s+)?class\s+(\w+)").unwrap(),
            // Vue组件导出
            vue_export_regex: Regex::new(r#"export\s+default\s+\{[^}]*name\s*:\s*["'](\w+)["']"#).unwrap(),
            // TypeScript函数类型
            ts_function_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?(\w+)\s*:\s*\([^)]*\)\s*=>").unwrap(),
            // 箭头函数
            arrow_function_regex: Regex::new(r"(?m)^[\s]*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>").unwrap(),
        }
    }

    pub fn analyze_directory(&self, dir_path: &str, base_path: &str) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let mut entities = Vec::new();
        let base_path_obj = Path::new(base_path);

        for entry in WalkDir::new(dir_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();

                    // 只分析源代码文件，跳过构建产物
                    if self.is_source_file(&ext_str) && !path.to_string_lossy().contains("/dist/") {
                        match self.analyze_file(path, base_path_obj) {
                            Ok(mut file_entities) => {
                                entities.append(&mut file_entities);
                            }
                            Err(e) => {
                                eprintln!("Error analyzing file {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }

        Ok(entities)
    }

    fn is_source_file(&self, extension: &str) -> bool {
        matches!(
            extension,
            "js" | "jsx" | "ts" | "tsx" | "vue" | "svelte"
        )
    }

    fn analyze_file(&self, file_path: &Path, base_path: &Path) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let mut entities = Vec::new();

        // 获取相对路径
        let relative_path = file_path.strip_prefix(base_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .replace('\\', "/");

        // 判断是否为工作区文件（这里简单判断不在node_modules中）
        let is_workspace = !relative_path.contains("node_modules");

        // 判断是否为DDD相关（这里简单判断路径是否包含domain相关关键词）
        let is_ddd = relative_path.contains("domain") ||
                     relative_path.contains("entity") ||
                     relative_path.contains("aggregate") ||
                     relative_path.contains("repository");

        // 分析不同类型的实体
        entities.extend(self.extract_functions(&content, &relative_path, is_workspace, is_ddd));
        entities.extend(self.extract_classes(&content, &relative_path, is_workspace, is_ddd));
        entities.extend(self.extract_interfaces(&content, &relative_path, is_workspace, is_ddd));
        entities.extend(self.extract_variables(&content, &relative_path, is_workspace, is_ddd));

        // 对于Vue文件，特殊处理
        if file_path.extension().unwrap_or_default() == "vue" {
            entities.extend(self.extract_vue_components(&content, &relative_path, is_workspace, is_ddd));
        }

        Ok(entities)
    }

    fn extract_functions(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Vec<CodeEntity> {
        let mut entities = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        // 普通函数声明
        for caps in self.function_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Function:{}", name),
                    entity_type: "function".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 箭头函数
        for caps in self.arrow_function_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Function:{}", name),
                    entity_type: "function".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        entities
    }

    fn extract_classes(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Vec<CodeEntity> {
        let mut entities = Vec::new();

        for caps in self.class_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Class:{}", name),
                    entity_type: "class".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        entities
    }

    fn extract_interfaces(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Vec<CodeEntity> {
        let mut entities = Vec::new();

        for caps in self.interface_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Interface:{}", name),
                    entity_type: "interface".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        entities
    }

    fn extract_variables(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Vec<CodeEntity> {
        let mut entities = Vec::new();

        for caps in self.variable_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Variable:{}", name),
                    entity_type: "variable".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        entities
    }

    fn extract_vue_components(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Vec<CodeEntity> {
        let mut entities = Vec::new();

        // 提取Vue组件名
        for caps in self.vue_export_regex.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str();
                let loc = self.find_location(content, name_match.start());

                entities.push(CodeEntity {
                    id: format!("Component:{}", name),
                    entity_type: "component".to_string(),
                    file: file_path.to_string(),
                    loc,
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 如果没有找到名称，使用文件名
        if entities.is_empty() {
            if let Some(file_name) = Path::new(file_path).file_stem() {
                let name = file_name.to_string_lossy();
                entities.push(CodeEntity {
                    id: format!("Component:{}", name),
                    entity_type: "component".to_string(),
                    file: file_path.to_string(),
                    loc: EntityLocation { start: 1, end: 10 },
                    raw_name: name.to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        entities
    }

    fn find_location(&self, content: &str, byte_pos: usize) -> EntityLocation {
        let lines: Vec<&str> = content.lines().collect();
        let mut current_pos = 0;

        for (line_num, line) in lines.iter().enumerate() {
            let line_end = current_pos + line.len() + 1; // +1 for newline

            if byte_pos <= line_end {
                // 找到匹配的行，简单估算结束位置
                let start_line = line_num + 1;
                let end_line = (start_line + 10).min(lines.len()); // 假设实体跨越最多10行

                return EntityLocation {
                    start: start_line,
                    end: end_line,
                };
            }

            current_pos = line_end;
        }

        EntityLocation { start: 1, end: 1 }
    }
}