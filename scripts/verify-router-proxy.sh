#!/bin/bash

# 验证请求是否被代理到 claude-code-router

echo "🔍 验证 claude-code-router 代理"
echo "=========================================="

# 1. 检查 Router 是否在运行
echo ""
echo "Step 1: 检查 Router 状态..."
if curl -s http://localhost:3456/health > /dev/null 2>&1; then
    echo "✅ Router 正在运行 (http://localhost:3456)"
else
    echo "❌ Router 未运行"
    echo ""
    echo "请先启动 Router:"
    echo "  ccr start"
    echo ""
    exit 1
fi

# 2. 测试直接调用 Router
echo ""
echo "Step 2: 测试直接调用 Router API..."
echo ""
echo "发送测试请求..."

RESPONSE=$(curl -s -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "x-api-key: test-key" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "请说：测试成功"
      }
    ]
  }' 2>&1)

echo ""
echo "Router 响应:"
echo "$RESPONSE" | jq -r '.content[0].text // .error // .' 2>/dev/null || echo "$RESPONSE"

# 3. 检查响应
echo ""
echo "Step 3: 分析响应..."
if echo "$RESPONSE" | grep -q "测试成功\|content"; then
    echo "✅ Router 代理工作正常"
    echo "   请求已成功转发到 DeerAPI"
elif echo "$RESPONSE" | grep -q "error\|Error"; then
    echo "⚠️  Router 返回错误:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo "❓ 无法确定状态，原始响应:"
    echo "$RESPONSE"
fi

# 4. 显示配置
echo ""
echo "Step 4: 当前 Router 配置..."
if [ -f "$HOME/.claude-code-router/config.json" ]; then
    echo "配置文件位置: $HOME/.claude-code-router/config.json"
    echo ""
    echo "提供商配置:"
    cat "$HOME/.claude-code-router/config.json" | jq -r '.Providers[] | "  • \(.name): \(.api_base_url)"' 2>/dev/null || echo "  (无法解析配置)"
    echo ""
    echo "路由配置:"
    cat "$HOME/.claude-code-router/config.json" | jq -r '.Router | to_entries[] | "  • \(.key): \(.value)"' 2>/dev/null || echo "  (无法解析配置)"
else
    echo "⚠️  配置文件不存在"
fi

echo ""
echo "=========================================="
echo "💡 验证说明:"
echo ""
echo "如果 Agent SDK 正确配置，它会:"
echo "  1. 读取 ANTHROPIC_API_KEY 环境变量"
echo "  2. 发送请求到 Anthropic API 端点"
echo "  3. claude-code-router 拦截这些请求"
echo "  4. 根据配置转发到 DeerAPI"
echo "  5. 返回 DeerAPI 的响应"
echo ""
echo "要验证 SDK 是否使用了 Router，请:"
echo "  1. 运行: ./scripts/test-agent-chat.sh"
echo "  2. 观察日志中是否有 DeerAPI 相关信息"
echo "  3. 检查返回的模型名称是否是 DeerAPI 的模型"
echo "=========================================="

