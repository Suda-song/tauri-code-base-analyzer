// src-tauri/src/tool_execution/codebase/file_walker.rs

//! 文件扫描和实体提取的统一入口
//!
//! 负责扫描目录、识别 workspace 配置、调用提取器提取代码实体

use super::extractors::{CodeEntity, TypeScriptExtractor, VueExtractor};
use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 扫描配置
#[derive(Debug, Clone)]
pub struct ScanConfig {
    /// 支持的文件扩展名
    pub extensions: Vec<String>,

    /// 要忽略的目录
    pub ignore_dirs: Vec<String>,

    /// 最大并行处理数（Rust 中通过 rayon 实现）
    pub max_parallel: usize,

    /// 是否扫描 workspace 依赖
    pub include_workspace: bool,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            extensions: vec![".vue".to_string(), ".ts".to_string(), ".tsx".to_string()],
            ignore_dirs: vec![
                "node_modules".to_string(),
                "dist".to_string(),
                "build".to_string(),
                "coverage".to_string(),
                ".git".to_string(),
                "tmp".to_string(),
                "temp".to_string(),
                ".cache".to_string(),
                "public".to_string(),
                "static".to_string(),
                "assets".to_string(),
            ],
            max_parallel: 8,
            include_workspace: true,
        }
    }
}

/// Workspace 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    /// workspace 根目录
    pub root: PathBuf,

    /// workspace 包的路径列表
    pub package_paths: Vec<PathBuf>,

    /// 包名到路径的映射
    pub package_map: HashMap<String, PathBuf>,
}

/// 扫描统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanStats {
    /// 扫描的文件总数
    pub total_files: usize,

    /// 成功提取的文件数
    pub success_files: usize,

    /// 失败的文件数
    pub failed_files: usize,

    /// 提取到的实体总数
    pub total_entities: usize,

    /// 按文件类型统计
    pub by_extension: HashMap<String, usize>,

    /// 按实体类型统计
    pub by_entity_type: HashMap<String, usize>,

    /// 总耗时（毫秒）
    pub duration_ms: u128,
}

/// 保存的实体数据（包含元数据）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedEntityData {
    /// 元数据
    pub metadata: EntityMetadata,

    /// 实体列表
    pub entities: Vec<CodeEntity>,

    /// 扫描统计
    pub stats: ScanStats,
}

/// 实体元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    /// 项目路径
    pub project_path: String,

    /// 扫描时间
    pub scan_time: String,

    /// 版本号
    pub version: String,

    /// 工具名称
    pub tool: String,
}

/// 文件扫描器
pub struct FileWalker {
    config: ScanConfig,
}

impl FileWalker {
    /// 创建新的文件扫描器
    pub fn new(config: ScanConfig) -> Self {
        Self { config }
    }

    /// 使用默认配置创建
    pub fn with_default() -> Self {
        Self::new(ScanConfig::default())
    }

