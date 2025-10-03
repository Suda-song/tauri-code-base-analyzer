# 实体保存功能使用指南

## 📝 功能说明

`FileWalker` 现在支持将扫描提取的代码实体保存为 JSON 文件，方便后续分析、查询和可视化。

## 🚀 使用方法

### 方法 1: 一键扫描并保存

```rust
use crate::tool_execution::codebase::FileWalker;

fn main() {
    let walker = FileWalker::with_default();

    // 一键完成扫描和保存
    let (entities, stats, file_path) = walker
        .scan_and_save(
            "/path/to/project",  // 项目路径
            Some("src/data")     // 输出目录（可选，默认为 "src/data"）
        )
        .expect("扫描失败");

    println!("✅ 已保存到: {}", file_path.display());
    println!("   实体数量: {}", entities.len());
}
```

### 方法 2: 分步操作

```rust
use crate::tool_execution::codebase::FileWalker;

fn main() {
    let walker = FileWalker::with_default();

    // 步骤 1: 扫描提取实体
    let (entities, stats) = walker
        .extract_all_entities("/path/to/project")
        .expect("扫描失败");

    println!("扫描完成: {} 个实体", entities.len());

    // 步骤 2: 保存到文件
    let file_path = walker
        .save_entities(
            entities,              // 实体列表
            stats,                 // 统计信息
            "/path/to/project",    // 项目路径
            Some("src/data")       // 输出目录
        )
        .expect("保存失败");

    println!("✅ 已保存到: {}", file_path.display());
}
```

### 方法 3: 自定义输出目录

```rust
// 保存到项目根目录下的 output 文件夹
let (_, _, file_path) = walker
    .scan_and_save("/path/to/project", Some("output"))
    .expect("扫描失败");

// 使用默认目录 (src/data)
let (_, _, file_path) = walker
    .scan_and_save("/path/to/project", None)
    .expect("扫描失败");
```

## 📄 JSON 文件结构

保存的 JSON 文件包含以下内容：

```json
{
  "metadata": {
    "project_path": "/Users/xxx/project",
    "scan_time": "2025-10-01T13:01:53+08:00",
    "version": "0.1.0",
    "tool": "tauri-code-base-analyzer"
  },
  "entities": [
    {
      "id": "component:default",
      "entity_type": "component",
      "file": "src/App.vue",
      "raw_name": "default",
      "loc": {
        "start_line": 7,
        "end_line": 7
      }
    },
    {
      "id": "function:useAfterSaleStore",
      "entity_type": "function",
      "file": "src/stores/afterSale.ts",
      "raw_name": "useAfterSaleStore",
      "loc": {
        "start_line": 6,
        "end_line": 19
      }
    }
    // ... 更多实体
  ],
  "stats": {
    "total_files": 18,
    "success_files": 18,
    "failed_files": 0,
    "total_entities": 12,
    "by_extension": {
      ".vue": 7,
      ".ts": 8,
      ".tsx": 3
    },
    "by_entity_type": {
      "component": 3,
      "function": 8,
      "variable": 1
    },
    "duration_ms": 143
  }
}
```

### 字段说明

#### metadata（元数据）

- `project_path`: 项目的绝对路径
- `scan_time`: 扫描时间（ISO 8601 格式）
- `version`: 工具版本号
- `tool`: 工具名称

#### entities（实体列表）

- `id`: 实体的唯一标识符
- `entity_type`: 实体类型（component/function/class/variable 等）
- `file`: 文件的相对路径
- `raw_name`: 实体的原始名称
- `loc.start_line`: 起始行号
- `loc.end_line`: 结束行号

#### stats（统计信息）

- `total_files`: 扫描的文件总数
- `success_files`: 成功提取的文件数
- `failed_files`: 提取失败的文件数
- `total_entities`: 实体总数
- `by_extension`: 按文件类型统计
- `by_entity_type`: 按实体类型统计
- `duration_ms`: 总耗时（毫秒）

## 📂 文件命名规则

保存的文件名格式为：`entities_{项目名}_{时间戳}.json`

示例：

- `entities_after-sale-demo_20251001_130153.json`
- `entities_my-project_20251001_140530.json`

## 🎯 使用场景

### 1. 代码分析

```bash
# 保存实体后，可以使用 jq 等工具进行分析
cat src/data/entities_*.json | jq '.stats'
```

### 2. 数据导入

```rust
// 读取保存的实体数据
use std::fs;
use crate::tool_execution::codebase::SavedEntityData;

let json = fs::read_to_string("src/data/entities_xxx.json")?;
let data: SavedEntityData = serde_json::from_str(&json)?;

println!("项目: {}", data.metadata.project_path);
println!("实体数量: {}", data.entities.len());
```

