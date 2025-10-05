#!/bin/bash

# 持续会话快速启动脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Claude Agent SDK - 持续会话模式"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ 核心特性:"
echo "   ✅ 一次启动，持续对话"
echo "   ✅ AI 完整记忆所有历史"
echo "   ✅ 自动使用 17 种内置工具"
echo "   ✅ 无需 resume，SDK 自动管理"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查编译
if [ ! -f "scripts/dist/continuous-session-bridge.js" ]; then
    echo "⚠️  Bridge 未编译，正在编译..."
    cd scripts && pnpm run build:continuous && cd ..
    echo "✅ 编译完成"
    echo ""
fi

# 检查 API Key
if [ -f "src-tauri/.env" ]; then
    echo "✅ .env 配置已找到"
elif [ -f "router-config.json" ]; then
    echo "✅ router-config.json 配置已找到"
else
    echo "⚠️  未找到 API Key 配置"
    echo "   请确保以下文件之一存在:"
    echo "   - src-tauri/.env (包含 ANTHROPIC_API_KEY)"
    echo "   - router-config.json (包含 DeerAPI 配置)"
    echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 使用提示:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 📝 基础对话:"
echo "   你> 你好"
echo "   AI> 你好！我可以帮你..."
echo ""
echo "2. 🔧 执行任务:"
echo "   你> 帮我分析一下这个项目的结构"
echo "   AI> (自动使用 glob 和 grep 搜索)"
echo ""
echo "3. 🔄 持续对话:"
echo "   你> 帮我添加日志功能"
echo "   AI> (完成任务...)"
echo "   你> 优化一下刚才的日志格式"
echo "   AI> (记住之前的内容，继续优化...)"
echo ""
echo "4. 📊 查看信息:"
echo "   输入 'info' - 查看会话信息"
echo "   输入 'exit' - 退出程序"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 正在启动..."
echo ""

# 启动
cd scripts
node dist/continuous-session-bridge.js
