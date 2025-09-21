use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use regex::Regex;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CodeEntity {
    pub id: String,
    #[serde(rename = "type")]
    pub entity_type: String,
    pub file: String,
    pub loc: Option<LocationInfo>,
    #[serde(rename = "rawName")]
    pub raw_name: String,
    #[serde(rename = "isWorkspace")]
    pub is_workspace: bool,
    #[serde(rename = "isDDD")]
    pub is_ddd: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationInfo {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreciseAnalysisResult {
    pub entities: Vec<CodeEntity>,
    pub total_files: usize,
    pub total_entities: usize,
    pub analysis_timestamp: String,
    pub workspace_info: WorkspaceInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub root_directory: String,
    pub package_names: Vec<String>,
    pub package_paths: Vec<String>,
    pub is_monorepo: bool,
}

pub struct PreciseAnalyzer {
    // Vue相关正则
    vue_script_regex: Regex,
    vue_export_regex: Regex,
    vue_component_regex: Regex,
    vue_composable_regex: Regex,

    // TypeScript/JavaScript相关正则
    function_regex: Regex,
    class_regex: Regex,
    interface_regex: Regex,
    type_regex: Regex,
    const_regex: Regex,
    export_regex: Regex,
    import_regex: Regex,

    // 特殊模式
    ddd_import_regex: Regex,
}

impl PreciseAnalyzer {
    pub fn new() -> Self {
        Self {
            // Vue正则表达式
            vue_script_regex: Regex::new(r"<script[^>]*>[\s\S]*?</script>").unwrap(),
            vue_export_regex: Regex::new(r"export\s+default\s+\{").unwrap(),
            vue_component_regex: Regex::new(r"defineComponent\s*\(\s*\{").unwrap(),
            vue_composable_regex: Regex::new(r"export\s+(?:const|function)\s+use([A-Z]\w*)").unwrap(),

            // TypeScript/JavaScript正则表达式
            function_regex: Regex::new(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)").unwrap(),
            class_regex: Regex::new(r"(?:export\s+)?class\s+(\w+)").unwrap(),
            interface_regex: Regex::new(r"(?:export\s+)?interface\s+(\w+)").unwrap(),
            type_regex: Regex::new(r"(?:export\s+)?type\s+(\w+)").unwrap(),
            const_regex: Regex::new(r"(?:export\s+)?const\s+(\w+)").unwrap(),
            export_regex: Regex::new(r"export\s+\{([^}]+)\}").unwrap(),
            import_regex: Regex::new(r#"import\s+.*?from\s+['"]([^'"]+)['"]"#).unwrap(),

            // DDD检测
            ddd_import_regex: Regex::new(r#"from\s+['"]@xhs/di['"]|import\s+.*from\s+['"]@xhs/di['"]"#).unwrap(),
        }
    }

    /// 分析整个目录
    pub fn analyze_directory(&self, dir_path: &str) -> Result<PreciseAnalysisResult, Box<dyn std::error::Error>> {
        let start_time = Utc::now();
        println!("🚀 开始精确分析目录: {}", dir_path);

        // 获取工作区信息
        let workspace_info = self.get_workspace_info(dir_path)?;
        println!("📁 工作区信息: {} 个包", workspace_info.package_names.len());

        // 扫描文件
        let files = self.find_source_files(dir_path, &workspace_info)?;
        println!("📄 找到 {} 个源代码文件", files.len());

        // 分析文件
        let mut all_entities = Vec::new();
        for file_path in &files {
            match self.analyze_file(file_path, dir_path, &workspace_info) {
                Ok(mut entities) => {
                    all_entities.append(&mut entities);
                },
                Err(e) => {
                    eprintln!("⚠️ 分析文件失败 {}: {}", file_path, e);
                }
            }
        }

        // 确保ID唯一性
        let unique_entities = self.ensure_unique_ids(all_entities);

        let result = PreciseAnalysisResult {
            total_entities: unique_entities.len(),
            total_files: files.len(),
            entities: unique_entities,
            analysis_timestamp: start_time.to_rfc3339(),
            workspace_info,
        };

        println!("✅ 分析完成: {} 个实体", result.total_entities);
        Ok(result)
    }

    /// 获取工作区信息
    fn get_workspace_info(&self, dir_path: &str) -> Result<WorkspaceInfo, Box<dyn std::error::Error>> {
        let root_dir = Path::new(dir_path);
        let mut package_names = Vec::new();
        let mut package_paths = Vec::new();
        let mut is_monorepo = false;

        // 查找workspace根目录
        if let Some(workspace_root) = self.find_workspace_root(root_dir) {
            is_monorepo = true;
            println!("📦 找到工作区根目录: {}", workspace_root.display());

            // 读取当前项目的依赖
            let package_json_path = root_dir.join("package.json");
            if package_json_path.exists() {
                let content = fs::read_to_string(&package_json_path)?;
                if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                    self.collect_workspace_dependencies(&package_json, &mut package_names);
                }
            }

            // 找到workspace包的实际路径
            package_paths = self.resolve_workspace_packages(&workspace_root, &package_names)?;
        }

        Ok(WorkspaceInfo {
            root_directory: dir_path.to_string(),
            package_names,
            package_paths,
            is_monorepo,
        })
    }

    /// 查找workspace根目录
    fn find_workspace_root(&self, start_dir: &Path) -> Option<PathBuf> {
        let mut current_dir = start_dir.to_path_buf();

        loop {
            // 检查pnpm-workspace.yaml
            if current_dir.join("pnpm-workspace.yaml").exists() {
                return Some(current_dir);
            }

            // 检查package.json的workspaces字段
            if let Ok(content) = fs::read_to_string(current_dir.join("package.json")) {
                if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if package_json.get("workspaces").is_some() {
                        return Some(current_dir);
                    }
                }
            }

            if let Some(parent) = current_dir.parent() {
                current_dir = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }

    /// 收集workspace依赖
    fn collect_workspace_dependencies(&self, package_json: &serde_json::Value, package_names: &mut Vec<String>) {
        let deps_keys = ["dependencies", "devDependencies", "peerDependencies"];

        for key in &deps_keys {
            if let Some(deps) = package_json.get(key).and_then(|d| d.as_object()) {
                for (name, version) in deps {
                    if let Some(version_str) = version.as_str() {
                        if version_str.starts_with("workspace:") {
                            package_names.push(name.clone());
                        }
                    }
                }
            }
        }
    }

    /// 解析workspace包路径
    fn resolve_workspace_packages(&self, workspace_root: &Path, package_names: &[String]) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut package_paths = Vec::new();
        let patterns = self.get_workspace_patterns(workspace_root)?;

        for package_name in package_names {
            for pattern in &patterns {
                if let Some(path) = self.find_package_in_pattern(workspace_root, pattern, package_name)? {
                    package_paths.push(path);
                    break;
                }
            }
        }

        Ok(package_paths)
    }

    /// 获取workspace模式
    fn get_workspace_patterns(&self, workspace_root: &Path) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut patterns = Vec::new();

        // 检查pnpm-workspace.yaml
        let pnpm_workspace = workspace_root.join("pnpm-workspace.yaml");
        if pnpm_workspace.exists() {
            let content = fs::read_to_string(pnpm_workspace)?;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("- ") {
                    let pattern = trimmed[2..].trim_matches('"').trim_matches('\'');
                    patterns.push(pattern.to_string());
                }
            }
        }

        // 检查package.json workspaces
        let package_json_path = workspace_root.join("package.json");
        if package_json_path.exists() {
            let content = fs::read_to_string(package_json_path)?;
            if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(workspaces) = package_json.get("workspaces") {
                    if let Some(array) = workspaces.as_array() {
                        for item in array {
                            if let Some(pattern) = item.as_str() {
                                patterns.push(pattern.to_string());
                            }
                        }
                    } else if let Some(obj) = workspaces.as_object() {
                        if let Some(packages) = obj.get("packages").and_then(|p| p.as_array()) {
                            for item in packages {
                                if let Some(pattern) = item.as_str() {
                                    patterns.push(pattern.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        // 默认模式
        if patterns.is_empty() {
            patterns.extend([
                "packages/*".to_string(),
                "packages/*/*".to_string(),
                "apps/*".to_string(),
                "libs/*".to_string(),
            ]);
        }

        Ok(patterns)
    }

    /// 在模式中查找包
    fn find_package_in_pattern(&self, workspace_root: &Path, pattern: &str, package_name: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let paths = self.resolve_glob_pattern(workspace_root, pattern)?;

        for path in paths {
            let package_json = Path::new(&path).join("package.json");
            if package_json.exists() {
                let content = fs::read_to_string(package_json)?;
                if let Ok(pkg_json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(name) = pkg_json.get("name").and_then(|n| n.as_str()) {
                        if name == package_name {
                            return Ok(Some(path));
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    /// 解析glob模式
    fn resolve_glob_pattern(&self, workspace_root: &Path, pattern: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut results = Vec::new();

        if pattern.contains('*') {
            let parts: Vec<&str> = pattern.split('/').collect();
            let mut current_paths = vec![workspace_root.to_path_buf()];

            for part in parts {
                if part == "*" {
                    let mut new_paths = Vec::new();
                    for current_path in current_paths {
                        if let Ok(entries) = fs::read_dir(&current_path) {
                            for entry in entries.flatten() {
                                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                                    let name = entry.file_name();
                                    let name_str = name.to_string_lossy();
                                    if !name_str.starts_with('.') && !["node_modules", "dist", "build"].contains(&name_str.as_ref()) {
                                        new_paths.push(entry.path());
                                    }
                                }
                            }
                        }
                    }
                    current_paths = new_paths;
                } else {
                    current_paths = current_paths.into_iter()
                        .map(|p| p.join(part))
                        .filter(|p| p.exists() && p.is_dir())
                        .collect();
                }
            }

            results.extend(current_paths.into_iter().map(|p| p.to_string_lossy().to_string()));
        } else {
            let path = workspace_root.join(pattern);
            if path.exists() && path.is_dir() {
                results.push(path.to_string_lossy().to_string());
            }
        }

        Ok(results)
    }

    /// 查找源代码文件
    fn find_source_files(&self, dir_path: &str, workspace_info: &WorkspaceInfo) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        let extensions = [".vue", ".ts", ".tsx", ".js", ".jsx"];

        // 扫描主项目目录
        self.scan_directory(dir_path, &extensions, &mut files)?;

        // 扫描workspace包
        for package_path in &workspace_info.package_paths {
            self.scan_directory(package_path, &extensions, &mut files)?;
        }

        Ok(files)
    }

    /// 扫描目录
    fn scan_directory(&self, dir_path: &str, extensions: &[&str], files: &mut Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
        let path = Path::new(dir_path);
        if !path.exists() || !path.is_dir() {
            return Ok(());
        }

        self.scan_directory_recursive(path, extensions, files, 0)?;
        Ok(())
    }

    /// 递归扫描目录
    fn scan_directory_recursive(&self, dir: &Path, extensions: &[&str], files: &mut Vec<String>, depth: usize) -> Result<(), Box<dyn std::error::Error>> {
        if depth > 10 {  // 限制递归深度
            return Ok(());
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name();
                let name_str = name.to_string_lossy();

                // 跳过不需要的目录
                if name_str.starts_with('.') || ["node_modules", "dist", "build", "coverage", "tmp"].contains(&name_str.as_ref()) {
                    continue;
                }

                if path.is_dir() {
                    self.scan_directory_recursive(&path, extensions, files, depth + 1)?;
                } else if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy();
                    if extensions.iter().any(|&e| e == format!(".{}", ext_str)) {
                        files.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }

        Ok(())
    }

    /// 分析单个文件
    fn analyze_file(&self, file_path: &str, root_dir: &str, workspace_info: &WorkspaceInfo) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let path = Path::new(file_path);
        let relative_path = Path::new(file_path).strip_prefix(root_dir)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        let is_workspace = self.is_workspace_file(file_path, root_dir, workspace_info);
        let is_ddd = self.ddd_import_regex.is_match(&content);

        let mut entities = Vec::new();

        if file_path.ends_with(".vue") {
            entities.extend(self.analyze_vue_file(&content, &relative_path, is_workspace, is_ddd)?);
        } else if file_path.ends_with(".ts") || file_path.ends_with(".tsx") || file_path.ends_with(".js") || file_path.ends_with(".jsx") {
            entities.extend(self.analyze_typescript_file(&content, &relative_path, is_workspace, is_ddd)?);
        }

        Ok(entities)
    }

    /// 分析Vue文件
    fn analyze_vue_file(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let mut entities = Vec::new();

        // 提取<script>标签内容
        if let Some(script_match) = self.vue_script_regex.find(content) {
            let script_content = script_match.as_str();

            // Vue组件默认导出
            if self.vue_export_regex.is_match(script_content) || self.vue_component_regex.is_match(script_content) {
                let component_name = Path::new(file_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                entities.push(CodeEntity {
                    id: format!("Component:{}", component_name),
                    entity_type: "component".to_string(),
                    file: file_path.to_string(),
                    loc: Some(LocationInfo { start: 1, end: content.lines().count() as u32 }),
                    raw_name: component_name,
                    is_workspace,
                    is_ddd,
                });
            }

            // Vue composables
            for cap in self.vue_composable_regex.captures_iter(script_content) {
                if let Some(name) = cap.get(1) {
                    entities.push(CodeEntity {
                        id: format!("Composable:use{}", name.as_str()),
                        entity_type: "composable".to_string(),
                        file: file_path.to_string(),
                        loc: None,
                        raw_name: format!("use{}", name.as_str()),
                        is_workspace,
                        is_ddd,
                    });
                }
            }

            // 分析script内的其他实体
            entities.extend(self.analyze_typescript_content(script_content, file_path, is_workspace, is_ddd)?);
        }

        Ok(entities)
    }

    /// 分析TypeScript文件
    fn analyze_typescript_file(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        self.analyze_typescript_content(content, file_path, is_workspace, is_ddd)
    }

    /// 分析TypeScript内容
    fn analyze_typescript_content(&self, content: &str, file_path: &str, is_workspace: bool, is_ddd: bool) -> Result<Vec<CodeEntity>, Box<dyn std::error::Error>> {
        let mut entities = Vec::new();

        // 函数
        for cap in self.function_regex.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                entities.push(CodeEntity {
                    id: format!("Function:{}", name.as_str()),
                    entity_type: "function".to_string(),
                    file: file_path.to_string(),
                    loc: None,
                    raw_name: name.as_str().to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 类
        for cap in self.class_regex.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                entities.push(CodeEntity {
                    id: format!("Class:{}", name.as_str()),
                    entity_type: "class".to_string(),
                    file: file_path.to_string(),
                    loc: None,
                    raw_name: name.as_str().to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 接口
        for cap in self.interface_regex.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                entities.push(CodeEntity {
                    id: format!("Interface:{}", name.as_str()),
                    entity_type: "interface".to_string(),
                    file: file_path.to_string(),
                    loc: None,
                    raw_name: name.as_str().to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 类型定义
        for cap in self.type_regex.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                entities.push(CodeEntity {
                    id: format!("Type:{}", name.as_str()),
                    entity_type: "type".to_string(),
                    file: file_path.to_string(),
                    loc: None,
                    raw_name: name.as_str().to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        // 常量
        for cap in self.const_regex.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                entities.push(CodeEntity {
                    id: format!("Const:{}", name.as_str()),
                    entity_type: "const".to_string(),
                    file: file_path.to_string(),
                    loc: None,
                    raw_name: name.as_str().to_string(),
                    is_workspace,
                    is_ddd,
                });
            }
        }

        Ok(entities)
    }

    /// 判断是否是workspace文件
    fn is_workspace_file(&self, file_path: &str, root_dir: &str, workspace_info: &WorkspaceInfo) -> bool {
        let relative_path = Path::new(file_path).strip_prefix(root_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // 检查是否在workspace包路径中
        for package_path in &workspace_info.package_paths {
            if file_path.starts_with(package_path) {
                return true;
            }
        }

        // 检查路径模式
        relative_path.starts_with("packages/") ||
        relative_path.starts_with("apps/") ||
        relative_path.starts_with("libs/") ||
        relative_path.starts_with("modules/")
    }

    /// 确保ID唯一性
    fn ensure_unique_ids(&self, entities: Vec<CodeEntity>) -> Vec<CodeEntity> {
        let mut id_counts: HashMap<String, usize> = HashMap::new();
        let mut result = Vec::new();

        for mut entity in entities {
            let count = id_counts.entry(entity.id.clone()).or_insert(0);

            if *count > 0 {
                entity.id = format!("{}_{}", entity.id, *count);
            }

            *count += 1;
            result.push(entity);
        }

        result
    }
}