### 3. 版本对比

```rust
// 对比两次扫描的差异
let data_v1: SavedEntityData = serde_json::from_str(&old_json)?;
let data_v2: SavedEntityData = serde_json::from_str(&new_json)?;

let added = data_v2.entities.len() - data_v1.entities.len();
println!("新增实体: {} 个", added);
```

### 4. 数据可视化

```typescript
// 在前端使用保存的 JSON 数据
import entitiesData from "@/data/entities_xxx.json";

// 统计各类型实体数量
const stats = entitiesData.stats.by_entity_type;

// 绘制图表
<Chart data={stats} />;
```

## 🔧 完整示例

### 命令行工具

```rust
// main.rs
use std::env;
use crate::tool_execution::codebase::FileWalker;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("用法: {} <项目路径> [输出目录]", args[0]);
        return;
    }

    let project_path = &args[1];
    let output_dir = args.get(2).map(|s| s.as_str());

    println!("🔍 扫描项目: {}", project_path);

    let walker = FileWalker::with_default();
    match walker.scan_and_save(project_path, output_dir) {
        Ok((entities, stats, file_path)) => {
            println!("\n✅ 扫描完成!");
            println!("  实体总数: {}", entities.len());
            println!("  耗时: {}ms", stats.duration_ms);
            println!("  保存到: {}", file_path.display());
        }
        Err(e) => {
            eprintln!("❌ 扫描失败: {}", e);
        }
    }
}
```

运行：

```bash
# 使用默认输出目录
cargo run -- /path/to/project

# 指定输出目录
cargo run -- /path/to/project output/entities
```

### 批量处理

```rust
use crate::tool_execution::codebase::FileWalker;
use std::path::Path;

fn scan_multiple_projects(projects: Vec<&str>) {
    let walker = FileWalker::with_default();

    for project in projects {
        println!("🔍 扫描: {}", project);

        match walker.scan_and_save(project, Some("data/entities")) {
            Ok((_, stats, path)) => {
                println!("  ✅ 完成: {} 个实体", stats.total_entities);
                println!("  💾 保存到: {}", path.display());
            }
            Err(e) => {
                eprintln!("  ❌ 失败: {}", e);
            }
        }

        println!();
    }
}

fn main() {
    let projects = vec![
        "/path/to/project1",
        "/path/to/project2",
        "/path/to/project3",
    ];

    scan_multiple_projects(projects);
}
```

## 📊 输出示例

```
🚀 开始从目录提取实体: /path/to/project
📂 使用默认扫描模式
📁 找到 18 个文件
📄 从 Vue 文件提取实体: /path/to/App.vue
📄 从 TS 文件提取实体: /path/to/main.ts
...

⏱️  实体提取统计:
  - 总文件数: 18
  - 成功提取: 18
  - 失败文件: 0
  - 总实体数: 12
  - 总耗时: 143ms
  - 平均耗时: 7ms/文件

📁 创建输出目录: src/data
💾 实体数据已保存到: src/data/entities_project_20251001_130153.json
   - 实体数量: 12
   - 文件大小: 3 KB
```

## 💡 提示

1. **目录自动创建**：如果输出目录不存在，会自动创建
2. **文件名唯一**：使用时间戳确保文件名唯一，不会覆盖旧文件
3. **相对路径**：实体中的文件路径是相对于项目根目录的
4. **格式化输出**：JSON 使用 pretty print 格式，便于阅读
5. **数据完整性**：包含元数据和统计信息，方便后续分析

## 🔗 相关 API

### FileWalker 方法

```rust
// 扫描并保存（推荐）
pub fn scan_and_save(
    &self,
    root_dir: &str,
    output_dir: Option<&str>,
) -> Result<(Vec<CodeEntity>, ScanStats, PathBuf)>

// 仅保存（如果已经扫描过）
pub fn save_entities(
    &self,
    entities: Vec<CodeEntity>,
    stats: ScanStats,
    project_path: &str,
    output_dir: Option<&str>,
) -> Result<PathBuf>
```

### 数据类型

```rust
// 保存的数据结构
pub struct SavedEntityData {
    pub metadata: EntityMetadata,
    pub entities: Vec<CodeEntity>,
    pub stats: ScanStats,
}

// 元数据
pub struct EntityMetadata {
    pub project_path: String,
    pub scan_time: String,
    pub version: String,
    pub tool: String,
}
```

## 🧪 测试

运行测试：

```bash
cd src-tauri

# 运行保存功能测试
cargo test example_scan_project -- --nocapture
cargo test example_scan_then_save -- --nocapture
```

---

**最后更新**: 2025-10-01  
**版本**: 0.1.0