    /// 保存实体到 JSON 文件
    ///
    /// # 参数
    /// - `entities`: 要保存的实体列表
    /// - `stats`: 扫描统计信息
    /// - `project_path`: 项目路径
    /// - `output_dir`: 输出目录（默认为 "src/data"）
    ///
    /// # 返回
    /// 返回保存的文件路径
    pub fn save_entities(
        &self,
        entities: Vec<CodeEntity>,
        stats: ScanStats,
        project_path: &str,
        output_dir: Option<&str>,
    ) -> Result<PathBuf> {
        // 1. 确定输出目录
        let output_dir = output_dir.unwrap_or("src/data");
        let output_path = Path::new(output_dir);

        // 2. 创建目录（如果不存在）
        if !output_path.exists() {
            fs::create_dir_all(output_path).context(format!("无法创建目录: {}", output_dir))?;
            println!("📁 创建输出目录: {}", output_dir);
        }

        // 3. 生成文件名（基于时间戳）
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let project_name = Path::new(project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("project");
        let filename = format!("entities_{}_{}.json", project_name, timestamp);
        let file_path = output_path.join(&filename);

        // 4. 构建保存数据
        let data = SavedEntityData {
            metadata: EntityMetadata {
                project_path: project_path.to_string(),
                scan_time: Utc::now().to_rfc3339(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                tool: "tauri-code-base-analyzer".to_string(),
            },
            entities,
            stats,
        };

        // 5. 序列化为 JSON
        let json = serde_json::to_string_pretty(&data).context("序列化实体数据失败")?;

        // 6. 写入文件
        fs::write(&file_path, json).context(format!("写入文件失败: {}", file_path.display()))?;

        println!("💾 实体数据已保存到: {}", file_path.display());
        println!("   - 实体数量: {}", data.entities.len());
        println!(
            "   - 文件大小: {} KB",
            fs::metadata(&file_path)?.len() / 1024
        );

        Ok(file_path)
    }

    /// 扫描并保存实体（一体化方法）
    ///
    /// 这是一个便捷方法，将扫描和保存组合在一起
    pub fn scan_and_save(
        &self,
        root_dir: &str,
        output_dir: Option<&str>,
    ) -> Result<(Vec<CodeEntity>, ScanStats, PathBuf)> {
        // 1. 扫描提取实体
        let (entities, stats) = self.extract_all_entities(root_dir)?;

        // 2. 保存到文件
        let file_path =
            self.save_entities(entities.clone(), stats.clone(), root_dir, output_dir)?;

        Ok((entities, stats, file_path))
    }

    /// 扫描目录并提取所有实体
    pub fn extract_all_entities(&self, root_dir: &str) -> Result<(Vec<CodeEntity>, ScanStats)> {
        let start_time = std::time::Instant::now();
        println!("🚀 开始从目录提取实体: {}", root_dir);

        let root_path = Path::new(root_dir);
        if !root_path.exists() {
            return Err(anyhow::anyhow!("目录不存在: {}", root_dir));
        }

        // 1. 查找所有要处理的文件
        let files = self.find_files(root_path)?;
        println!("📁 找到 {} 个文件", files.len());

        if files.is_empty() {
            return Ok((
                Vec::new(),
                ScanStats {
                    total_files: 0,
                    success_files: 0,
                    failed_files: 0,
                    total_entities: 0,
                    by_extension: HashMap::new(),
                    by_entity_type: HashMap::new(),
                    duration_ms: start_time.elapsed().as_millis(),
                },
            ));
        }

        // 2. 提取实体
        let mut all_entities = Vec::new();
        let mut success_count = 0;
        let mut failed_count = 0;
        let mut by_extension: HashMap<String, usize> = HashMap::new();

        for file in &files {
            match self.extract_from_file(file, root_dir) {
                Ok(entities) => {
                    let ext = file
                        .extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    *by_extension.entry(format!(".{}", ext)).or_insert(0) += 1;

                    all_entities.extend(entities);
                    success_count += 1;
                }
                Err(e) => {
                    eprintln!("⚠️  提取文件失败 {}: {}", file.display(), e);
                    failed_count += 1;
                }
            }
        }

        // 3. 统计实体类型
        let mut by_entity_type: HashMap<String, usize> = HashMap::new();
        for entity in &all_entities {
            *by_entity_type
                .entry(entity.entity_type.clone())
                .or_insert(0) += 1;
        }

        let duration_ms = start_time.elapsed().as_millis();

        let stats = ScanStats {
            total_files: files.len(),
            success_files: success_count,
            failed_files: failed_count,
            total_entities: all_entities.len(),
            by_extension,
            by_entity_type,
            duration_ms,
        };

        println!("\n⏱️  实体提取统计:");
        println!("  - 总文件数: {}", stats.total_files);
        println!("  - 成功提取: {}", stats.success_files);
        println!("  - 失败文件: {}", stats.failed_files);
        println!("  - 总实体数: {}", stats.total_entities);
        println!("  - 总耗时: {}ms", stats.duration_ms);
        println!("  - 平均耗时: {}ms/文件", duration_ms / files.len() as u128);

        Ok((all_entities, stats))
    }

    /// 查找所有符合条件的文件
    fn find_files(&self, root_dir: &Path) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();

        // 1. 检查是否有 workspace 配置
        if self.config.include_workspace {
            if let Some(workspace_info) = self.find_workspace_info(root_dir)? {
                println!(
                    "🏢 找到 workspace 配置，包含 {} 个包",
                    workspace_info.package_paths.len()
                );

                // 扫描所有 workspace 包
                for workspace_path in &workspace_info.package_paths {
                    self.scan_directory(workspace_path, &mut files)?;
                }

                // 扫描项目根目录的源码
                self.scan_project_root(root_dir, &mut files)?;

                return Ok(files);
            }
        }

        // 2. 如果没有 workspace 配置，直接扫描整个目录
        println!("📂 使用默认扫描模式");
        self.scan_directory(root_dir, &mut files)?;

        Ok(files)
    }

    /// 递归扫描目录
    fn scan_directory(&self, dir: &Path, results: &mut Vec<PathBuf>) -> Result<()> {
        let walker = WalkDir::new(dir)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                // 过滤掉要忽略的目录
                let file_name = e.file_name().to_string_lossy();
                !self
                    .config
                    .ignore_dirs
                    .iter()
                    .any(|ignore| file_name == ignore.as_str())
            });

