# README 生成器 CLI 使用示例

## 概述

这个 CLI 工具复用了现有的项目文件遍历和代码分析能力，结合 AI 服务生成专业的 README 文档。

## 基本使用方法

### 1. 生成当前项目的 README（最简单的用法）

```bash
# 在项目根目录运行
npx parser-agent readme

# 或者使用完整命令
npx parser-agent generate-readme
```

### 2. 预览模式（推荐首次使用）

```bash
# 先预览生成的内容，不保存文件
npx parser-agent readme --preview

# 满意后再正式生成
npx parser-agent readme --force
```

### 3. 生成英文 README

```bash
# 生成英文版本
npx parser-agent readme -l en-US -o README.en.md

# 生成到 docs 目录
npx parser-agent readme -l en-US -o docs/README.md
```

### 4. 分析指定项目

```bash
# 分析其他项目
npx parser-agent readme /path/to/project -o /path/to/output/README.md

# 分析子项目
npx parser-agent readme ./apps/my-app -o ./apps/my-app/README.md
```

### 5. 详细模式（显示完整的生成过程）

```bash
# 显示详细的分析和生成过程
npx parser-agent readme --verbose

# 结合预览模式
npx parser-agent readme --preview --verbose
```

### 6. 强制覆盖现有文件

```bash
# 当 README.md 已存在时，强制覆盖
npx parser-agent readme --force

# 结合其他选项
npx parser-agent readme --force --verbose -l en-US
```

## 高级用法

### 批量生成多语言 README

```bash
#!/bin/bash
# 生成多语言 README 的脚本

# 生成中文版
npx parser-agent readme -l zh-CN -o README.zh.md --force

# 生成英文版
npx parser-agent readme -l en-US -o README.en.md --force

# 生成默认版本（中文）
npx parser-agent readme --force

echo "✅ 多语言 README 生成完成"
```

### 项目文档自动化

```bash
#!/bin/bash
# 项目文档自动化脚本

PROJECT_DIR="$1"
if [ -z "$PROJECT_DIR" ]; then
    echo "请提供项目目录路径"
    exit 1
fi

echo "🔍 分析项目: $PROJECT_DIR"

# 先预览
echo "📝 预览生成的 README..."
npx parser-agent readme "$PROJECT_DIR" --preview

read -p "是否继续生成？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 生成中英文版本
    npx parser-agent readme "$PROJECT_DIR" -l zh-CN -o "$PROJECT_DIR/README.zh.md" --force --verbose
    npx parser-agent readme "$PROJECT_DIR" -l en-US -o "$PROJECT_DIR/README.en.md" --force --verbose
    npx parser-agent readme "$PROJECT_DIR" --force --verbose
    
    echo "✅ 文档生成完成"
else
    echo "❌ 取消生成"
fi
```

## 命令选项详解

### 主要选项

- `-o, --output <file>`: 指定输出文件路径（默认: README.md）
- `-t, --template <type>`: 文档模板类型（默认: comprehensive）
- `-l, --language <lang>`: 文档语言（zh-CN: 中文, en-US: 英文）

### 行为控制选项

- `--preview`: 预览模式，输出到控制台而不保存文件
- `--force`: 强制覆盖已存在的 README 文件
- `--verbose`: 显示详细的生成过程和统计信息

### 获取帮助

```bash
# 查看所有命令
npx parser-agent --help

# 查看 README 生成器的详细帮助
npx parser-agent help-readme

# 查看特定命令的帮助
npx parser-agent readme --help
```

## 输出示例

### 正常生成模式

```
=== AI 友好 README 生成器 ===
项目目录: /Users/user/my-project
输出文件: README.md
文档模板: comprehensive
文档语言: zh-CN
预览模式: 否
==============================

🔍 开始分析项目结构...
📊 分析项目结构...
📈 分析代码统计...
🔗 分析依赖关系...
🛠️ 识别技术栈...
🏗️ 分析架构模式...
✨ 评估最佳实践...
✅ 提取了 245 个代码实体
✅ 项目分析完成
🤖 开始LLM递归分析...
📝 正在生成 README 文档...
✅ README已生成并保存到: README.md
📄 文件大小: 12.34 KB

=== 生成完成 ===
✅ README 已生成: README.md
📁 文件大小: 12.34 KB
⏱️  总耗时: 45230ms

🎉 README 生成完成!
```

### 详细模式输出

```
=== 详细统计 ===
📊 总行数: 485
📊 总字数: 3642
📊 总字符数: 12634
```

### 预览模式输出

```
=== README 预览 ===
# My Project

一个基于现代技术栈的项目

## 📋 项目信息

- **项目类型**: Vue应用
- **技术栈**: Vue.js, TypeScript, Vite, Element Plus
...

=== 预览结束 ===

⏱️  生成耗时: 42150ms
💡 使用 --no-preview 选项来实际保存文件
```

## 常见问题排除

### 1. 网络连接问题

```bash
# 如果遇到网络问题，可以：
# 1. 检查网络连接
# 2. 尝试使用 VPN
# 3. 检查防火墙设置
```

### 2. 文件权限问题

```bash
# 确保有写入权限
chmod +w README.md

# 或者使用不同的输出路径
npx parser-agent readme -o /tmp/README.md
```

### 3. 项目分析问题

```bash
# 确保项目包含有效的代码文件
ls -la src/

# 检查是否有 package.json
cat package.json

# 使用详细模式查看问题
npx parser-agent readme --verbose
```

## 最佳实践

1. **首次使用建议使用预览模式**，确认生成效果
2. **对于大型项目，耐心等待**，分析可能需要较长时间
3. **网络连接必须稳定**，因为需要调用 AI 服务
4. **建议在项目根目录运行**，获得最佳分析效果
5. **定期更新 README**，随着项目发展保持文档最新

## 集成到 CI/CD

```yaml
# .github/workflows/update-readme.yml
name: Update README

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  update-readme:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Generate README
      run: npx parser-agent readme --force --verbose
    
    - name: Commit changes
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add README.md
        git commit -m "📝 Update README" || exit 0
        git push
```

这个 CLI 工具充分复用了现有的项目遍历和分析能力，为你的项目生成专业的 README 文档！ 