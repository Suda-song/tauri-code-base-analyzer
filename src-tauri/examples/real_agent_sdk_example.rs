/// Real Agent SDK 使用示例
///
/// 展示如何使用真正的 @anthropic-ai/claude-agent-sdk@0.1.5
// 由于这是一个示例程序，我们需要直接引用模块路径
// 而不是通过 crate 名称
use tauri_code_base_analyzer::agent_core::{RealAgentSdkCodingAgent, RealAgentSdkMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载环境变量
    dotenv::dotenv().ok();

    println!("{}", "=".repeat(70));
    println!("🤖 Real Claude Agent SDK 示例");
    println!("   SDK: @anthropic-ai/claude-agent-sdk@0.1.5 (Official)");
    println!("{}", "=".repeat(70));

    // 1. 创建临时工作目录
    let workspace = "/tmp/real_agent_sdk_demo";
    std::fs::create_dir_all(workspace)?;
    println!("\n📁 工作空间: {}", workspace);

    // 2. 创建 Real Agent（真正使用官方 SDK）
    let mut agent = RealAgentSdkCodingAgent::new(workspace.to_string())?;
    println!("✅ Real Agent 初始化成功");
    println!("   特性:");
    println!("   - ✅ 官方 Agent SDK");
    println!("   - ✅ SDK 内置 Agent 循环");
    println!("   - ✅ SDK 管理工具和权限");
    println!("   - ✅ 自动成本追踪");

    // 示例 1: 代码生成
    println!("\n{}", "=".repeat(70));
    println!("📝 示例 1: 代码生成（真正的 SDK）");
    println!("{}", "=".repeat(70));

    agent.set_mode(RealAgentSdkMode::Code);
    let response = agent
        .generate_code(
            "创建一个 calculator.rs 文件，实现一个简单的计算器，包含加减乘除四个函数，\
             并添加完整的文档注释"
                .to_string(),
        )
        .await?;

    println!("\n✅ 代码生成完成!");
    println!("   对话 ID: {}", response.conversation_id);
    println!("   轮数: {}", response.turn_count);
    println!("   SDK 版本: {}", response.agent_info.sdk_version);
    println!("   模型: {}", response.agent_info.model);
    println!("   Token 使用: {}", response.agent_info.total_tokens);
    println!("   成本: ${:.4}", response.agent_info.total_cost_usd);

    println!("\n📄 生成的内容:");
    println!("{}", "-".repeat(70));
    println!("{}", response.content);
    println!("{}", "-".repeat(70));

    if !response.files_modified.is_empty() {
        println!("\n📝 修改的文件:");
        for file in &response.files_modified {
            println!("   - {}", file);
        }
    }

    if !response.code_changes.is_empty() {
        println!("\n🔄 代码变更: {} 个", response.code_changes.len());
        for change in &response.code_changes {
            println!(
                "   - {} ({}, {})",
                change.file_path, change.change_type, change.language
            );
        }
    }

    // 示例 2: 代码分析
    println!("\n{}", "=".repeat(70));
    println!("🔍 示例 2: 代码分析（SDK 自动理解代码）");
    println!("{}", "=".repeat(70));

    agent.set_mode(RealAgentSdkMode::Analysis);
    let analysis = agent
        .analyze_files(
            "分析 calculator.rs 的代码质量，给出具体的改进建议".to_string(),
            vec!["calculator.rs".to_string()],
        )
        .await?;

    println!("\n✅ 分析完成!");
    println!("   Token 使用: {}", analysis.agent_info.total_tokens);
    println!("   成本: ${:.4}", analysis.agent_info.total_cost_usd);
    println!("   工具调用: {} 次", analysis.tool_uses.len());

    println!("\n📊 分析结果:");
    println!("{}", "-".repeat(70));
    println!("{}", analysis.content);
    println!("{}", "-".repeat(70));

    // 示例 3: 代码编辑
    println!("\n{}", "=".repeat(70));
    println!("✏️  示例 3: 代码编辑（SDK 精确编辑）");
    println!("{}", "=".repeat(70));

    agent.set_mode(RealAgentSdkMode::Edit);
    let edit_response = agent
        .edit_code(
            "在 calculator.rs 中添加一个 mod_numbers 函数用于求余数，并添加文档注释".to_string(),
            vec!["calculator.rs".to_string()],
        )
        .await?;

    println!("\n✅ 编辑完成!");
    println!("   修改的文件数: {}", edit_response.files_modified.len());
    println!("   代码变更: {}", edit_response.code_changes.len());
    println!("   成本: ${:.4}", edit_response.agent_info.total_cost_usd);

    if !edit_response.code_changes.is_empty() {
        println!("\n📝 代码变更:");
        for change in &edit_response.code_changes {
            println!("   文件: {} ({})", change.file_path, change.change_type);
            println!("   语言: {}", change.language);
        }
    }

    // 示例 4: 调试
    println!("\n{}", "=".repeat(70));
    println!("🐛 示例 4: 调试（SDK 自动运行命令）");
    println!("{}", "=".repeat(70));

    agent.set_mode(RealAgentSdkMode::Debug);
    let debug_response = agent
        .debug(
            "检查 calculator.rs 是否能通过 rustc 编译检查".to_string(),
            vec!["calculator.rs".to_string()],
        )
        .await?;

    println!("\n✅ 调试完成!");
    println!(
        "   执行的命令: {} 个",
        debug_response.commands_executed.len()
    );
    println!("   成本: ${:.4}", debug_response.agent_info.total_cost_usd);

    if !debug_response.commands_executed.is_empty() {
        println!("\n🖥️  执行的命令:");
        for cmd in &debug_response.commands_executed {
            println!("   - {}", cmd);
        }
    }

    println!("\n🔍 调试结果:");
    println!("{}", "-".repeat(70));
    println!("{}", debug_response.content);
    println!("{}", "-".repeat(70));

    // 示例 5: 重构
    println!("\n{}", "=".repeat(70));
    println!("🔄 示例 5: 代码重构（SDK 智能优化）");
    println!("{}", "=".repeat(70));

    agent.set_mode(RealAgentSdkMode::Refactor);
    let refactor_response = agent
        .refactor(
            "重构 calculator.rs，使用 Result 类型进行错误处理，避免除零错误".to_string(),
            vec!["calculator.rs".to_string()],
        )
        .await?;

    println!("\n✅ 重构完成!");
    println!(
        "   修改的文件: {:?}",
        refactor_response.files_modified.len()
    );
    println!(
        "   成本: ${:.4}",
        refactor_response.agent_info.total_cost_usd
    );

    // 显示建议和警告
    if !refactor_response.warnings.is_empty() {
        println!("\n⚠️  警告:");
        for warning in &refactor_response.warnings {
            println!("   - {}", warning);
        }
    }

    if !refactor_response.suggestions.is_empty() {
        println!("\n💡 建议:");
        for suggestion in &refactor_response.suggestions {
            println!("   - {}", suggestion);
        }
    }

    // 总结
    println!("\n{}", "=".repeat(70));
    println!("📊 总体统计（Real SDK）");
    println!("{}", "=".repeat(70));

    let total_tokens = response.agent_info.total_tokens
        + analysis.agent_info.total_tokens
        + edit_response.agent_info.total_tokens
        + debug_response.agent_info.total_tokens
        + refactor_response.agent_info.total_tokens;

    let total_cost = response.agent_info.total_cost_usd
        + analysis.agent_info.total_cost_usd
        + edit_response.agent_info.total_cost_usd
        + debug_response.agent_info.total_cost_usd
        + refactor_response.agent_info.total_cost_usd;

    println!("   SDK: @anthropic-ai/claude-agent-sdk@0.1.5");
    println!("   模型: {}", response.agent_info.model);
    println!("   总 Token 使用: {}", total_tokens);
    println!("   总成本: ${:.4}", total_cost);
    println!("   工作空间: {}", workspace);

    println!("\n✨ Real SDK 核心优势:");
    println!("   ✅ 官方 SDK - Anthropic 官方支持");
    println!("   ✅ Agent 循环 - SDK 内置智能循环");
    println!("   ✅ 工具管理 - SDK 自动管理所有工具");
    println!("   ✅ 权限系统 - SDK 完整权限控制");
    println!("   ✅ 成本追踪 - 自动追踪 Token 和成本");
    println!("   ✅ MCP 支持 - Model Context Protocol");

    println!("\n✅ 所有示例执行完成!");
    println!("💡 提示: 查看 {} 目录查看生成的文件", workspace);

    Ok(())
}
