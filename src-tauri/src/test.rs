#[cfg(test)]
mod tests {
    use super::entity_analyzer::EntityAnalyzer;

    #[test]
    fn test_analyze_after_sale_demo() {
        let analyzer = EntityAnalyzer::new();
        let demo_path = "/Users/billion_bian/codebase/tauri-code-base-analyzer/src/test/after-sale-demo";

        match analyzer.analyze_directory(demo_path, demo_path) {
            Ok(entities) => {
                println!("Found {} entities", entities.len());
                for entity in entities.iter().take(5) {
                    println!("Entity: {} ({}:{})", entity.id, entity.entity_type, entity.file);
                }

                // 将结果保存到文件
                let json_content = serde_json::to_string_pretty(&entities).unwrap();
                std::fs::write("/Users/billion_bian/codebase/tauri-code-base-analyzer/test_entities.json", json_content).unwrap();

                assert!(!entities.is_empty());
            }
            Err(e) => {
                panic!("Analysis failed: {}", e);
            }
        }
    }
}