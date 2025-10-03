/// Agent SDK 简单测试
///
/// 测试官方 @anthropic-ai/claude-agent-sdk 是否能启动和交互
use tauri_code_base_analyzer::agent_core::{RealAgentSdkCodingAgent, RealAgentSdkMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("🤖 Agent SDK 启动测试");
    println!("{}", "=".repeat(60));

    // 1. 创建临时工作目录
    let workspace = "/tmp/agent_sdk_test";
    std::fs::create_dir_all(workspace)?;
    println!("📁 工作空间: {}", workspace);

    // 2. 初始化 Agent（使用官方 SDK）
    let mut agent = RealAgentSdkCodingAgent::new(workspace.to_string())?;
    println!("✅ Agent 初始化成功");
    println!("   SDK: @anthropic-ai/claude-agent-sdk@0.1.5 (Official)\n");

    // 3. 简单测试 - 创建一个 Hello World 文件
    println!("📝 测试任务: 创建 hello.txt 文件");
    println!("{}", "-".repeat(60));

    agent.set_mode(RealAgentSdkMode::Code);
    let response = agent
        .generate_code("创建一个 hello.txt 文件，内容是 'Hello from Claude Agent SDK!'".to_string())
        .await?;

    // 4. 显示结果
    println!("\n✅ 任务完成!");
    println!("   对话 ID: {}", response.conversation_id);
    println!("   轮数: {}", response.turn_count);
    println!("   Token: {}", response.agent_info.total_tokens);
    println!("   模型: {}", response.agent_info.model);

    if response.success {
        println!("\n✨ SDK 交互测试成功!");
        if !response.files_modified.is_empty() {
            println!("\n📝 创建/修改的文件:");
            for file in &response.files_modified {
                println!("   - {}", file);
            }
        }
    } else {
        println!("\n❌ 任务失败: {:?}", response.error);
    }

    println!("\n💡 查看输出: {}", workspace);

    Ok(())
}