        for entry in walker {
            match entry {
                Ok(entry) => {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            let ext_str = format!(".{}", ext.to_string_lossy());
                            if self.config.extensions.contains(&ext_str) {
                                println!("📄 找到文件: {}", path.display());
                                results.push(path.to_path_buf());
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("⚠️  扫描目录时出错: {}", e);
                }
            }
        }

        Ok(())
    }

    /// 扫描项目根目录的常见源码目录
    fn scan_project_root(&self, root_dir: &Path, results: &mut Vec<PathBuf>) -> Result<()> {
        let common_source_dirs = ["src", "lib", "app", "components", "pages", "views", "utils"];

        println!("📁 扫描项目根目录: {}", root_dir.display());

        // 扫描根目录的直接文件
        if let Ok(entries) = fs::read_dir(root_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        let ext_str = format!(".{}", ext.to_string_lossy());
                        if self.config.extensions.contains(&ext_str) {
                            println!("📄 根目录文件: {}", path.display());
                            results.push(path);
                        }
                    }
                }
            }
        }

        // 扫描常见的源码目录
        for source_dir in &common_source_dirs {
            let source_path = root_dir.join(source_dir);
            if source_path.exists() && source_path.is_dir() {
                println!("📂 扫描源码目录: {}", source_path.display());
                self.scan_directory(&source_path, results)?;
            }
        }

        Ok(())
    }

    /// 从单个文件提取实体
    fn extract_from_file(&self, file: &Path, root_dir: &str) -> Result<Vec<CodeEntity>> {
        let file_str = file.to_str().context("无法转换文件路径")?;

        if file_str.ends_with(".vue") {
            println!("📄 从 Vue 文件提取实体: {}", file_str);
            VueExtractor::new()
                .extract(file_str, root_dir)
                .map_err(|e| anyhow::anyhow!("Vue 提取失败: {}", e))
        } else if file_str.ends_with(".tsx") {
            println!("📄 从 TSX 文件提取实体: {}", file_str);
            TypeScriptExtractor::new(true)
                .map_err(|e| anyhow::anyhow!("创建 TSX 提取器失败: {}", e))?
                .extract(file_str, root_dir)
                .map_err(|e| anyhow::anyhow!("TSX 提取失败: {}", e))
        } else if file_str.ends_with(".ts") {
            println!("📄 从 TS 文件提取实体: {}", file_str);
            TypeScriptExtractor::new(false)
                .map_err(|e| anyhow::anyhow!("创建 TS 提取器失败: {}", e))?
                .extract(file_str, root_dir)
                .map_err(|e| anyhow::anyhow!("TS 提取失败: {}", e))
        } else {
            Err(anyhow::anyhow!("不支持的文件类型: {}", file_str))
        }
    }

    /// 查找 workspace 信息
    fn find_workspace_info(&self, root_dir: &Path) -> Result<Option<WorkspaceInfo>> {
        // 1. 查找 workspace 根目录
        let workspace_root = match self.find_workspace_root(root_dir)? {
            Some(root) => root,
            None => return Ok(None),
        };

        println!("🏢 找到 workspace 根目录: {}", workspace_root.display());

        // 2. 解析 workspace 配置
        let patterns = self.parse_workspace_patterns(&workspace_root)?;
        println!("📋 workspace 模式: {:?}", patterns);

        // 3. 解析模式为实际路径
        let mut package_paths = Vec::new();
        let mut package_map = HashMap::new();

        for pattern in &patterns {
            let paths = self.resolve_workspace_pattern(&workspace_root, pattern)?;
            for path in paths {
                // 读取 package.json 获取包名
                let package_json_path = path.join("package.json");
                if package_json_path.exists() {
                    if let Ok(content) = fs::read_to_string(&package_json_path) {
                        if let Ok(package_json) =
                            serde_json::from_str::<serde_json::Value>(&content)
                        {
                            if let Some(name) = package_json.get("name").and_then(|v| v.as_str()) {
                                package_map.insert(name.to_string(), path.clone());
                            }
                        }
                    }
                }
                package_paths.push(path);
            }
        }

        println!("📦 找到 {} 个 workspace 包", package_paths.len());

        Ok(Some(WorkspaceInfo {
            root: workspace_root,
            package_paths,
            package_map,
        }))
    }

    /// 查找 workspace 根目录
    fn find_workspace_root(&self, start_dir: &Path) -> Result<Option<PathBuf>> {
        let mut current_dir = start_dir.to_path_buf();

        loop {
            // 检查 pnpm-workspace.yaml
            if current_dir.join("pnpm-workspace.yaml").exists() {
                return Ok(Some(current_dir));
            }

            // 检查 package.json 的 workspaces 字段
            let package_json_path = current_dir.join("package.json");
            if package_json_path.exists() {
                if let Ok(content) = fs::read_to_string(&package_json_path) {
                    if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if package_json.get("workspaces").is_some() {
                            return Ok(Some(current_dir));
                        }
                    }
                }
            }

            // 向上一级目录
            match current_dir.parent() {
                Some(parent) => current_dir = parent.to_path_buf(),
                None => break,
            }
        }

        Ok(None)
    }

    /// 解析 workspace 模式配置
    fn parse_workspace_patterns(&self, workspace_root: &Path) -> Result<Vec<String>> {
        let mut patterns = Vec::new();

        // 1. 检查 pnpm-workspace.yaml
        let pnpm_workspace_path = workspace_root.join("pnpm-workspace.yaml");
        if pnpm_workspace_path.exists() {
            let content = fs::read_to_string(&pnpm_workspace_path)?;
            // 简单解析 YAML（仅支持 packages 列表）
            let mut in_packages = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed == "packages:" {
                    in_packages = true;
                    continue;
                }
                if in_packages {
                    if trimmed.starts_with('-') {
                        let pattern = trimmed
                            .trim_start_matches('-')
                            .trim()
                            .trim_matches('\'')
                            .trim_matches('"');
                        if !pattern.is_empty() {
                            patterns.push(pattern.to_string());
                            println!("  从 pnpm-workspace.yaml 解析到模式: {}", pattern);
                        }
                    } else if !trimmed.starts_with(' ') && trimmed.contains(':') {
                        // 遇到新的顶级配置，退出 packages 部分
                        break;
                    }
                }
            }
        }

        // 2. 检查 package.json 的 workspaces 字段
        let package_json_path = workspace_root.join("package.json");
        if package_json_path.exists() {
            let content = fs::read_to_string(&package_json_path)?;
            if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(workspaces) = package_json.get("workspaces") {
                    if let Some(array) = workspaces.as_array() {
                        for item in array {
                            if let Some(pattern) = item.as_str() {
                                patterns.push(pattern.to_string());
                                println!("  从 package.json 解析到模式: {}", pattern);
                            }
                        }
                    } else if let Some(obj) = workspaces.as_object() {
                        if let Some(packages) = obj.get("packages").and_then(|v| v.as_array()) {
                            for item in packages {
                                if let Some(pattern) = item.as_str() {
                                    patterns.push(pattern.to_string());
                                    println!("  从 package.json 解析到 packages 模式: {}", pattern);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. 如果没有找到任何模式，使用默认模式
        if patterns.is_empty() {
            patterns = vec![
                "packages/*".to_string(),
                "apps/*".to_string(),
                "libs/*".to_string(),
            ];
            println!("  使用默认 workspace 模式");
        }

        Ok(patterns)
    }

    /// 解析 workspace 模式为实际路径
    fn resolve_workspace_pattern(
        &self,
        workspace_root: &Path,
        pattern: &str,
    ) -> Result<Vec<PathBuf>> {
        let mut results = Vec::new();

        if pattern.contains('*') {
            // 处理通配符模式
            let parts: Vec<&str> = pattern.split('/').collect();
            let mut current_paths = vec![workspace_root.to_path_buf()];

            for part in parts {
                if part == "*" {
                    let mut new_paths = Vec::new();
                    for current_path in current_paths {
                        if let Ok(entries) = fs::read_dir(&current_path) {
                            for entry in entries.flatten() {
                                let entry_path = entry.path();
                                if entry_path.is_dir() {
                                    let dir_name =
                                        entry_path.file_name().unwrap().to_string_lossy();
                                    // 跳过要忽略的目录
                                    if !self.config.ignore_dirs.iter().any(|d| *d == dir_name) {
                                        new_paths.push(entry_path);
                                    }
                                }
                            }
                        }
                    }
                    current_paths = new_paths;
                } else {
                    current_paths = current_paths
                        .iter()
                        .map(|p| p.join(part))
                        .filter(|p| p.exists())
                        .collect();
                }
            }

            results.extend(current_paths);
        } else {
            // 直接路径
            let full_path = workspace_root.join(pattern);
            if full_path.exists() {
                results.push(full_path);
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_walker_basic() {
        let walker = FileWalker::with_default();
        let test_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        match walker.extract_all_entities(test_dir) {
            Ok((entities, stats)) => {
                println!("\n✅ 扫描完成!");
                println!("  实体总数: {}", entities.len());
                println!("  成功文件: {}", stats.success_files);
                println!("  失败文件: {}", stats.failed_files);
                println!("  耗时: {}ms", stats.duration_ms);

                println!("\n📊 按文件类型统计:");
                for (ext, count) in &stats.by_extension {
                    println!("  {}: {}", ext, count);
                }

                println!("\n📊 按实体类型统计:");
                for (entity_type, count) in &stats.by_entity_type {
                    println!("  {}: {}", entity_type, count);
                }

                assert!(!entities.is_empty());
                assert!(stats.success_files > 0);
            }
            Err(e) => panic!("扫描失败: {}", e),
        }
    }

    #[test]
    fn test_find_workspace_root() {
        let walker = FileWalker::with_default();
        let test_dir = "/Users/songdingan/dev/tauri-code-base-analyzer/src/test/after-sale-demo";

        match walker.find_workspace_root(Path::new(test_dir)) {
            Ok(Some(root)) => {
                println!("✅ 找到 workspace 根目录: {}", root.display());
            }
            Ok(None) => {
                println!("ℹ️  未找到 workspace 配置");
            }
            Err(e) => {
                println!("⚠️  查找失败: {}", e);
            }
        }
    }
}
