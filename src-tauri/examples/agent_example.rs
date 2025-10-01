// 使用原生 Tool Use API 的 Agent 示例
// 运行: cargo run --example agent_example
// 需要设置: export ANTHROPIC_API_KEY="your-key"

use tauri_code_base_analyzer::agent_core::{ClaudeAgent, AgentQuery};
use tauri_code_base_analyzer::tool_execution::system::BashTool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🤖 Claude Agent with Native Tool Use API");
    println!("========================================\n");

    // 检查 API Key
    if std::env::var("ANTHROPIC_API_KEY").is_err() {
        eprintln!("❌ 错误: ANTHROPIC_API_KEY 环境变量未设置");
        eprintln!("\n请设置 API Key:");
        eprintln!("  export ANTHROPIC_API_KEY='your-key-here'");
        std::process::exit(1);
    }

    // 创建 Agent
    println!("📝 创建 Agent...");
    let mut agent = ClaudeAgent::new()?;
    
    // 注册 Bash 工具
    println!("🔧 注册 Bash 工具...");
    agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));
    
    println!("\n✅ Agent 已准备好！\n");

    // 示例 1: 简单查询（无工具）
    println!("═══════════════════════════════════════");
    println!("示例 1: 简单查询（无工具）");
    println!("═══════════════════════════════════════\n");
    
    let response = agent.simple_query("用一句话介绍 Rust 编程语言".to_string()).await?;
    println!("📄 回复: {}\n", response);

    // 示例 2: 使用工具
    println!("═══════════════════════════════════════");
    println!("示例 2: 使用 Bash 工具");
    println!("═══════════════════════════════════════\n");
    
    let query = AgentQuery {
        prompt: "使用 bash 工具列出 /tmp 目录的内容，并告诉我有多少个文件".to_string(),
        system_prompt: None,
        max_tokens: Some(2048),
    };
    
    let response = agent.query(query).await?;
    
    println!("\n📄 最终回复:\n{}", response.content);
    println!("\n🔧 使用的工具: {:?}", response.tools_used);
    
    if response.success {
        println!("\n✅ 任务成功完成！");
    } else {
        println!("\n⚠️ 任务未完全完成");
        if let Some(error) = response.error {
            println!("   错误: {}", error);
        }
    }

    println!("\n📚 对话历史: {} 条消息", agent.get_history().len());

    Ok(())
}
