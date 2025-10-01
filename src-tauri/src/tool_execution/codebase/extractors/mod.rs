//! 代码提取器模块
//!
//! 提供各种语言和框架的代码实体提取器

pub mod type_utils;
pub mod typescript;
pub mod vue;

// 共享类型定义
use serde::{Deserialize, Serialize};

/// 代码实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    pub id: String,
    pub entity_type: String,
    pub file: String,
    pub loc: LocationInfo,
    pub raw_name: String,
}

/// 位置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationInfo {
    pub start_line: usize,
    pub end_line: usize,
}

impl LocationInfo {
    pub fn new(line: usize) -> Self {
        Self {
            start_line: line,
            end_line: line,
        }
    }

    pub fn with_range(start: usize, end: usize) -> Self {
        Self {
            start_line: start,
            end_line: end,
        }
    }
}

// 重新导出
pub use type_utils::{TypeInfo, TypeUtils};
pub use typescript::TypeScriptExtractor;
pub use vue::VueExtractor;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vue_extractor() {
        let mut extractor = TypeScriptExtractor::new(false).expect("创建提取器失败");
        let test_file = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo/src/api/afterSale.ts";
        let root_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        match extractor.extract(test_file, root_dir) {
            Ok(entities) => {
                println!("\n✅ 提取到 {} 个实体:", entities.len());
                for entity in &entities {
                    println!(
                        "  - id:{} entity_type:{} raw_name:{} loc:{{start:{},end:{}}} file:{}",
                        entity.id,
                        entity.entity_type,
                        entity.raw_name,
                        entity.loc.start_line,
                        entity.loc.end_line,
                        entity.file
                    );
                }
                assert!(!entities.is_empty());
            }
            Err(e) => panic!("提取失败: {}", e),
        }
    }
}
