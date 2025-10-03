#!/bin/bash

# 测试 Claude TypeScript SDK 桥接器

set -e

echo "🧪 测试 Claude TypeScript SDK 桥接器"
echo "======================================"
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

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# 检查构建的脚本
if [ ! -f "dist/claude-bridge.js" ]; then
    echo "❌ 错误: 桥接脚本未构建"
    echo "请运行: npm run build"
    exit 1
fi

echo "✅ 桥接脚本已构建"
echo ""

# 测试 1: 简单查询
echo "📝 测试 1: 简单查询"
echo "----------------------------------------"
echo '{"action":"query","prompt":"用一句话介绍 Rust","maxTokens":100}' | node dist/claude-bridge.js
echo ""
echo "✅ 测试 1 通过"
echo ""

# 测试 2: 带工具的查询
echo "📝 测试 2: 带工具的查询"
echo "----------------------------------------"
cat <<'EOF' | node dist/claude-bridge.js
{
  "action": "query_with_tools",
  "prompt": "如果我要计算 1+1，你会怎么做？",
  "maxTokens": 500,
  "tools": [{
    "name": "calculator",
    "description": "执行数学计算",
    "input_schema": {
      "type": "object",
      "properties": {
        "expression": {
          "type": "string",
          "description": "数学表达式"
        }
      },
      "required": ["expression"]
    }
  }]
}
EOF
echo ""
echo "✅ 测试 2 通过"
echo ""

echo "======================================"
echo "🎉 所有测试通过！"
echo ""
echo "桥接器工作正常，可以在 Rust 中使用了。"
echo ""
