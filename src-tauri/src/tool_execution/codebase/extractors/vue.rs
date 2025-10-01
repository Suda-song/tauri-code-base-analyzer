use regex::Regex;
use std::fs;
use std::path::Path;
use super::{CodeEntity, LocationInfo};

/// Vue 文件提取器
pub struct VueExtractor {
    script_setup_regex: Regex,
    script_regex: Regex,
    export_default_regex: Regex,
    define_component_regex: Regex,
    composable_regex: Regex,
    pinia_store_regex: Regex,
}

impl VueExtractor {
    /// 创建新的 Vue 提取器
    pub fn new() -> Self {
        Self {
            script_setup_regex: Regex::new(r"<script\s+setup[^>]*>([\s\S]*?)</script>").unwrap(),
            script_regex: Regex::new(r"<script[^>]*>([\s\S]*?)</script>").unwrap(),
            export_default_regex: Regex::new(r"export\s+default\s+").unwrap(),
            define_component_regex: Regex::new(r"defineComponent\s*\(").unwrap(),
            composable_regex: Regex::new(r"export\s+(const|function)\s+use[A-Z]\w+").unwrap(),
            pinia_store_regex: Regex::new(r#"defineStore\s*\(\s*['"](\w+)['"]"#).unwrap(),
        }
    }

    /// 提取 Vue 文件中的实体
    pub fn extract(
        &self,
        file_path: &str,
        root_dir: &str,
    ) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let mut entities = Vec::new();

        let relative_path = Path::new(file_path)
            .strip_prefix(root_dir)
            .unwrap_or(Path::new(file_path))
            .to_string_lossy()
            .to_string();

        // 1. 检查 <script setup>
        if let Some(captures) = self.script_setup_regex.captures(&content) {
            let script_content = captures.get(1).unwrap().as_str();
            let start_line = content[..captures.get(0).unwrap().start()]
                .lines()
                .count();

            // script setup 是组件的特殊情况
            let file_name = Path::new(file_path)
                .file_stem()
                .unwrap()
                .to_string_lossy();

            entities.push(CodeEntity {
                id: format!("Component:{}", file_name),
                entity_type: "component".to_string(),
                file: relative_path.clone(),
                loc: LocationInfo::new(start_line),
                raw_name: "setup".to_string(),
            });

            // 检查 Pinia store
            self.extract_pinia_stores(&script_content, &relative_path, start_line, &mut entities);

            return Ok(entities);
        }

        // 2. 检查普通 <script>
        if let Some(captures) = self.script_regex.captures(&content) {
            let script_content = captures.get(1).unwrap().as_str();
            let start_line = content[..captures.get(0).unwrap().start()]
                .lines()
                .count();

            // 检查 export default
            if self.export_default_regex.is_match(script_content) {
                let file_name = Path::new(file_path)
                    .file_stem()
                    .unwrap()
                    .to_string_lossy();

                entities.push(CodeEntity {
                    id: format!("Component:{}", file_name),
                    entity_type: "component".to_string(),
                    file: relative_path.clone(),
                    loc: LocationInfo::new(start_line),
                    raw_name: "default".to_string(),
                });
            }

            // 检查 defineComponent
            if self.define_component_regex.is_match(script_content) {
                let file_name = Path::new(file_path)
                    .file_stem()
                    .unwrap()
                    .to_string_lossy();

                entities.push(CodeEntity {
                    id: format!("Component:{}", file_name),
                    entity_type: "component".to_string(),
                    file: relative_path.clone(),
                    loc: LocationInfo::new(start_line),
                    raw_name: "defineComponent".to_string(),
                });
            }

            // 检查 composables
            self.extract_composables(&script_content, &relative_path, start_line, &mut entities);

            // 检查 Pinia stores
            self.extract_pinia_stores(&script_content, &relative_path, start_line, &mut entities);
        }

        Ok(entities)
    }

    /// 提取 Composables
    fn extract_composables(
        &self,
        content: &str,
        file: &str,
        base_line: usize,
        entities: &mut Vec<CodeEntity>,
    ) {
        for capture in self.composable_regex.captures_iter(content) {
            if let Some(matched) = capture.get(0) {
                let line_offset = content[..matched.start()].lines().count();
                let composable_name = matched.as_str()
                    .split_whitespace()
                    .last()
                    .unwrap_or("unknown");

                entities.push(CodeEntity {
                    id: format!("Composable:{}", composable_name),
                    entity_type: "composable".to_string(),
                    file: file.to_string(),
                    loc: LocationInfo::new(base_line + line_offset),
                    raw_name: composable_name.to_string(),
                });
            }
        }
    }

    /// 提取 Pinia Stores
    fn extract_pinia_stores(
        &self,
        content: &str,
        file: &str,
        base_line: usize,
        entities: &mut Vec<CodeEntity>,
    ) {
        for capture in self.pinia_store_regex.captures_iter(content) {
            if let (Some(matched), Some(store_name)) = (capture.get(0), capture.get(1)) {
                let line_offset = content[..matched.start()].lines().count();

                entities.push(CodeEntity {
                    id: format!("Store:{}", store_name.as_str()),
                    entity_type: "pinia_store".to_string(),
                    file: file.to_string(),
                    loc: LocationInfo::new(base_line + line_offset),
                    raw_name: store_name.as_str().to_string(),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vue_extractor_script_setup() {
        let content = r#"
<template>
  <div>Hello</div>
</template>

<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
        "#;

        let temp_file = "/tmp/test_component.vue";
        fs::write(temp_file, content).unwrap();

        let extractor = VueExtractor::new();
        let entities = extractor.extract(temp_file, "/tmp").unwrap();

        assert_eq!(entities.len(), 1);
        assert_eq!(entities[0].entity_type, "component");
        assert_eq!(entities[0].raw_name, "setup");
    }
}
