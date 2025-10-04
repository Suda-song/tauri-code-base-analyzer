/// MCP Agent 示例
///
/// 使用官方 SDK + MCP 工具进行代码分析
use std::io::Write;
use std::process::{Command, Stdio};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("🤖 MCP Agent 代码分析示例");
    println!("{}", "=".repeat(60));

    // 1. 测试项目路径
    let project_path = "/Users/songdingan/dev/aurora/packages/fulfillment/fulfillment-order-moon";

    println!("\n📂 项目路径: {}", project_path);

    // 2. 准备请求
    let request = serde_json::json!({
        "prompt": format!(
            "请分析这个Vue项目的代码结构：\n\
             1. 先使用 scan_project 工具扫描项目\n\
             2. 统计有多少个组件、函数、变量\n\
             3. 给出项目的整体概览\n\
             \n\
             项目路径: {}",
            project_path
        ),
        "workspace": project_path,
        "max_turns": 15,
        "permission_mode": "bypassPermissions"
    });

    println!("\n📝 任务描述:");
    println!("   - 扫描项目并提取代码实体");
    println!("   - 统计各类型实体数量");
    println!("   - 生成项目概览报告\n");

    // 3. 调用 Node.js Bridge
    println!("🚀 启动 MCP Agent Bridge...\n");

    let mut child = Command::new("node")
        .arg("scripts/dist/mcp-agent-bridge.js")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()?;

    // 4. 发送请求
    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(serde_json::to_string(&request)?.as_bytes())?;
    child.stdin.take(); // 关闭 stdin

    // 5. 等待完成
    println!("⏳ 等待 AI 分析...\n");
    let output = child.wait_with_output()?;

    // 6. 解析响应
    if !output.status.success() {
        eprintln!("❌ Bridge 执行失败");
        return Err("Bridge 执行失败".into());
    }

    let response: serde_json::Value = serde_json::from_slice(&output.stdout)?;

    // 7. 显示结果
    println!("\n{}", "=".repeat(60));
    println!("✅ 分析完成!");
    println!("{}", "=".repeat(60));

    if let Some(content) = response["content"].as_str() {
        println!("\n📊 AI 分析报告:\n");
        println!("{}", content);
    }

    println!("\n{}", "=".repeat(60));
    println!("📈 统计信息:");
    println!("   对话轮数: {}", response["turn_count"]);
    println!("   总 Token: {}", response["agent_info"]["total_tokens"]);
    println!("   模型: {}", response["agent_info"]["model"]);

    if let Some(tools) = response["tool_uses"].as_array() {
        println!("\n🔧 使用的工具:");
        for tool in tools {
            println!("   - {}", tool["tool"]);
        }
    }

    println!("{}", "=".repeat(60));

    Ok(())
}
