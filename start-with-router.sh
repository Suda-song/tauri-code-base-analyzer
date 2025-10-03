#!/bin/bash

# 启动 claude-code-router 并运行 Agent SDK 测试
# 这个脚本会：
# 1. 启动 claude-code-router 代理服务器
# 2. 等待服务启动
# 3. 运行 Rust Agent SDK 测试
# 4. 清理进程

set -e

echo "=========================================="
echo "🚀 启动 Claude Code Router + Agent SDK 测试"
echo "=========================================="

# 检查 claude-code-router 是否构建
if [ ! -f "/Users/songdingan/dev/claude-code-router/dist/cli.js" ]; then
    echo "❌ claude-code-router 未构建，正在构建..."
    cd /Users/songdingan/dev/claude-code-router
    pnpm install && pnpm run build
fi

# 1. 启动 claude-code-router (后台)
echo ""
echo "1️⃣ 启动 claude-code-router (localhost:3456)..."
cd /Users/songdingan/dev/claude-code-router
node dist/cli.js start > /tmp/ccr.log 2>&1 &
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
echo "   配置文件: ~/.claude-code-router/config.json"
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
echo "4️⃣ 运行 Rust Agent SDK 测试..."
echo "=========================================="
cd /Users/songdingan/dev/tauri-code-base-analyzer/src-tauri
cargo run --example agent_sdk_example 2>&1 | grep -v "warning:"

# 清理
echo ""
echo "=========================================="
echo "🧹 清理..."
kill $CCR_PID 2>/dev/null || true
echo "✅ 完成!"

