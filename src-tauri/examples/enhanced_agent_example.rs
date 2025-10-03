use tauri_code_base_analyzer::agent_core::enhanced_coding_agent::{
    AgentConfig, AgentMode, CodingTask, EnhancedCodingAgent,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("{}", "=".repeat(80));
    println!("🤖 增强型 AI Coding Agent 示例");
    println!("{}\n", "=".repeat(80));

    // 示例 1: 代码分析
    example_analyze().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 2: 代码生成
    example_generate().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 3: 调试
    example_debug().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 4: 重构
    example_refactor().await?;

    Ok(())
}

/// 示例 1: 代码分析
async fn example_analyze() -> Result<(), Box<dyn std::error::Error>> {
    println!("📊 示例 1: 代码分析模式");
    println!("{}\n", "-".repeat(60));

    let workspace = std::env::current_dir()?.to_string_lossy().to_string();
    let mut agent = EnhancedCodingAgent::new(workspace)?;
    agent.set_mode(AgentMode::Analysis);

    let task = CodingTask {
        prompt: "分析 src/main.rs 文件，总结主要功能模块".to_string(),
        files: vec!["src/main.rs".to_string()],
        verbose: true,
    };

    let response = agent.execute(task).await?;

    println!("✅ 分析结果:");
    println!("{}", response.content);
    println!("\n📋 工具使用: {} 次", response.tool_uses.len());

    Ok(())
}

/// 示例 2: 代码生成
async fn example_generate() -> Result<(), Box<dyn std::error::Error>> {
    println!("⚡ 示例 2: 代码生成模式");
    println!("{}\n", "-".repeat(60));

    let workspace = "/tmp/enhanced_agent_test".to_string();
    std::fs::create_dir_all(&workspace)?;

    let mut agent = EnhancedCodingAgent::new(workspace)?;
    agent.set_mode(AgentMode::Generate);

    let response = agent
        .generate(
            r#"创建一个简单的 Rust 项目:
1. 创建 hello.rs 文件
2. 实现一个 greet 函数，接收 name 参数并打印问候语
3. 添加适当的注释和示例"#
                .to_string(),
        )
        .await?;

    println!("✅ 生成结果:");
    println!("{}", response.content);
    println!("\n📝 创建的文件: {:?}", response.files_modified);
    println!("🔧 代码变更: {} 处", response.code_changes.len());

    if !response.suggestions.is_empty() {
        println!("\n💡 建议:");
        for (i, suggestion) in response.suggestions.iter().enumerate() {
            println!("  {}. {}", i + 1, suggestion);
        }
    }

    Ok(())
}

/// 示例 3: 调试
async fn example_debug() -> Result<(), Box<dyn std::error::Error>> {
    println!("🐛 示例 3: 调试模式");
    println!("{}\n", "-".repeat(60));

    let workspace = std::env::current_dir()?.to_string_lossy().to_string();
    let mut agent = EnhancedCodingAgent::new(workspace)?;
    agent.set_mode(AgentMode::Debug);

    let response = agent
        .debug(
            "检查项目是否有编译错误，如果有请帮我找出问题".to_string(),
            vec!["Cargo.toml".to_string()],
        )
        .await?;

    println!("✅ 调试结果:");
    println!("{}", response.content);

    if !response.commands_executed.is_empty() {
        println!("\n💻 执行的命令:");
        for cmd in &response.commands_executed {
            println!("  $ {}", cmd);
        }
    }

    if !response.warnings.is_empty() {
        println!("\n⚠️  警告:");
        for warning in &response.warnings {
            println!("  • {}", warning);
        }
    }

    Ok(())
}

/// 示例 4: 重构
async fn example_refactor() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔨 示例 4: 重构模式");
    println!("{}\n", "-".repeat(60));

    let workspace = "/tmp/refactor_test".to_string();
    std::fs::create_dir_all(&workspace)?;

    // 创建一个测试文件
    std::fs::write(
        format!("{}/example.rs", workspace),
        r#"fn calculate(a: i32, b: i32, c: i32) -> i32 {
    let x = a + b;
    let y = x * c;
    return y;
}

fn main() {
    let result = calculate(1, 2, 3);
    println!("{}", result);
}
"#,
    )?;

    let config = AgentConfig {
        max_turns: 5,
        max_tokens: 4096,
        save_history: true,
        auto_permissions: true,
    };

    let mut agent = EnhancedCodingAgent::with_config(workspace, config)?;
    agent.set_mode(AgentMode::Refactor);

    let response = agent
        .refactor(
            "重构 example.rs 文件，改进代码可读性和简洁性".to_string(),
            vec!["example.rs".to_string()],
        )
        .await?;

    println!("✅ 重构结果:");
    println!("{}", response.content);

    if !response.code_changes.is_empty() {
        println!("\n📝 代码变更:");
        for (i, change) in response.code_changes.iter().enumerate() {
            println!(
                "\n  变更 {}: {} ({})",
                i + 1,
                change.file_path,
                change.change_type
            );
            println!("  {}", "-".repeat(40));
            // 只显示前 200 个字符
            let diff = if change.diff.len() > 200 {
                format!("{}...", &change.diff[..200])
            } else {
                change.diff.clone()
            };
            println!("  {}", diff);
        }
    }

    Ok(())
}
