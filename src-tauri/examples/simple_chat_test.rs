/// 多轮对话测试
///
/// 测试 Claude Agent SDK 的多轮对话能力
/// 验证请求是否被正确代理到 claude-code-router -> DeerAPI
use std::io::{self, Write};
use std::process::{Command, Stdio};

fn send_message(
    prompt: &str,
    workspace: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let request = serde_json::json!({
        "prompt": prompt,
        "workspace": workspace,
        "max_turns": 5,
        "permission_mode": "default"
    });

    // 找到项目根目录的 bridge 脚本
    let bridge_path = if std::path::Path::new("../scripts/dist/mcp-agent-bridge.js").exists() {
        "../scripts/dist/mcp-agent-bridge.js"
    } else if std::path::Path::new("scripts/dist/mcp-agent-bridge.js").exists() {
        "scripts/dist/mcp-agent-bridge.js"
    } else {
        return Err("找不到 mcp-agent-bridge.js，请运行: cd scripts && pnpm run build:mcp".into());
    };

    // 获取 API Key（从环境变量或 .env 文件）
    let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_else(|_| {
        // 如果环境变量没有，尝试从 .env 文件读取
        if let Ok(content) = std::fs::read_to_string("src-tauri/.env")
            .or_else(|_| std::fs::read_to_string("../.env"))
            .or_else(|_| std::fs::read_to_string(".env"))
        {
            for line in content.lines() {
                if line.starts_with("ANTHROPIC_API_KEY") {
                    if let Some(key) = line.split('=').nth(1) {
                        return key.trim().to_string();
                    }
                }
            }
        }
        // 默认使用 router-config.json 中的 key
        "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb".to_string()
    });

    let mut child = Command::new("node")
        .arg(bridge_path)
        .env("ANTHROPIC_API_KEY", &api_key) // 明确传递环境变量
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped()) // 捕获 stderr
        .spawn()?;

    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(serde_json::to_string(&request)?.as_bytes())?;
    child.stdin.take();

    let output = child.wait_with_output()?;

    // 先显示 stderr（包含详细的错误日志）
    let stderr_output = String::from_utf8_lossy(&output.stderr);
    if !stderr_output.is_empty() {
        eprintln!("\n📋 Bridge 日志:");
        eprintln!("{}", stderr_output);
    }

    if !output.status.success() {
        eprintln!("\n❌ Bridge 执行失败 (退出码: {})", output.status);

        // 尝试解析 stdout 中的错误信息
        if !output.stdout.is_empty() {
            if let Ok(error_response) = serde_json::from_slice::<serde_json::Value>(&output.stdout)
            {
                if let Some(error) = error_response["error"].as_str() {
                    eprintln!("错误详情: {}", error);
                }
            }
        }

        return Err(format!("Bridge 进程退出码: {}", output.status).into());
    }

    let response: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    Ok(response)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🤖 多轮 AI 对话测试");
    println!("{}", "=".repeat(60));
    println!();
    println!("💡 提示:");
    println!("   • 输入你的问题，按回车发送");
    println!("   • 输入 'exit' 或 'quit' 退出");
    println!("   • 输入 'info' 查看连接信息");
    println!();
    println!("{}", "=".repeat(60));

    // 测试工作目录
    let workspace = "/tmp/test-workspace";
    std::fs::create_dir_all(workspace)?;

    let mut turn_count = 0;
    let stdin = io::stdin();
    let mut input = String::new();

    // 首次测试连接
    println!("\n🔍 测试连接...");
    match send_message("你好，请简单回复收到", workspace) {
        Ok(response) => {
            if response["success"].as_bool().unwrap_or(false) {
                println!("✅ 连接成功!");
                println!("   模型: {}", response["agent_info"]["model"]);
                println!("   SDK: {}", response["agent_info"]["sdk_version"]);

                if let Some(content) = response["content"].as_str() {
                    if !content.is_empty() {
                        println!("\n🤖 AI: {}\n", content);
                    }
                }
            } else {
                println!("⚠️  连接有问题: {:?}", response["error"]);
            }
        }
        Err(e) => {
            println!("❌ 连接失败: {}", e);
            println!("\n请确保:");
            println!("  1. claude-code-router 已启动 (ccr start)");
            println!("  2. scripts/dist/mcp-agent-bridge.js 已编译");
            println!("  3. ANTHROPIC_API_KEY 已设置");
            return Err(e);
        }
    }

    println!("{}", "=".repeat(60));
    println!("\n开始对话 (输入 'exit' 退出):\n");

    loop {
        // 显示提示符
        print!("你 > ");
        io::stdout().flush()?;

        // 读取用户输入
        input.clear();
        stdin.read_line(&mut input)?;
        let user_input = input.trim();

        // 处理命令
        match user_input {
            "exit" | "quit" => {
                println!("\n👋 再见！");
                break;
            }
            "info" => {
                println!("\n📊 连接信息:");
                println!("   工作目录: {}", workspace);
                println!("   已对话轮数: {}", turn_count);
                println!("   Router: http://localhost:3456");
                println!("   DeerAPI: https://api.deerapi.com");
                println!();
                continue;
            }
            "" => continue,
            _ => {}
        }

        // 发送消息
        print!("\n🤖 AI > ");
        io::stdout().flush()?;

        turn_count += 1;

        match send_message(user_input, workspace) {
            Ok(response) => {
                if response["success"].as_bool().unwrap_or(false) {
                    if let Some(content) = response["content"].as_str() {
                        println!("{}", content);
                    } else {
                        println!("(无回复)");
                    }

                    // 显示统计
                    let tokens = response["agent_info"]["total_tokens"].as_u64().unwrap_or(0);
                    if tokens > 0 {
                        println!("\n   [Token: {}, 轮数: {}]", tokens, turn_count);
                    }
                } else {
                    println!("\n❌ 错误: {:?}", response["error"]);
                }
            }
            Err(e) => {
                println!("\n❌ 发送失败: {}", e);
            }
        }

        println!();
    }

    println!("\n{}", "=".repeat(60));
    println!("📊 总计:");
    println!("   对话轮数: {}", turn_count);
    println!("{}", "=".repeat(60));

    Ok(())
}
