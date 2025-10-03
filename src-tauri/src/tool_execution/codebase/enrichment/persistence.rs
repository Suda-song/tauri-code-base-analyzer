use super::interfaces::EnrichedEntity;
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// 保存富化后的实体到文件
pub fn save_enriched_entities<P: AsRef<Path>>(
    entities: Vec<EnrichedEntity>,
    output_path: P,
    root_dir: Option<P>,
) -> Result<String> {
    let path_ref = output_path.as_ref();

    // 如果是相对路径，拼接根目录
    let full_path = if path_ref.is_absolute() {
        path_ref.to_path_buf()
    } else if let Some(root) = root_dir {
        root.as_ref().join(path_ref)
    } else {
        path_ref.to_path_buf()
    };

    println!("💾 保存富化实体到: {}", full_path.display());

    // 确保父目录存在
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).context(format!("无法创建目录: {}", parent.display()))?;
    }

    // 序列化为 JSON
    let json = serde_json::to_string_pretty(&entities).context("序列化实体失败")?;

    // 写入文件
    fs::write(&full_path, json).context(format!("写入文件失败: {}", full_path.display()))?;

    println!("✅ 成功保存 {} 个富化实体", entities.len());

    Ok(full_path.to_string_lossy().to_string())
}
