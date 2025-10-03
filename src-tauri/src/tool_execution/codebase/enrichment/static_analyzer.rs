use anyhow::{Context, Result};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use crate::tool_execution::codebase::CodeEntity;
use super::interfaces::StaticAnalysisResult;

/// 静态分析器
/// 
/// 负责提取代码的静态依赖关系：
/// - IMPORTS: 导入的模块和函数
/// - CALLS: 调用的函数和方法
/// - EMITS: 触发的事件
/// - TEMPLATE_COMPONENTS: 模板中使用的组件
pub struct StaticAnalyzer {
    root_dir: PathBuf,
    entities: Vec<CodeEntity>,
    entity_map: HashMap<String, HashMap<String, CodeEntity>>,
}

impl StaticAnalyzer {
    pub fn new<P: AsRef<Path>>(root_dir: P, entities: Vec<CodeEntity>) -> Self {
        let root_dir = root_dir.as_ref().to_path_buf();
        let entity_map = Self::build_entity_map(&entities);
        
        Self {
            root_dir,
            entities,
            entity_map,
        }
    }
    
    /// 更新实体列表
    pub fn set_entities(&mut self, entities: Vec<CodeEntity>) {
        self.entity_map = Self::build_entity_map(&entities);
        self.entities = entities;
    }
    
    /// 构建实体映射表（file -> rawName -> entity）
    fn build_entity_map(entities: &[CodeEntity]) -> HashMap<String, HashMap<String, CodeEntity>> {
        let mut map: HashMap<String, HashMap<String, CodeEntity>> = HashMap::new();
        
        for entity in entities {
            map.entry(entity.file.clone())
                .or_insert_with(HashMap::new)
                .insert(entity.raw_name.clone(), entity.clone());
        }
        
        map
    }
    
    /// 分析实体
    pub async fn analyze_entity(&self, entity: &CodeEntity) -> Result<StaticAnalysisResult> {
        let file_path = self.root_dir.join(&entity.file);
        
        println!("🔍 分析文件: {}", file_path.display());
        
        if !file_path.exists() {
            println!("⚠️  文件不存在: {}", file_path.display());
            return Ok(StaticAnalysisResult {
                imports: vec![],
                calls: vec![],
                emits: vec![],
                template_components: None,
                annotation: None,
            });
        }
        
        // 读取文件内容
        let content = fs::read_to_string(&file_path)
            .context(format!("无法读取文件: {}", file_path.display()))?;
        
        // 根据文件类型选择分析方法
        let result = if entity.file.ends_with(".vue") {
            self.analyze_vue_file(&content, entity)?
        } else if entity.file.ends_with(".ts") || entity.file.ends_with(".tsx") {
            self.analyze_ts_file(&content, entity)?
        } else {
            StaticAnalysisResult {
                imports: vec![],
                calls: vec![],
                emits: vec![],
                template_components: None,
                annotation: None,
            }
        };
        
        Ok(result)
    }
    
    /// 分析 Vue 文件
    fn analyze_vue_file(&self, content: &str, entity: &CodeEntity) -> Result<StaticAnalysisResult> {
        let mut result = StaticAnalysisResult {
            imports: vec![],
            calls: vec![],
            emits: vec![],
            template_components: None,
            annotation: None,
        };
        
        // 提取 <script> 部分
        if let Some(script_content) = self.extract_script_section(content) {
            result.imports = self.extract_imports(&script_content, &entity.file);
            result.calls = self.extract_calls(&script_content, &result.imports);
            result.emits = self.extract_vue_emits(&script_content);
            result.annotation = self.extract_annotation(&script_content);
        }
        
        // 提取 <template> 部分
        if let Some(template_content) = self.extract_template_section(content) {
            result.template_components = Some(self.extract_template_components(&template_content));
        }
        
        Ok(result)
    }
    
    /// 分析 TypeScript 文件
    fn analyze_ts_file(&self, content: &str, entity: &CodeEntity) -> Result<StaticAnalysisResult> {
        let imports = self.extract_imports(content, &entity.file);
        let calls = self.extract_calls(content, &imports);
        let emits = if entity.file.ends_with(".tsx") {
            self.extract_jsx_emits(content)
        } else {
            vec![]
        };
        let annotation = self.extract_annotation(content);
        
        Ok(StaticAnalysisResult {
            imports,
            calls,
            emits,
            template_components: None,
            annotation,
        })
    }
    
    /// 提取 Vue 文件的 script 部分
    fn extract_script_section(&self, content: &str) -> Option<String> {
        // 提取 <script setup>
        let script_setup_re = Regex::new(r"<script\s+setup[^>]*>([\s\S]*?)</script>").unwrap();
        if let Some(cap) = script_setup_re.captures(content) {
            return Some(cap[1].to_string());
        }
        
        // 提取普通 <script>
        let script_re = Regex::new(r"<script[^>]*>([\s\S]*?)</script>").unwrap();
        if let Some(cap) = script_re.captures(content) {
            return Some(cap[1].to_string());
        }
        
        None
    }
    
    /// 提取 Vue 文件的 template 部分
    fn extract_template_section(&self, content: &str) -> Option<String> {
        let template_re = Regex::new(r"<template[^>]*>([\s\S]*?)</template>").unwrap();
        template_re.captures(content).map(|cap| cap[1].to_string())
    }
    
