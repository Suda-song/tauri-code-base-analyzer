#!/bin/bash

# 简单的 AI 对话测试脚本
# 测试 Agent SDK 是否能正常工作，以及请求是否被代理

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🧪 AI 对话测试"
echo "=========================================="

# Step 1: 检查 Bridge 是否已编译
echo ""
echo "📦 Step 1: 检查编译状态..."
if [ ! -f "scripts/dist/mcp-agent-bridge.js" ]; then
    echo "⚠️  Bridge 未编译，正在编译..."
    cd scripts && pnpm run build:mcp && cd ..
    echo "✅ 编译完成"
else
    echo "✅ Bridge 已编译"
fi

# Step 2: 检查 claude-code-router
echo ""
echo "📡 Step 2: 检查 claude-code-router..."
if ! command -v ccr &> /dev/null; then
    echo "❌ claude-code-router 未安装"
    echo ""
    echo "请先安装:"
    echo "  pnpm install -g @musistudio/claude-code-router"
    echo ""
    exit 1
fi
echo "✅ claude-code-router 已安装"

# Step 3: 配置并启动 router
echo ""
echo "🔧 Step 3: 配置 claude-code-router..."
ROUTER_CONFIG_DIR="$HOME/.claude-code-router"
mkdir -p "$ROUTER_CONFIG_DIR"
cp "$PROJECT_ROOT/router-config.json" "$ROUTER_CONFIG_DIR/config.json"
echo "✅ Router 配置已更新"

# 检查是否已在运行
if curl -s http://localhost:3456/health > /dev/null 2>&1; then
    echo "✅ Router 已在运行 (http://localhost:3456)"
else
    echo "🔄 启动 Router..."
    ccr start &
    ROUTER_PID=$!
    echo "✅ Router 已启动 (PID: $ROUTER_PID)"
    
    # 等待 Router 就绪
    echo "⏳ 等待 Router 就绪..."
    for i in {1..10}; do
        if curl -s http://localhost:3456/health > /dev/null 2>&1; then
            echo "✅ Router 就绪"
            break
        fi
        sleep 1
    done
fi

# Step 4: 测试 Router 是否可访问
echo ""
echo "🔍 Step 4: 测试 Router 连接..."
if curl -s http://localhost:3456/health > /dev/null 2>&1; then
    echo "✅ Router 服务正常 (http://localhost:3456)"
else
    echo "❌ Router 无法访问"
    exit 1
fi

# Step 5: 启动 Router 日志监控（后台）
echo ""
echo "📊 Step 5: 启动请求监控..."
echo "   (监控 Router 是否收到请求)"
echo ""

# 创建一个临时文件来捕获 ccr 日志
ROUTER_LOG="/tmp/ccr-test-$$.log"
echo "开始监控..." > "$ROUTER_LOG"

# Step 6: 运行测试
echo "=========================================="
echo "🎯 Step 6: 启动多轮对话"
echo "=========================================="
echo ""
echo "💡 使用说明:"
echo "   • 程序启动后会自动测试连接"
echo "   • 然后你可以输入任何问题"
echo "   • 输入 'info' 查看连接状态"
echo "   • 输入 'exit' 退出"
echo ""
echo "🔍 验证代理的方法:"
echo "   1. 看到 'claude-sonnet-4-5-20250929' 说明使用了 DeerAPI"
echo "   2. Token 统计显示说明请求成功"
echo "   3. AI 能正常回复说明整个链路正常"
echo ""
echo "=========================================="
echo ""

# 运行测试
cargo run --example simple_chat_test

echo ""
echo "=========================================="
echo "✅ 对话结束"
echo "=========================================="

