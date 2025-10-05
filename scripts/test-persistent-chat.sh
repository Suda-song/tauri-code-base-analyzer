#!/bin/bash

# 持久化多轮对话测试脚本
# 测试 SDK 的 resume 功能，实现真正的多轮对话（同一 Session）

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🤖 持久化多轮对话测试"
echo "=========================================="
echo ""
echo "🔑 核心特性:"
echo "   ✅ 所有对话在同一个 Session 中"
echo "   ✅ AI 记住所有历史对话"
echo "   ✅ SDK 自动维护完整上下文"
echo ""
echo "=========================================="

# Step 1: 检查 Bridge 是否已编译
echo ""
echo "📦 Step 1: 检查编译状态..."
if [ ! -f "scripts/dist/mcp-agent-bridge-persistent.js" ]; then
    echo "⚠️  持久化 Bridge 未编译，正在编译..."
    cd scripts && pnpm run build:mcp-persistent && cd ..
    echo "✅ 编译完成"
else
    echo "✅ 持久化 Bridge 已编译"
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
echo "🎯 Step 3: 启动持久化多轮对话"
echo "=========================================="
echo ""
echo "💡 使用说明:"
echo "   • 随意聊天，AI 会记住之前的所有内容"
echo "   • 输入 'info' 查看当前 Session ID"
echo "   • 输入 'reset' 重置会话（开始新的对话）"
echo "   • 输入 'exit' 退出"
echo ""
echo "🧪 测试建议:"
echo "   1. 先告诉 AI 你的名字和身份"
echo "   2. 然后问 AI 你叫什么名字"
echo "   3. 看看 AI 是否记住了！"
echo ""
echo "=========================================="
echo ""

# 运行测试
cd src-tauri
cargo run --example persistent_chat_test

echo ""
echo "=========================================="
echo "✅ 测试结束"
echo "=========================================="

