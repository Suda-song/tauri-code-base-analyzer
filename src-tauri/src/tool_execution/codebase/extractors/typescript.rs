//! TypeScript/TSX 代码提取器
//! 
//! 使用 tree-sitter 解析 TypeScript 和 TSX 文件，提取函数、类、变量等实体

use std::fs;
use std::path::Path;
use tree_sitter::{Parser, Language, Node};
use super::type_utils::{TypeUtils, TypeInfo};
use super::{CodeEntity, LocationInfo};

/// TypeScript/TSX 提取器
pub struct TypeScriptExtractor {
    parser: Parser,
}

impl TypeScriptExtractor {
    /// 创建新的 TypeScript 提取器
    pub fn new(is_tsx: bool) -> Result<Self, Box<dyn std::error::Error>> {
        let mut parser = Parser::new();
        let language = if is_tsx {
            tree_sitter_typescript::language_tsx()
        } else {
            tree_sitter_typescript::language_typescript()
        };
        parser.set_language(&language)?;
        
        Ok(Self { parser })
    }
    
    /// 提取文件中的实体
    pub fn extract(
        &mut self,
        file_path: &str,
        root_dir: &str,
    ) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let is_jsx_context = file_path.ends_with(".tsx") || file_path.ends_with(".jsx");
        
        let tree = self.parser.parse(&content, None)
            .ok_or("Failed to parse file")?;
        
        let mut entities = Vec::new();
        let relative_path = Path::new(file_path)
            .strip_prefix(root_dir)
            .unwrap_or(Path::new(file_path))
            .to_string_lossy()
            .to_string();
        
        // 遍历根节点的子节点
        let root_node = tree.root_node();
        let mut cursor = root_node.walk();
        
        for child in root_node.children(&mut cursor) {
            self.extract_from_node(&child, &content, &relative_path, is_jsx_context, &mut entities)?;
        }
        
