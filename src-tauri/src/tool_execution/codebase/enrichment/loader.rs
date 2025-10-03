use crate::tool_execution::codebase::CodeEntity;
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// 加载实体文件
pub fn load_entities<P: AsRef<Path>>(path: P, root_dir: Option<P>) -> Result<Vec<CodeEntity>> {
    let path_ref = path.as_ref();

    // 如果是相对路径，拼接根目录
    let full_path = if path_ref.is_absolute() {
        path_ref.to_path_buf()
    } else if let Some(root) = root_dir {
        root.as_ref().join(path_ref)
    } else {
        path_ref.to_path_buf()
    };

    println!("📂 加载实体文件: {}", full_path.display());

    // 读取文件
    let content =
        fs::read_to_string(&full_path).context(format!("无法读取文件: {}", full_path.display()))?;

    // 解析 JSON
    let entities: Vec<CodeEntity> = if content.trim_start().starts_with('[') {
        // 如果是数组格式，直接解析
        serde_json::from_str(&content).context("JSON 解析失败")?
    } else {
        // 如果是对象格式，提取 entities 字段
        use serde_json::Value;
        let value: Value = serde_json::from_str(&content).context("JSON 解析失败")?;

        // 尝试从 entities 字段提取
        if let Some(entities_array) = value.get("entities") {
            serde_json::from_value(entities_array.clone()).context("解析 entities 字段失败")?
        } else {
            return Err(anyhow::anyhow!("JSON 文件中没有找到 'entities' 字段"));
        }
    };

    println!("✅ 加载了 {} 个实体", entities.len());

    Ok(entities)
}

/// 验证实体
pub fn validate_entities(entities: Vec<CodeEntity>) -> Vec<CodeEntity> {
    let initial_count = entities.len();

    let valid_entities: Vec<CodeEntity> = entities
        .into_iter()
        .filter(|entity| {
            // 基本验证
            !entity.id.is_empty() && !entity.entity_type.is_empty() && !entity.file.is_empty()
        })
        .collect();

    let filtered_count = initial_count - valid_entities.len();
    if filtered_count > 0 {
        println!("⚠️  过滤掉 {} 个无效实体", filtered_count);
    }

    valid_entities
}
