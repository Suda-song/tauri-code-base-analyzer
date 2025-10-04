/// 直接调用 DeerAPI 的多轮对话测试
///
/// 不使用 Claude Agent SDK，直接 HTTP 调用
use std::io::{self, Write};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🤖 直接 DeerAPI 多轮对话测试");
    println!("{}", "=".repeat(60));
    println!();
    println!("💡 提示:");
    println!("   • 输入你的问题，按回车发送");
    println!("   • 输入 'exit' 或 'quit' 退出");
    println!();
    println!("{}", "=".repeat(60));

    // 获取 API Key
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .or_else(|_| std::env::var("DEERAPI_KEY"))
        .unwrap_or_else(|_| "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb".to_string());

    println!("\n🔍 测试连接...");

    // 创建 HTTP 客户端
    let client = reqwest::Client::new();

    // 测试连接
    let test_response = client
        .post("https://api.deerapi.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .header("x-api-key", &api_key)
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 50,
            "messages": [
                {"role": "user", "content": "请简单回复：收到"}
            ]
        }))
        .send()
        .await?;

    if !test_response.status().is_success() {
        println!("❌ 连接失败: HTTP {}", test_response.status());
        println!("响应: {}", test_response.text().await?);
        return Err("API 连接失败".into());
    }

    let test_result: serde_json::Value = test_response.json().await?;

    if let Some(content) = test_result["content"][0]["text"].as_str() {
        println!("✅ 连接成功!");
        println!("   API: https://api.deerapi.com");
        println!(
            "   模型: {}",
            test_result["model"].as_str().unwrap_or("unknown")
        );
        println!("\n🤖 AI: {}\n", content);
    } else {
        println!("⚠️  响应格式异常: {:?}", test_result);
    }

    println!("{}", "=".repeat(60));
    println!("\n开始对话 (输入 'exit' 退出):\n");

    let stdin = io::stdin();
    let mut input = String::new();
    let mut turn_count = 0;

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
            "" => continue,
            _ => {}
        }

        // 发送请求
        print!("\n🤖 AI > ");
        io::stdout().flush()?;

        turn_count += 1;

        let response = client
            .post("https://api.deerapi.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("x-api-key", &api_key)
            .json(&serde_json::json!({
                "model": "claude-sonnet-4-5-20250929",
                "max_tokens": 2048,
                "messages": [
                    {"role": "user", "content": user_input}
                ]
            }))
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    if let Ok(result) = resp.json::<serde_json::Value>().await {
                        if let Some(content) = result["content"][0]["text"].as_str() {
                            println!("{}", content);

                            // 显示统计
                            let input_tokens =
                                result["usage"]["input_tokens"].as_u64().unwrap_or(0);
                            let output_tokens =
                                result["usage"]["output_tokens"].as_u64().unwrap_or(0);
                            println!(
                                "\n   [输入: {}, 输出: {}, 总计: {}]",
                                input_tokens,
                                output_tokens,
                                input_tokens + output_tokens
                            );
                        } else {
                            println!("(无法解析回复)");
                            println!("响应: {:?}", result);
                        }
                    } else {
                        println!("(响应解析失败)");
                    }
                } else {
                    println!("\n❌ 请求失败: HTTP {}", resp.status());
                    if let Ok(error_text) = resp.text().await {
                        println!("错误: {}", error_text);
                    }
                }
            }
            Err(e) => {
                println!("\n❌ 网络错误: {}", e);
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
