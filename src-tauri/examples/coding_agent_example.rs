use tauri_code_base_analyzer::agent_core::coding_agent::{
    AgentMode, CodingAgent, CodingAgentConfig, CodingQuery,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("{}", "=".repeat(80));
    println!("🤖 AI Coding Agent 示例");
    println!("{}\n", "=".repeat(80));

    // 示例 1: 代码分析模式
    example_code_analysis().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 2: 代码编辑模式
    example_code_editing().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 3: 调试模式
    example_debugging().await?;

    println!("\n{}\n", "-".repeat(80));

    // 示例 4: 代码生成模式
    example_code_generation().await?;

    Ok(())
}

/// 示例 1: 代码分析
async fn example_code_analysis() -> Result<(), Box<dyn std::error::Error>> {
    println!("📊 示例 1: 代码分析模式");
    println!("{}\n", "-".repeat(60));

    let workspace = std::env::current_dir()?.to_string_lossy().to_string();
    let mut agent = CodingAgent::new(workspace)?;

    // 设置为分析模式
    agent.set_mode(AgentMode::Analysis);

    // 注册编码工具
    agent.register_coding_tools();

    let query = CodingQuery {
        prompt: "请分析 src/main.rs 文件，告诉我主要的功能模块和代码结构".to_string(),
        files: vec!["src/main.rs".to_string()],
        max_tokens: Some(4096),
        verbose: true,
    };

    let response = agent.code(query).await?;

    println!("\n📋 分析结果:");
    println!("{}", response.content);
    println!("\n使用的工具: {:?}", response.tools_used);

    Ok(())
}

/// 示例 2: 代码编辑
async fn example_code_editing() -> Result<(), Box<dyn std::error::Error>> {
    println!("✏️  示例 2: 代码编辑模式");
    println!("{}\n", "-".repeat(60));

    let workspace = "/tmp/test_project".to_string();

    // 创建测试目录
    std::fs::create_dir_all(&workspace)?;

    let config = CodingAgentConfig {
        workspace: workspace.clone(),
        mode: AgentMode::Edit,
        max_tool_iterations: 15,
        ..Default::default()
    };

    let mut agent = CodingAgent::with_config(config)?;
    agent.register_coding_tools();

    let query = CodingQuery {
        prompt: r#"创建一个 hello.rs 文件，包含一个简单的 Hello World 程序，
然后帮我优化代码，添加适当的注释和错误处理。"#
            .to_string(),
        files: vec![],
        max_tokens: Some(4096),
        verbose: true,
    };

    let response = agent.code(query).await?;

    println!("\n📝 编辑结果:");
    println!("{}", response.content);
    println!("\n修改的文件: {:?}", response.files_modified);
    println!("使用的工具: {:?}", response.tools_used);

    Ok(())
}

/// 示例 3: 调试
async fn example_debugging() -> Result<(), Box<dyn std::error::Error>> {
    println!("🐛 示例 3: 调试模式");
    println!("{}\n", "-".repeat(60));

    let workspace = std::env::current_dir()?.to_string_lossy().to_string();

    let config = CodingAgentConfig {
        workspace,
        mode: AgentMode::Debug,
        ..Default::default()
    };

    let mut agent = CodingAgent::with_config(config)?;
    agent.register_coding_tools();

    let query = CodingQuery {
        prompt: r#"我的程序运行时出现编译错误。请帮我：
1. 检查 Cargo.toml 的依赖配置
2. 查找可能的语法错误
3. 建议修复方案"#
            .to_string(),
        files: vec!["Cargo.toml".to_string()],
        max_tokens: Some(6144),
        verbose: true,
    };

    let response = agent.code(query).await?;

    println!("\n🔍 调试结果:");
    println!("{}", response.content);

    if !response.suggestions.is_empty() {
        println!("\n💡 建议:");
        for (idx, suggestion) in response.suggestions.iter().enumerate() {
            println!("  {}. {}", idx + 1, suggestion);
        }
    }

    Ok(())
}

/// 示例 4: 代码生成
async fn example_code_generation() -> Result<(), Box<dyn std::error::Error>> {
    println!("⚡ 示例 4: 代码生成模式");
    println!("{}\n", "-".repeat(60));

    let workspace = "/tmp/test_project".to_string();
    std::fs::create_dir_all(&workspace)?;

    let config = CodingAgentConfig {
        workspace,
        mode: AgentMode::Generate,
        max_tool_iterations: 20,
        ..Default::default()
    };

    let mut agent = CodingAgent::with_config(config)?;
    agent.register_coding_tools();

    let query = CodingQuery {
        prompt: r#"创建一个简单的 Web API 项目结构：
1. 创建 src/main.rs - 主入口
2. 创建 src/api/ 目录和基本的路由结构
3. 创建 Cargo.toml 配置文件，包含 actix-web 依赖
4. 创建 README.md 说明如何运行"#
            .to_string(),
        files: vec![],
        max_tokens: Some(8192),
        verbose: true,
    };

    let response = agent.code(query).await?;

    println!("\n🎨 生成结果:");
    println!("{}", response.content);
    println!("\n创建的文件: {:?}", response.files_modified);

    // 导出对话历史
    println!("\n📜 导出对话历史:");
    let history = agent.export_history()?;
    println!("{}", history);

    Ok(())
}
