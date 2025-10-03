#!/bin/bash

# MCP Agent 完整运行脚本
# 1. 编译 Rust MCP 服务器
# 2. 编译 Node.js Bridge
# 3. 启动 claude-code-router
# 4. 运行 Rust 示例

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🚀 MCP Agent 完整启动流程"
echo "=========================================="

# Step 1: 编译 MCP 服务器
echo ""
echo "📦 Step 1: 编译 Rust MCP 服务器..."
cd "$PROJECT_ROOT"
cargo build --release -p codebase-mcp-server
echo "✅ MCP 服务器编译完成: target/release/codebase-mcp-server"

# Step 2: 编译 Node.js Bridge
echo ""
echo "📦 Step 2: 编译 Node.js Bridge..."
cd "$PROJECT_ROOT/scripts"
pnpm install || npm install
pnpm run build:mcp || npm run build:mcp
echo "✅ Bridge 编译完成: scripts/dist/mcp-agent-bridge.js"

# Step 3: 检查 claude-code-router
echo ""
echo "📡 Step 3: 检查 claude-code-router..."
if ! command -v ccr &> /dev/null; then
    echo "❌ claude-code-router 未安装"
    echo ""
    echo "请先安装:"
    echo "  pnpm install -g @musistudio/claude-code-router"
    echo ""
    exit 1
fi

# 配置 router
echo "📝 配置 claude-code-router..."
ROUTER_CONFIG_DIR="$HOME/.claude-code-router"
mkdir -p "$ROUTER_CONFIG_DIR"
cp "$PROJECT_ROOT/router-config.json" "$ROUTER_CONFIG_DIR/config.json"
echo "✅ Router 配置已更新"

# 停止旧的 router
echo "🔄 重启 claude-code-router..."
ccr stop 2>/dev/null || pkill -f "ccr start" 2>/dev/null || true
sleep 1

# 后台启动 router
ccr start &
ROUTER_PID=$!
echo "✅ Router 已启动 (PID: $ROUTER_PID)"

# 等待 router 就绪
echo "⏳ 等待 Router 就绪..."
for i in {1..10}; do
    if curl -s http://localhost:3456/health > /dev/null 2>&1; then
        echo "✅ Router 就绪"
        break
    fi
    sleep 1
done

# Step 4: 设置环境变量
echo ""
echo "🔑 Step 4: 加载环境变量..."
if [ -f "$PROJECT_ROOT/src-tauri/.env" ]; then
    export $(cat "$PROJECT_ROOT/src-tauri/.env" | grep -v '^#' | xargs)
    echo "✅ 环境变量已加载"
else
    echo "⚠️  .env 文件不存在，使用 router 配置的 API Key"
fi

# Step 5: 运行示例
echo ""
echo "=========================================="
echo "🎯 Step 5: 运行 MCP Agent 示例"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"
cargo run --example mcp_agent_example

# 清理
echo ""
echo "=========================================="
echo "🧹 清理"
echo "=========================================="
echo "停止 claude-code-router..."
ccr stop || kill $ROUTER_PID 2>/dev/null || true
echo "✅ 完成"

