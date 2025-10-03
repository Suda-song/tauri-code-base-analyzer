#!/bin/bash

# 集成的启动脚本 - 所有操作都在项目内完成
# 无需依赖外部 claude-code-router

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$PROJECT_ROOT/proxy-server"

echo "=========================================="
echo "🚀 启动集成的 Claude Agent SDK 测试"
echo "=========================================="
echo "项目根目录: $PROJECT_ROOT"
echo ""

# 1. 检查 proxy-server 依赖
echo "1️⃣ 检查代理服务器依赖..."
if [ ! -d "$PROXY_DIR/node_modules" ]; then
    echo "   📦 安装依赖..."
    cd "$PROXY_DIR"
    npm install
    cd "$PROJECT_ROOT"
fi
echo "   ✅ 依赖已准备"

# 2. 启动代理服务器（后台）
echo ""
echo "2️⃣ 启动代理服务器 (localhost:3456)..."
cd "$PROXY_DIR"
node server.js > /tmp/tauri-proxy.log 2>&1 &
PROXY_PID=$!
cd "$PROJECT_ROOT"
echo "   PID: $PROXY_PID"

# 等待服务启动
echo "   等待服务启动..."
for i in {1..30}; do
    if curl -s http://localhost:3456/health > /dev/null 2>&1; then
        echo "   ✅ 代理服务器已启动"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ 服务启动超时"
        echo "   日志内容:"
        cat /tmp/tauri-proxy.log
        kill $PROXY_PID 2>/dev/null || true
        exit 1
    fi
    sleep 0.5
done

# 3. 显示配置
echo ""
echo "3️⃣ 代理配置:"
curl -s http://localhost:3456/status | head -20
echo ""

# 4. 测试连接
echo ""
echo "4️⃣ 测试 DeerAPI 连接..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "deerapi,claude-sonnet-4-5-20250929",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "你好，回复OK"}]
  }' 2>&1)

if echo "$TEST_RESPONSE" | grep -q "content"; then
    echo "   ✅ DeerAPI 连接测试成功"
else
    echo "   ⚠️  连接测试响应:"
    echo "$TEST_RESPONSE" | head -5
fi

# 5. 运行 Rust Agent SDK 测试
echo ""
echo "5️⃣ 运行 Rust Agent SDK 测试..."
echo "=========================================="
cd "$PROJECT_ROOT/src-tauri"

# 只显示关键输出，过滤警告
cargo run --example agent_sdk_example 2>&1 | \
    grep -v "warning:" | \
    grep -v "Compiling" | \
    grep -v "Finished" | \
    grep -v "Running"

TEST_EXIT_CODE=$?

# 6. 清理
echo ""
echo "=========================================="
echo "🧹 清理..."
kill $PROXY_PID 2>/dev/null || true
sleep 1

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ 测试成功完成!"
else
    echo "❌ 测试失败 (exit code: $TEST_EXIT_CODE)"
    echo ""
    echo "查看代理日志:"
    echo "  tail -f /tmp/tauri-proxy.log"
fi

echo ""
echo "📝 日志文件: /tmp/tauri-proxy.log"
exit $TEST_EXIT_CODE

