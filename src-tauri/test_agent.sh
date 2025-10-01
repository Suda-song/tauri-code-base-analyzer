#!/bin/bash

# 测试原生 Tool Use API Agent

set -e

echo "🧪 测试 Claude Agent with Native Tool Use API"
echo "=============================================="
echo ""

# 检查 ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ 错误: ANTHROPIC_API_KEY 环境变量未设置"
    echo ""
    echo "请设置 API Key:"
    echo "  export ANTHROPIC_API_KEY='your-key-here'"
    echo ""
    exit 1
fi

echo "✅ ANTHROPIC_API_KEY 已设置"
echo ""

# 编译测试
echo "📦 编译项目..."
cargo build --quiet
echo "✅ 编译成功"
echo ""

echo "🎉 准备就绪！"
echo ""
echo "现在你可以在代码中使用 Agent 了："
echo ""
echo "示例代码:"
echo "────────────────────────────────────────"
cat << 'EOF'
use crate::agent_core::{ClaudeAgent, AgentQuery};
use crate::tool_execution::system::BashTool;

let mut agent = ClaudeAgent::new()?;
agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));

let query = AgentQuery {
    prompt: "列出 /tmp 目录的文件".to_string(),
    system_prompt: None,
    max_tokens: Some(2048),
};

let response = agent.query(query).await?;
println!("{}", response.content);
EOF
echo "────────────────────────────────────────"
echo ""
echo "查看完整文档:"
echo "  cat NATIVE_TOOL_USE.md"
echo ""
