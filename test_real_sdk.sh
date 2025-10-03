#!/bin/bash

echo "=========================================="
echo "🧪 测试 Real Claude Agent SDK 集成"
echo "=========================================="

# 1. 检查 bridge 文件
echo ""
echo "1️⃣ 检查 TypeScript Bridge..."
if [ -f "scripts/dist/real-agent-sdk-bridge.js" ]; then
    echo "   ✅ Bridge 文件存在"
else
    echo "   ❌ Bridge 文件不存在，请运行: cd scripts && pnpm run build:real-agent"
    exit 1
fi

# 2. 检查 .env 文件
echo ""
echo "2️⃣ 检查环境变量..."
if [ -f "src-tauri/.env" ]; then
    echo "   ✅ .env 文件存在"
    if grep -q "ANTHROPIC_API_KEY" src-tauri/.env; then
        echo "   ✅ ANTHROPIC_API_KEY 已配置"
    else
        echo "   ⚠️  .env 文件存在但未配置 ANTHROPIC_API_KEY"
    fi
else
    echo "   ⚠️  .env 文件不存在"
    echo "   提示: echo 'ANTHROPIC_API_KEY=your-key' > src-tauri/.env"
fi

# 3. 尝试编译
echo ""
echo "3️⃣ 编译 Rust 项目..."
cd src-tauri
cargo build --example real_agent_sdk_example 2>&1 | head -20

if [ $? -eq 0 ]; then
    echo "   ✅ 编译成功"
else
    echo "   ⚠️  编译出现警告或错误（查看上方输出）"
fi

echo ""
echo "=========================================="
echo "📊 检查完成"
echo "=========================================="
echo ""
echo "如果一切正常，运行示例:"
echo "   cd src-tauri"
echo "   cargo run --example real_agent_sdk_example"

