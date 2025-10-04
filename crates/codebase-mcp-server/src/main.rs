//! Codebase MCP 服务器
//!
//! 提供代码分析工具，通过 MCP 协议与 Claude Agent SDK 通信

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use tauri_code_base_analyzer::tool_execution::codebase::{
    EnrichmentConfig, EnrichmentOrchestrator, FileWalker,
};

/// MCP 协议请求
#[derive(Debug, Deserialize)]
struct McpRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

/// MCP 协议响应
#[derive(Debug, Serialize)]
struct McpResponse {
    jsonrpc: String,
    id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<McpError>,
}

#[derive(Debug, Serialize)]
struct McpError {
    code: i32,
    message: String,
}

/// 工具定义
#[derive(Debug, Serialize)]
struct Tool {
    name: String,
    description: String,
    input_schema: Value,
}

fn get_tools() -> Vec<Tool> {
    vec![
        Tool {
            name: "scan_project".to_string(),
            description: "扫描项目目录，提取所有代码实体（Vue组件、TypeScript函数/类等）".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "项目根目录的绝对路径"
                    },
                    "extensions": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "要扫描的文件扩展名，默认 ['.ts', '.tsx', '.vue']",
                        "default": [".ts", ".tsx", ".vue"]
                    }
                },
                "required": ["project_path"]
            }),
        },
        Tool {
            name: "analyze_entity".to_string(),
            description: "分析特定代码实体的依赖关系、调用关系和事件".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "实体ID，格式如 'Component:Header' 或 'Function:getUserData'"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "项目根目录路径"
                    }
                },
                "required": ["entity_id", "project_path"]
            }),
        },
        Tool {
            name: "enrich_code".to_string(),
            description: "使用LLM为代码生成简洁的摘要和标签，适合批量处理".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "entities_json_path": {
                        "type": "string",
                        "description": "实体JSON文件的绝对路径（由 scan_project 生成）"
                    },
                    "output_path": {
                        "type": "string",
                        "description": "富化后输出的JSON文件路径，默认为 'entities.enriched.json'"
                    },
                    "concurrency": {
                        "type": "number",
                        "description": "并发数，默认为5",
                        "default": 5
                    }
                },
                "required": ["entities_json_path"]
            }),
        },
    ]
}

#[tokio::main]
async fn main() -> Result<()> {
    eprintln!("🚀 Codebase MCP 服务器启动");
    eprintln!("📡 监听 stdio 协议...\n");

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        // 解析请求
        let request: McpRequest = match serde_json::from_str(&line) {
            Ok(req) => req,
            Err(e) => {
                eprintln!("❌ 解析请求失败: {}", e);
                continue;
            }
        };

        eprintln!("📥 收到请求: method={}", request.method);

        // 处理请求
        let response = handle_request(request).await;

        // 发送响应
        let response_json = serde_json::to_string(&response)?;
        writeln!(stdout, "{}", response_json)?;
        stdout.flush()?;

        eprintln!("📤 发送响应\n");
    }

    Ok(())
}

async fn handle_request(request: McpRequest) -> McpResponse {
    match request.method.as_str() {
        "initialize" => McpResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: Some(json!({
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "codebase-analyzer",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {}
                }
            })),
            error: None,
        },

        "tools/list" => McpResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: Some(json!({
                "tools": get_tools()
            })),
            error: None,
        },

        "tools/call" => {
            let params = request.params.unwrap_or_default();
            let tool_name = params["name"].as_str().unwrap_or("");
            let arguments = &params["arguments"];

            match execute_tool(tool_name, arguments).await {
                Ok(result) => McpResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: Some(json!({
                        "content": [{
                            "type": "text",
                            "text": serde_json::to_string_pretty(&result).unwrap()
                        }]
                    })),
                    error: None,
                },
                Err(e) => McpResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: None,
                    error: Some(McpError {
                        code: -32000,
                        message: format!("工具执行失败: {}", e),
                    }),
                },
            }
        }

        _ => McpResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: None,
            error: Some(McpError {
                code: -32601,
                message: format!("未知方法: {}", request.method),
            }),
        },
    }
}

async fn execute_tool(tool_name: &str, arguments: &Value) -> Result<Value> {
    eprintln!("🔧 执行工具: {}", tool_name);

    match tool_name {
        "scan_project" => {
            let project_path = arguments["project_path"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("缺少 project_path 参数"))?;

            eprintln!("📂 扫描项目: {}", project_path);

            let walker = FileWalker::with_default();
            let (entities, stats, file_path) = walker
                .scan_and_save(project_path, Some("src/data"))
                .map_err(|e| anyhow::anyhow!("扫描失败: {}", e))?;

            eprintln!("✅ 扫描完成: {} 个实体", entities.len());

            Ok(json!({
                "success": true,
                "entities_count": entities.len(),
                "stats": {
                    "total_files": stats.total_files,
                    "success_files": stats.success_files,
                    "failed_files": stats.failed_files,
                    "duration_ms": stats.duration_ms,
                    "by_extension": stats.by_extension,
                    "by_entity_type": stats.by_entity_type
                },
                "output_file": file_path.to_string_lossy().to_string()
            }))
        }

        "analyze_entity" => {
            let entity_id = arguments["entity_id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("缺少 entity_id 参数"))?;
            let project_path = arguments["project_path"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("缺少 project_path 参数"))?;

            eprintln!("🔍 分析实体: {}", entity_id);

            // TODO: 实现实体分析逻辑
            // 这里需要加载实体，然后使用 StaticAnalyzer 分析

            Ok(json!({
                "success": true,
                "message": "实体分析功能待实现",
                "entity_id": entity_id
            }))
        }

        "enrich_code" => {
            let entities_json_path = arguments["entities_json_path"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("缺少 entities_json_path 参数"))?;
            let output_path = arguments["output_path"]
                .as_str()
                .unwrap_or("entities.enriched.json");
            let concurrency = arguments["concurrency"].as_u64().unwrap_or(5) as usize;

            eprintln!("✨ 富化代码: {} (并发: {})", entities_json_path, concurrency);

            // 提取项目根目录
            let project_path = std::path::Path::new(entities_json_path)
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .ok_or_else(|| anyhow::anyhow!("无法推断项目路径"))?;

            let config = EnrichmentConfig {
                concurrency,
                max_retries: 3,
                retry_delay: 1000,
                input_path: entities_json_path.to_string(),
                output_path: output_path.to_string(),
                pre_initialize: false,
            };

            let mut orchestrator = EnrichmentOrchestrator::new(
                project_path.to_string_lossy().to_string(),
                Some(config),
                None,
            );

            let enriched_path = orchestrator
                .run()
                .await
                .map_err(|e| anyhow::anyhow!("富化失败: {}", e))?;

            eprintln!("✅ 富化完成: {}", enriched_path);

            Ok(json!({
                "success": true,
                "output_file": enriched_path
            }))
        }

        _ => Err(anyhow::anyhow!("未知工具: {}", tool_name)),
    }
}

