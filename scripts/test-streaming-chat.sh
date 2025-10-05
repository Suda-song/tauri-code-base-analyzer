#!/bin/bash

# 流式会话测试脚本
# 使用 SDK 的 AsyncIterable 模式，自动管理 session

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🤖 流式会话测试 (AsyncIterable 模式)"
echo "=========================================="
echo ""
echo "✨ 核心特性:"
echo "   ✅ SDK 自动管理 session"
echo "   ✅ 无需手动 resume"
echo "   ✅ 真正的持续会话"
echo "   ✅ 一次连接，无限轮对话"
echo ""
echo "=========================================="

# Step 1: 检查 Bridge 是否已编译
echo ""
echo "📦 Step 1: 检查编译状态..."
if [ ! -f "scripts/dist/mcp-agent-bridge-streaming.js" ]; then
    echo "⚠️  流式 Bridge 未编译，正在编译..."
    cd scripts && pnpm run build:streaming && cd ..
    echo "✅ 编译完成"
else
    echo "✅ 流式 Bridge 已编译"
fi

# Step 2: 检查 MCP 服务器
echo ""
echo "🔧 Step 2: 检查 MCP 服务器..."
if [ ! -f "target/release/codebase-mcp-server" ]; then
    echo "⚠️  MCP 服务器未编译，正在编译..."
    cd src-tauri && cargo build --release --bin codebase-mcp-server && cd ..
    echo "✅ MCP 服务器编译完成"
else
    echo "✅ MCP 服务器已编译"
fi

# Step 3: 运行测试
echo ""
echo "=========================================="
echo "🎯 Step 3: 启动流式会话"
echo "=========================================="
echo ""
echo "💡 使用说明:"
echo "   • 随意聊天，AI 会记住之前的所有内容"
echo "   • SDK 自动管理 session，无需 resume"
echo "   • 输入 'info' 查看会话信息"
echo "   • 输入 'exit' 退出"
echo ""
echo "🧪 测试建议:"
echo "   1. 先告诉 AI 你的名字"
echo "   2. 然后问 AI 你叫什么名字"
echo "   3. 观察 AI 是否记住了（无需 resume！）"
echo ""
echo "=========================================="
echo ""

# 运行测试
cd src-tauri
cargo run --example streaming_chat_test

echo ""
echo "=========================================="
echo "✅ 测试结束"
echo "=========================================="

