use serde_json::Value;
/// 持久化多轮对话测试
///
/// 核心特性：
/// 1. Node.js Bridge 是常驻进程（不会每次都重启）
/// 2. 保存并传递 session_id，使用 SDK 的 resume 功能
/// 3. SDK 自动维护完整的对话历史
/// 4. AI 可以记住之前的所有对话内容
///
/// 使用方法：
/// cargo run --example persistent_chat_test
use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};

struct PersistentAgentBridge {
    child: Child,
    session_id: Option<String>,
}

impl PersistentAgentBridge {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // 找到 Bridge 脚本路径
        let bridge_path = if std::path::Path::new("../scripts/dist/mcp-agent-bridge-persistent.js")
            .exists()
        {
            "../scripts/dist/mcp-agent-bridge-persistent.js"
        } else if std::path::Path::new("scripts/dist/mcp-agent-bridge-persistent.js").exists() {
            "scripts/dist/mcp-agent-bridge-persistent.js"
        } else {
            return Err("找不到 mcp-agent-bridge-persistent.js，请运行: cd scripts && pnpm run build:mcp-persistent".into());
        };

        // 获取 API Key
        let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_else(|_| {
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
            "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb".to_string()
        });

        println!("🚀 启动持久化 Agent Bridge...");

        // 启动 Node.js Bridge（常驻进程）
        let child = Command::new("node")
            .arg(bridge_path)
            .env("ANTHROPIC_API_KEY", &api_key)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit()) // 显示 Bridge 的日志
            .spawn()?;

        println!("✅ Agent Bridge 已启动（持久化模式）");
        println!("   进程 PID: {}", child.id());
        println!();

        // 等待一下让 Bridge 初始化
        std::thread::sleep(std::time::Duration::from_millis(500));

        Ok(Self {
            child,
            session_id: None,
        })
    }

    fn send_message(
        &mut self,
        prompt: &str,
        workspace: &str,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        let request = serde_json::json!({
            "command": "query",
            "prompt": prompt,
            "workspace": workspace,
            "session_id": self.session_id, // 传递当前 session_id（如果有）
            "max_turns": 20,
            "permission_mode": "default"
        });

        // 发送请求到 Bridge
        let stdin = self.child.stdin.as_mut().ok_or("无法获取 stdin")?;
        writeln!(stdin, "{}", serde_json::to_string(&request)?)?;
        stdin.flush()?;

        // 读取响应
        let stdout = self.child.stdout.as_mut().ok_or("无法获取 stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut response_line = String::new();
        reader.read_line(&mut response_line)?;

        let response: Value = serde_json::from_str(&response_line.trim())?;

        // 更新 session_id
        if let Some(sid) = response["session_id"].as_str() {
            if !sid.is_empty() {
                if self.session_id.is_none() {
                    println!("🆔 会话已创建: {}", &sid[..8.min(sid.len())]);
                }
                self.session_id = Some(sid.to_string());
            }
        }

        Ok(response)
    }

    fn reset_session(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let request = serde_json::json!({
            "command": "reset"
        });

        let stdin = self.child.stdin.as_mut().ok_or("无法获取 stdin")?;
        writeln!(stdin, "{}", serde_json::to_string(&request)?)?;
        stdin.flush()?;

        // 读取响应
        let stdout = self.child.stdout.as_mut().ok_or("无法获取 stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut response_line = String::new();
        reader.read_line(&mut response_line)?;

        self.session_id = None;
        println!("🔄 会话已重置，下次查询将创建新会话");

        Ok(())
    }

    fn get_session_id(&self) -> Option<&str> {
        self.session_id.as_deref()
    }
}

impl Drop for PersistentAgentBridge {
    fn drop(&mut self) {
        println!("\n🧹 清理资源，关闭 Bridge 进程...");
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("{}", "=".repeat(70));
    println!("🤖 持久化多轮对话测试");
    println!("{}", "=".repeat(70));
    println!();
    println!("💡 提示:");
    println!("   • 输入你的问题，按回车发送");
    println!("   • 输入 'exit' 或 'quit' 退出");
    println!("   • 输入 'reset' 重置会话（开始新的对话）");
    println!("   • 输入 'info' 查看会话信息");
    println!();
    println!("🔑 关键特性:");
    println!("   ✅ SDK 自动维护对话历史");
    println!("   ✅ 每次对话都在同一个 Session 中");
    println!("   ✅ AI 会记住之前的所有内容");
    println!("   ✅ 支持工具调用（文件操作、代码分析等）");
    println!();
    println!("{}", "=".repeat(70));
    println!();

    // 测试工作目录
    let workspace = "/Users/songdingan/dev/modular-code-analysis-util";
    std::fs::create_dir_all(workspace)?;

    // 创建持久化 Bridge
    let mut bridge = PersistentAgentBridge::new()?;
    let stdin = io::stdin();
    let mut input = String::new();
    let mut turn_count = 0;

    // 首次测试连接
    println!("🔍 测试连接...");
    match bridge.send_message("你好，请简单回复收到", workspace) {
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
            println!("  1. scripts/dist/mcp-agent-bridge-persistent.js 已编译");
            println!("     运行: cd scripts && pnpm run build:mcp-persistent");
            println!("  2. ANTHROPIC_API_KEY 已设置");
            return Err(e);
        }
    }

    println!("{}", "=".repeat(70));
    println!("\n💬 开始对话 (输入 'exit' 退出):\n");

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
            "reset" => {
                match bridge.reset_session() {
                    Ok(_) => {
                        turn_count = 0;
                        println!();
                    }
                    Err(e) => {
                        println!("❌ 重置失败: {}", e);
                    }
                }
                continue;
            }
            "info" => {
                println!("\n📊 会话信息:");
                println!("   工作目录: {}", workspace);
                println!("   已对话轮数: {}", turn_count);
                if let Some(sid) = bridge.get_session_id() {
                    println!("   Session ID: {}...", &sid[..8.min(sid.len())]);
                    println!("   状态: 活跃（AI 记住所有历史对话）");
                } else {
                    println!("   Session ID: 未创建");
                    println!("   状态: 待创建（下次对话将创建新会话）");
                }
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

        match bridge.send_message(user_input, workspace) {
            Ok(response) => {
                if response["success"].as_bool().unwrap_or(false) {
                    if let Some(content) = response["content"].as_str() {
                        println!("{}", content);
                    } else {
                        println!("(无回复)");
                    }

                    // 显示统计
                    let tokens = response["agent_info"]["total_tokens"].as_u64().unwrap_or(0);
                    let tool_count = response["tool_uses"]
                        .as_array()
                        .map(|arr| arr.len())
                        .unwrap_or(0);

                    if tokens > 0 || tool_count > 0 {
                        print!("\n   [");
                        if tokens > 0 {
                            print!("Token: {}", tokens);
                        }
                        if tool_count > 0 {
                            if tokens > 0 {
                                print!(", ");
                            }
                            print!("工具调用: {}次", tool_count);
                        }
                        println!(", 轮数: {}]", turn_count);
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

    println!("\n{}", "=".repeat(70));
    println!("📊 本次会话总计:");
    println!("   对话轮数: {}", turn_count);
    if let Some(sid) = bridge.get_session_id() {
        println!("   Session ID: {}...", &sid[..8.min(sid.len())]);
    }
    println!("{}", "=".repeat(70));

    Ok(())
}
