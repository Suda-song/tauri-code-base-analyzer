#!/bin/bash

# Claude Code Router 配置和启动脚本（前台运行模式）
# 使用项目中的 router-config.json 配置文件

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$PROJECT_ROOT/router-config.json"
ROUTER_CONFIG_DIR="$HOME/.claude-code-router"

echo "=========================================="
echo "🚀 配置并启动 Claude Code Router"
echo "=========================================="

# 1. 检查 ccr 是否安装
if ! command -v ccr &> /dev/null; then
    echo "❌ claude-code-router 未安装"
    echo ""
    echo "请先安装:"
    echo "  pnpm install -g @musistudio/claude-code-router"
    echo ""
    exit 1
fi

echo "✅ claude-code-router 已安装"

# 2. 检查项目配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

echo "✅ 找到配置文件: $CONFIG_FILE"

# 3. 创建 claude-code-router 配置目录
mkdir -p "$ROUTER_CONFIG_DIR"

# 4. 复制配置文件到 claude-code-router 目录
echo ""
echo "📝 配置 claude-code-router..."
cp "$CONFIG_FILE" "$ROUTER_CONFIG_DIR/config.json"
echo "   配置文件已复制到: $ROUTER_CONFIG_DIR/config.json"

# 5. 显示配置信息
echo ""
echo "📊 当前配置:"
echo "   提供商: $(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | head -1 | cut -d'"' -f4)"
echo "   API 端点: $(grep -o '"api_base_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | head -1 | cut -d'"' -f4)"
echo "   默认模型: $(grep -o '"default"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | head -1 | cut -d'"' -f4)"

# 6. 检查是否已有 ccr 进程运行
if pgrep -f "ccr start" > /dev/null || curl -s http://localhost:3456/health > /dev/null 2>&1; then
    echo ""
    echo "⚠️  检测到 claude-code-router 已在运行"
    echo "   正在停止..."
    ccr stop 2>/dev/null || pkill -f "ccr start" 2>/dev/null || true
    sleep 2
fi

# 7. 启动 claude-code-router（前台运行）
echo ""
echo "=========================================="
echo "✅ 启动 claude-code-router (前台模式)"
echo "=========================================="
echo ""
echo "💡 提示:"
echo "   - 服务器日志将显示在下方"
echo "   - 按 Ctrl+C 停止服务"
echo "   - 在另一个终端运行测试:"
echo "     cd src-tauri && cargo run --example agent_example"
echo ""
echo "=========================================="
echo ""

# 前台运行，可以看到所有输出
ccr start
