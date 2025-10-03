// 交互式 Claude Agent 示例
// 运行: cargo run --example agent_example
// 需要先启动 claude-code-router: ./setup-router.sh

use tauri_code_base_analyzer::agent_core::{ClaudeAgent, AgentQuery};
use tauri_code_base_analyzer::tool_execution::system::BashTool;
use std::io::{self, Write};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  🤖 Claude Agent 交互式对话                          ║");
    println!("╚══════════════════════════════════════════════════════╝");
    println!();

    // 检查代理服务器
    print!("🔍 检查代理服务器... ");
    io::stdout().flush()?;
    
    let health_check = reqwest::get("http://localhost:3456/health").await;
    if health_check.is_err() {
        println!("❌");
        eprintln!("\n❌ 错误: 代理服务器未运行");
        eprintln!("\n请先在另一个终端启动:");
        eprintln!("  ./setup-router.sh");
        eprintln!("\n然后在本终端重新运行此程序");
        std::process::exit(1);
    }
    println!("✅");

    // 创建 Agent
    print!("📝 初始化 Agent... ");
    io::stdout().flush()?;
    let mut agent = ClaudeAgent::new()?;
    println!("✅");
    
    // 注册工具
    print!("🔧 注册 Bash 工具... ");
    io::stdout().flush()?;
    agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));
    println!("✅");
    
    println!();
    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  ✨ Agent 已准备就绪！                               ║");
    println!("╚══════════════════════════════════════════════════════╝");
    println!();
    println!("💡 使用说明:");
    println!("   - 输入你的问题，按回车发送");
    println!("   - 输入 'exit' 或 'quit' 退出");
    println!("   - 输入 'clear' 清空对话历史");
    println!("   - 输入 'help' 查看帮助");
    println!();
    println!("╭──────────────────────────────────────────────────────╮");
    println!("│  示例问题:                                           │");
    println!("│  • 用一句话介绍 Rust                                 │");
    println!("│  • 使用 bash 列出 /tmp 目录的内容                    │");
    println!("│  • 帮我写一个 Python 的 hello world                  │");
    println!("╰──────────────────────────────────────────────────────╯");
    println!();

    let mut conversation_count = 0;

    loop {
        // 显示提示符
        print!("\n\x1b[36m你\x1b[0m > ");
        io::stdout().flush()?;

        // 读取用户输入
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        // 处理命令
        match input.to_lowercase().as_str() {
            "" => continue,
            "exit" | "quit" => {
                println!("\n👋 再见！");
                break;
            }
            "clear" => {
                agent.clear_history();
                conversation_count = 0;
                println!("\n✅ 对话历史已清空");
                continue;
            }
            "help" => {
                println!("\n╭──────────────────────────────────────────────────────╮");
                println!("│  📚 可用命令:                                        │");
                println!("│  • exit/quit - 退出程序                              │");
                println!("│  • clear     - 清空对话历史                          │");
                println!("│  • help      - 显示此帮助                            │");
                println!("╰──────────────────────────────────────────────────────╯");
                continue;
            }
            _ => {}
        }

        conversation_count += 1;

        // 显示 AI 正在思考
        println!("\n\x1b[32mAI\x1b[0m > \x1b[90m正在思考...\x1b[0m");

        // 发送查询
        let query = AgentQuery {
            prompt: input.to_string(),
            system_prompt: Some("你是一个友好、有帮助的 AI 助手。请用简洁明了的中文回答问题。".to_string()),
            max_tokens: Some(4096),
        };

        match agent.query(query).await {
            Ok(response) => {
                // 清除"正在思考"的行
                print!("\x1b[1A\x1b[2K");
                
                // 显示 AI 回复
                println!("\x1b[32mAI\x1b[0m > {}", response.content);

                // 如果使用了工具，显示工具信息
                if !response.tools_used.is_empty() {
                    println!("\n   \x1b[90m🔧 使用的工具: {:?}\x1b[0m", response.tools_used);
                }

                // 显示对话轮数
                if conversation_count > 0 {
                    println!("\n   \x1b[90m📊 对话轮数: {}\x1b[0m", conversation_count);
                }
            }
            Err(e) => {
                // 清除"正在思考"的行
                print!("\x1b[1A\x1b[2K");
                
                println!("\x1b[32mAI\x1b[0m > \x1b[31m❌ 错误: {}\x1b[0m", e);
                println!("\n   \x1b[90m💡 提示: 检查代理服务器是否正常运行\x1b[0m");
            }
        }
    }

    Ok(())
}