        Ok(entities)
    }
    
    /// 从 AST 节点提取实体
    fn extract_from_node(
        &self,
        node: &Node,
        content: &str,
        file_path: &str,
        is_jsx_context: bool,
        entities: &mut Vec<CodeEntity>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let node_kind = node.kind();
        
        match node_kind {
            // 导出的函数声明
            "export_statement" => {
                self.handle_export_statement(node, content, file_path, is_jsx_context, entities)?;
            }
            // 函数声明
            "function_declaration" | "function_signature" => {
                self.handle_function_declaration(node, content, file_path, is_jsx_context, false, entities)?;
            }
            // 类声明
            "class_declaration" => {
                self.handle_class_declaration(node, content, file_path, is_jsx_context, false, entities)?;
            }
            // 词法声明（const/let/var）
            "lexical_declaration" => {
                self.handle_lexical_declaration(node, content, file_path, is_jsx_context, false, entities)?;
            }
            _ => {}
        }
        
        Ok(())
    }
    
    /// 处理导出语句
    fn handle_export_statement(
        &self,
        node: &Node,
        content: &str,
        file_path: &str,
        is_jsx_context: bool,
        entities: &mut Vec<CodeEntity>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "function_declaration" => {
                    self.handle_function_declaration(&child, content, file_path, is_jsx_context, true, entities)?;
                }
                "class_declaration" => {
                    self.handle_class_declaration(&child, content, file_path, is_jsx_context, true, entities)?;
                }
                "lexical_declaration" => {
                    self.handle_lexical_declaration(&child, content, file_path, is_jsx_context, true, entities)?;
                }
                _ => {}
            }
        }
        
        Ok(())
    }
    
    /// 处理函数声明
    fn handle_function_declaration(
        &self,
        node: &Node,
        content: &str,
        file_path: &str,
        is_jsx_context: bool,
        is_exported: bool,
        entities: &mut Vec<CodeEntity>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !is_exported {
            return Ok(());
        }
        
        // 获取函数名
        let name_node = node.child_by_field_name("name");
        let func_name = if let Some(name) = name_node {
            name.utf8_text(content.as_bytes())?
        } else {
            "default"
        };
        
        // 获取函数内容
        let func_content = node.utf8_text(content.as_bytes())?;
        
        // 判断是否是组件
        let is_component = TypeUtils::is_component_function(func_name, func_content, is_jsx_context);
        let type_info = if is_component {
            TypeInfo::component()
        } else {
            TypeInfo::function()
        };
        
        // 获取文件名（用于默认导出）
        let file_name = Path::new(file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");
        
        let final_name = if func_name == "default" {
            file_name
        } else {
            func_name
        };
        
        entities.push(CodeEntity {
            id: format!("{}:{}", type_info.id_prefix, final_name),
            entity_type: type_info.entity_type,
            file: file_path.to_string(),
            loc: LocationInfo {
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
            },
            raw_name: func_name.to_string(),
        });
        
        Ok(())
    }
    
    /// 处理类声明
    fn handle_class_declaration(
        &self,
        node: &Node,
        content: &str,
        file_path: &str,
        is_jsx_context: bool,
        is_exported: bool,
        entities: &mut Vec<CodeEntity>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !is_exported {
            return Ok(());
        }
        
        // 获取类名
        let name_node = node.child_by_field_name("name");
        let class_name = if let Some(name) = name_node {
            name.utf8_text(content.as_bytes())?
        } else {
            "default"
        };
        
        // 获取类内容
        let class_content = node.utf8_text(content.as_bytes())?;
        
        // 判断是否是组件
        let is_component = TypeUtils::is_component_class(class_name, class_content, is_jsx_context);
        let type_info = TypeUtils::get_class_type_info(is_component);
        
        // 获取文件名（用于默认导出）
        let file_name = Path::new(file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");
        
        let final_name = if class_name == "default" {
            file_name
        } else {
            class_name
        };
        
        entities.push(CodeEntity {
            id: format!("{}:{}", type_info.id_prefix, final_name),
            entity_type: type_info.entity_type,
            file: file_path.to_string(),
            loc: LocationInfo {
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
            },
            raw_name: class_name.to_string(),
        });
        
        Ok(())
    }
    
    /// 处理词法声明（const/let/var）
    fn handle_lexical_declaration(
        &self,
        node: &Node,
        content: &str,
        file_path: &str,
        is_jsx_context: bool,
        is_exported: bool,
        entities: &mut Vec<CodeEntity>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !is_exported {
            return Ok(());
        }
        
        let mut cursor = node.walk();
        
        // 遍历变量声明
        for child in node.children(&mut cursor) {
            if child.kind() == "variable_declarator" {
                // 获取变量名
                let name_node = child.child_by_field_name("name");
                let var_name = if let Some(name) = name_node {
                    name.utf8_text(content.as_bytes())?
                } else {
                    continue;
                };
                
                // 获取初始化器
                let initializer_node = child.child_by_field_name("value");
                let initializer = if let Some(init) = initializer_node {
                    init.utf8_text(content.as_bytes())?
                } else {
                    ""
                };
                
                // 判断类型
                let is_component = TypeUtils::is_component_variable(var_name, initializer, is_jsx_context);
                let is_function = TypeUtils::is_function_variable(initializer);
                let is_constant = TypeUtils::is_constant_variable(var_name, initializer);
                
                let type_info = TypeUtils::get_entity_type_info(is_component, is_function, is_constant);
                
                entities.push(CodeEntity {
                    id: format!("{}:{}", type_info.id_prefix, var_name),
                    entity_type: type_info.entity_type,
                    file: file_path.to_string(),
                    loc: LocationInfo {
                        start_line: child.start_position().row + 1,
                        end_line: child.end_position().row + 1,
                    },
                    raw_name: var_name.to_string(),
                });
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_typescript_extractor() {
        let mut extractor = TypeScriptExtractor::new(false).unwrap();
        
        let test_code = r#"
export function hello() {
    return "world";
}

export const API_URL = "https://api.example.com";

export class UserService {
    getUser() {}
}
        "#;
        
        // 创建临时文件
        let temp_file = "/tmp/test_typescript.ts";
        fs::write(temp_file, test_code).unwrap();
        
        let entities = extractor.extract(temp_file, "/tmp").unwrap();
        
        assert!(entities.len() >= 3);
        
        // 清理
        fs::remove_file(temp_file).ok();
    }
    
    #[test]
    fn test_tsx_extractor() {
        let mut extractor = TypeScriptExtractor::new(true).unwrap();
        
        let test_code = r#"
export function Button() {
    return <button>Click</button>;
}

export const UserProfile = () => {
    return <div>Profile</div>;
};
        "#;
        
        // 创建临时文件
        let temp_file = "/tmp/test_tsx.tsx";
        fs::write(temp_file, test_code).unwrap();
        
        let entities = extractor.extract(temp_file, "/tmp").unwrap();
        
        // 应该提取到两个组件
        let components: Vec<_> = entities.iter()
            .filter(|e| e.entity_type == "component")
            .collect();
        
        assert!(components.len() >= 2);
        
        // 清理
        fs::remove_file(temp_file).ok();
    }
}
