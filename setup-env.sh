#!/bin/bash

# 环境变量配置脚本

echo "🚀 开始配置环境变量..."

# 进入 src-tauri 目录
cd "$(dirname "$0")/src-tauri" || exit

# 创建 .env.example 文件
cat > .env.example << 'EOF'
# Anthropic API Key
# 获取地址: https://console.anthropic.com/
# 复制此文件为 .env 并填入你的实际 API Key
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
EOF

echo "✅ 已创建 .env.example 文件"

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo ""
    echo "⚠️  请编辑 src-tauri/.env 文件，填入你的实际 API Key"
else
    echo "ℹ️  .env 文件已存在，跳过创建"
fi

# 返回项目根目录
cd ..

# 更新 .gitignore
if ! grep -q ".env" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Environment variables" >> .gitignore
    echo ".env" >> .gitignore
    echo "✅ 已更新 .gitignore"
else
    echo "ℹ️  .gitignore 已包含 .env"
fi

echo ""
echo "🎉 配置完成！"
echo ""
echo "📝 接下来的步骤："
echo "1. 编辑 src-tauri/.env 文件，填入你的 Anthropic API Key"
echo "2. 修改 src-tauri/src/main.rs 的 main 函数："
echo ""
echo "   fn main() {"
echo "       dotenv::dotenv().ok();  // 添加这一行"
echo "       run();"
echo "   }"
echo ""
echo "3. 运行项目: cargo run 或 npm run tauri dev"
echo ""

