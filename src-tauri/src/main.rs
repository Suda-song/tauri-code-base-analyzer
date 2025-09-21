// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod analyzer;
mod entity_analyzer;
mod precise_analyzer;
mod test;

use analyzer::{CodeAnalyzer, AnalysisResult};
use entity_analyzer::{EntityAnalyzer, CodeEntity};
use precise_analyzer::{PreciseAnalyzer, PreciseAnalysisResult};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// 寻找项目根目录的package.json文件
fn find_package_json(start_path: &Path) -> Option<PathBuf> {
    let mut current_path = start_path.to_path_buf();

    // 向上遍历目录寻找package.json
    loop {
        let package_json_path = current_path.join("package.json");
        if package_json_path.exists() {
            return Some(current_path);
        }

        // 尝试移动到父目录
        match current_path.parent() {
            Some(parent) => current_path = parent.to_path_buf(),
            None => break,
        }
    }

    None
}

/// 确保目录存在，如果不存在则创建
fn ensure_directory_exists(dir_path: &Path) -> Result<(), std::io::Error> {
    if !dir_path.exists() {
        fs::create_dir_all(dir_path)?;
    }
    Ok(())
}

/// 创建智能输出路径：在package.json同级创建codebase目录
fn create_smart_output_path(input_path: &str) -> Result<PathBuf, String> {
    let start_path = Path::new(input_path);

    // 首先寻找package.json所在的根目录
    if let Some(root_dir) = find_package_json(start_path) {
        let codebase_dir = root_dir.join("codebase");

        // 确保codebase目录存在
        if let Err(e) = ensure_directory_exists(&codebase_dir) {
            return Err(format!("Failed to create codebase directory: {}", e));
        }

        Ok(codebase_dir)
    } else {
        // 如果找不到package.json，就在输入目录创建codebase目录
        let fallback_dir = start_path.join("codebase");

        if let Err(e) = ensure_directory_exists(&fallback_dir) {
            return Err(format!("Failed to create fallback codebase directory: {}", e));
        }

        Ok(fallback_dir)
    }
}

#[tauri::command]
async fn analyze_repository(repo_path: String) -> Result<PreciseAnalysisResult, String> {
    let analyzer = PreciseAnalyzer::new();

    // 验证路径是否存在
    if !Path::new(&repo_path).exists() {
        return Err("Directory does not exist".to_string());
    }

    match analyzer.analyze_directory(&repo_path) {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("Repository analysis failed: {}", e)),
    }
}

#[tauri::command]
async fn analyze_entities(repo_path: String) -> Result<Vec<CodeEntity>, String> {
    let analyzer = EntityAnalyzer::new();

    // 验证路径是否存在
    if !Path::new(&repo_path).exists() {
        return Err("Directory does not exist".to_string());
    }

    match analyzer.analyze_directory(&repo_path, &repo_path) {
        Ok(entities) => Ok(entities),
        Err(e) => Err(format!("Entity analysis failed: {}", e)),
    }
}

#[tauri::command]
async fn save_entities_json(entities: Vec<CodeEntity>, output_path: String) -> Result<String, String> {
    let json_content = match serde_json::to_string_pretty(&entities) {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to serialize entities: {}", e)),
    };

    let output_file_path = Path::new(&output_path).join("entities.json");

    match fs::write(&output_file_path, json_content) {
        Ok(_) => Ok(output_file_path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

#[tauri::command]
async fn test_analyze_after_sale_demo() -> Result<String, String> {
    let demo_path = "/Users/billion_bian/codebase/tauri-code-base-analyzer/src/test/after-sale-demo";
    let output_path = "/Users/billion_bian/codebase/tauri-code-base-analyzer";

    let analyzer = EntityAnalyzer::new();

    match analyzer.analyze_directory(demo_path, demo_path) {
        Ok(entities) => {
            let json_content = match serde_json::to_string_pretty(&entities) {
                Ok(content) => content,
                Err(e) => return Err(format!("Failed to serialize entities: {}", e)),
            };

            let output_file_path = Path::new(output_path).join("test_entities.json");

            match fs::write(&output_file_path, json_content) {
                Ok(_) => Ok(format!("Generated {} entities to: {}", entities.len(), output_file_path.to_string_lossy())),
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        }
        Err(e) => Err(format!("Analysis failed: {}", e)),
    }
}

#[tauri::command]
async fn save_analysis_result(analysis: PreciseAnalysisResult, input_path: String) -> Result<String, String> {
    let json_content = match serde_json::to_string_pretty(&analysis) {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to serialize analysis: {}", e)),
    };

    // 使用智能输出路径
    let output_dir = match create_smart_output_path(&input_path) {
        Ok(dir) => dir,
        Err(e) => return Err(e),
    };

    // 生成带时间戳的文件名
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("base_entity_{}.json", timestamp);
    let output_file_path = output_dir.join(&filename);

    match fs::write(&output_file_path, json_content) {
        Ok(_) => {
            let package_json_dir = find_package_json(Path::new(&input_path))
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| input_path.clone());

            Ok(format!(
                "{}|{}|{}",
                output_file_path.to_string_lossy(),
                package_json_dir,
                filename
            ))
        },
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

#[tauri::command]
async fn open_file_location(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn get_current_directory() -> Result<String, String> {
    match std::env::current_dir() {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get current directory: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            analyze_repository,
            analyze_entities,
            save_entities_json,
            test_analyze_after_sale_demo,
            save_analysis_result,
            open_file_location,
            get_current_directory
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}