    /// 提取导入语句
    fn extract_imports(&self, content: &str, current_file: &str) -> Vec<String> {
        let mut imports = HashSet::new();
        
        // 匹配 ES6 import 语句
        let import_re = Regex::new(
            r#"import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]"#
        ).unwrap();
        
        for cap in import_re.captures_iter(content) {
            let module_path = &cap[1];
            
            // 只处理相对导入（以 ./ 或 ../ 开头）
            if module_path.starts_with('.') {
                // 解析模块路径
                if let Some(resolved_file) = self.resolve_module_path(module_path, current_file) {
                    // 提取该文件的导出实体
                    if let Some(file_entities) = self.entity_map.get(&resolved_file) {
                        for entity_id in file_entities.values().map(|e| e.id.clone()) {
                            imports.insert(entity_id);
                        }
                    }
                }
            }
        }
        
        imports.into_iter().collect()
    }
    
    /// 提取函数调用
    fn extract_calls(&self, content: &str, imports: &[String]) -> Vec<String> {
        let mut calls = HashSet::new();
        
        // 简单的函数调用检测（identifier() 模式）
        let call_re = Regex::new(r"\b(\w+)\s*\(").unwrap();
        
        for cap in call_re.captures_iter(content) {
            let func_name = &cap[1];
            
            // 检查是否是导入的函数
            for import_id in imports {
                if import_id.contains(func_name) {
                    calls.insert(import_id.clone());
                }
            }
        }
        
        calls.into_iter().collect()
    }
    
    /// 提取 Vue emit 事件
    fn extract_vue_emits(&self, content: &str) -> Vec<String> {
        let mut emits = HashSet::new();
        
        // 匹配 emit('event-name') 或 $emit('event-name')
        let emit_re = Regex::new(r#"(?:\$?emit)\s*\(\s*['"]([^'"]+)['"]"#).unwrap();
        
        for cap in emit_re.captures_iter(content) {
            emits.insert(cap[1].to_string());
        }
        
        emits.into_iter().collect()
    }
    
    /// 提取 JSX/TSX emit 事件（props.onXxx 模式）
    fn extract_jsx_emits(&self, content: &str) -> Vec<String> {
        let mut emits = HashSet::new();
        
        // 匹配 props.onXxx() 或 props['onXxx']()
        let emit_re = Regex::new(r#"props\.on([A-Z]\w+)\s*\("#).unwrap();
        
        for cap in emit_re.captures_iter(content) {
            let event_name = cap[1].to_lowercase();
            emits.insert(event_name);
        }
        
        emits.into_iter().collect()
    }
    
    /// 提取模板中的组件
    fn extract_template_components(&self, template: &str) -> Vec<String> {
        let mut components = HashSet::new();
        
        // 匹配 <ComponentName> 或 <component-name> 标签
        let component_re = Regex::new(r"<([A-Z][a-zA-Z0-9]*|[a-z]+-[a-z-]+)[\s>]").unwrap();
        
        // HTML 原生标签列表
        let native_tags = [
            "template", "div", "span", "p", "a", "img", "ul", "ol", "li",
            "button", "input", "form", "table", "tr", "td", "th", "h1", "h2",
            "h3", "h4", "h5", "h6", "header", "footer", "nav", "section", "article",
        ];
        
        for cap in component_re.captures_iter(template) {
            let tag_name = &cap[1];
            
            // 过滤原生 HTML 标签
            if !native_tags.contains(&tag_name.to_lowercase().as_str()) {
                components.insert(tag_name.to_string());
            }
        }
        
        components.into_iter().collect()
    }
    
    /// 提取注释
    fn extract_annotation(&self, content: &str) -> Option<String> {
        // 提取文件开头的注释块
        let comment_re = Regex::new(r"^[\s\n]*/\*\*?([\s\S]*?)\*/").unwrap();
        
        if let Some(cap) = comment_re.captures(content) {
            let comment = cap[1]
                .lines()
                .map(|line| line.trim().trim_start_matches('*').trim())
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            
            if !comment.is_empty() {
                return Some(comment);
            }
        }
        
        // 尝试提取单行注释
        let single_line_re = Regex::new(r"^[\s\n]*//\s*(.+)$").unwrap();
        if let Some(cap) = single_line_re.captures(content) {
            return Some(cap[1].trim().to_string());
        }
        
        None
    }
    
    /// 解析模块路径
    fn resolve_module_path(&self, module_specifier: &str, current_file: &str) -> Option<String> {
        let current_path = Path::new(current_file);
        let current_dir = current_path.parent()?;
        
        // 拼接相对路径
        let mut resolved = current_dir.join(module_specifier);
        
        // 尝试添加扩展名
        let extensions = [".ts", ".tsx", ".vue", ".js", ".jsx"];
        
        // 如果已经有扩展名
        if resolved.extension().is_some() {
            if self.root_dir.join(&resolved).exists() {
                return Some(resolved.to_string_lossy().to_string());
            }
        }
        
        // 尝试添加扩展名
        for ext in &extensions {
            let with_ext = resolved.with_extension(&ext[1..]);
            if self.root_dir.join(&with_ext).exists() {
                return Some(with_ext.to_string_lossy().to_string());
            }
        }
        
        // 尝试作为目录，查找 index 文件
        if resolved.is_dir() {
            for ext in &extensions {
                let index_file = resolved.join(format!("index{}", ext));
                if self.root_dir.join(&index_file).exists() {
                    return Some(index_file.to_string_lossy().to_string());
                }
            }
        }
        
        None
    }
}

