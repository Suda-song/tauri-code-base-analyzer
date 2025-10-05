#!/bin/bash

# 启动 claude-code-router 并运行 Agent SDK 测试
# 这个脚本会：
# 1. 安装/检查 claude-code-router
# 2. 启动代理服务器
# 3. 运行测试
# 4. 清理进程

set -e

echo "=========================================="
echo "🚀 启动 Claude Code Router + Agent SDK 测试"
echo "=========================================="

# 检查 claude-code-router 是否全局安装
if ! command -v ccr &> /dev/null; then
    echo "❌ claude-code-router 未安装，正在全局安装..."
    pnpm install -g @musistudio/claude-code-router
    
    if ! command -v ccr &> /dev/null; then
        echo "❌ 全局安装失败，请手动安装:"
        echo "   pnpm install -g @musistudio/claude-code-router"
        exit 1
    fi
fi

echo "✅ claude-code-router 已安装: $(which ccr)"

# 确保配置文件存在
CONFIG_DIR="$HOME/.claude-code-router"
CONFIG_FILE="$CONFIG_DIR/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "📝 创建配置文件..."
    mkdir -p "$CONFIG_DIR"
    cp router-config.json "$CONFIG_FILE"
    echo "   配置文件: $CONFIG_FILE"
fi

# 1. 启动 claude-code-router (后台)
echo ""
echo "1️⃣ 启动 claude-code-router (localhost:3456)..."
ccr start > /tmp/ccr.log 2>&1 &
CCR_PID=$!
echo "   PID: $CCR_PID"

# 等待服务启动
echo "   等待服务启动..."
for i in {1..30}; do
    if curl -s http://localhost:3456/health > /dev/null 2>&1; then
        echo "   ✅ claude-code-router 已启动"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ 服务启动超时"
        cat /tmp/ccr.log
        kill $CCR_PID 2>/dev/null || true
        exit 1
    fi
    sleep 0.5
done

# 2. 显示配置信息
echo ""
echo "2️⃣ 配置信息:"
echo "   代理地址: http://localhost:3456"
echo "   配置文件: $CONFIG_FILE"
echo "   日志文件: /tmp/ccr.log"

# 3. 测试 DeerAPI 连接
echo ""
echo "3️⃣ 测试 DeerAPI 连接..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "deerapi,claude-sonnet-4-5-20250929",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Say hello in Chinese"
      }
    ]
  }' || echo '{"error": "connection failed"}')

if echo "$TEST_RESPONSE" | grep -q "content"; then
    echo "   ✅ DeerAPI 连接测试成功"
else
    echo "   ⚠️  DeerAPI 响应异常:"
    echo "   $TEST_RESPONSE" | head -5
fi

# 4. 运行 Rust Agent SDK 测试
echo ""
echo "4️⃣ 运行 Rust Agent SDK 交互测试..."
echo "=========================================="
cd src-tauri
cargo run --example simple_chat_test 2>&1 | grep -v "warning:"

# 清理
echo ""
echo "=========================================="
echo "🧹 清理..."
kill $CCR_PID 2>/dev/null || true
echo "✅ 完成!"
