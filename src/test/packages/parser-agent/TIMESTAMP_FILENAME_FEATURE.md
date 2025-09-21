# 时间戳文件名生成功能

## 概述

parser-agent 的 README 生成器现在支持智能文件名生成功能。当用户指定输出路径为目录时，系统会自动生成带时间戳的文件名，避免文件名冲突并提供更好的版本管理。

## 功能特点

### 🕐 时间戳格式
- **格式**: `YYYYMMDDHHMMSS` (14位数字)
- **示例**: `20250730143419`
- **对应时间**: 2025年7月30日 14:34:19

### 📁 文件名格式
- **格式**: `readme-YYYYMMDDHHMMSS.md`
- **示例**: `readme-20250730143419.md`

### 🎯 智能路径处理
- 支持相对路径和绝对路径
- 自动检测路径类型（目录 vs 文件）
- 智能生成文件名或使用指定文件名

## 使用场景

### 1. 输出到目录
```bash
# 自动生成带时间戳的文件名
parser-agent readme -o ./docs/
# 输出: ./docs/readme-20250730143419.md
```

### 2. 输出到绝对路径目录
```bash
# 自动生成带时间戳的文件名
parser-agent readme -o /tmp/project-docs/
# 输出: /tmp/project-docs/readme-20250730143419.md
```

### 3. 输出到具体文件
```bash
# 使用指定的文件名
parser-agent readme -o ./docs/my-readme.md
# 输出: ./docs/my-readme.md
```

### 4. 输出到默认文件名
```bash
# 自动生成带时间戳的文件名
parser-agent readme -o readme.md
# 输出: ./readme-20250730143419.md
```

## 命令行示例

### 基本用法
```bash
# 生成中文 README 到当前目录
parser-agent readme

# 生成英文 README 到指定目录
parser-agent readme -l en-US -o ./docs/

# 强制覆盖现有文件
parser-agent readme --force -o ./output/

# 预览模式（不保存文件）
parser-agent readme --preview -o ./docs/
```

### 高级用法
```bash
# 使用自定义模板
parser-agent readme -t technical -o ./docs/

# 结合自定义文件
parser-agent readme -c ./custom.md -o ./docs/

# 渐进式更新
parser-agent patch-readme -o ./docs/
```

## 实现细节

### 路径处理逻辑
1. **绝对路径检查**: 如果是绝对路径且指向目录，生成时间戳文件名
2. **相对路径解析**: 解析为绝对路径后检查是否为目录
3. **父目录检查**: 检查父目录是否存在，处理默认文件名情况
4. **智能回退**: 如果路径指向文件，使用指定文件名

### 时间戳生成
```javascript
function generateTimestampedFilename(baseDir, prefix = 'readme') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}${hour}${minute}${second}`;
    const filename = `${prefix}-${timestamp}.md`;
    
    return path.join(baseDir, filename);
}
```

## 优势

### 🎯 避免冲突
- 每次生成的文件名都是唯一的
- 不会覆盖现有的 README 文件
- 支持批量生成多个版本

### 📊 版本管理
- 时间戳提供清晰的时间信息
- 便于追踪文档的生成历史
- 支持按时间排序和管理

### 🔧 灵活使用
- 支持目录和文件路径
- 智能检测路径类型
- 向后兼容现有用法

## 测试

### 运行测试脚本
```bash
# 测试时间戳生成功能
node test-timestamp-filename.js

# 查看功能演示
node demo-timestamp-feature.js
```

### 测试用例
1. **目录路径测试**: 验证目录路径自动生成时间戳文件名
2. **文件路径测试**: 验证文件路径使用指定文件名
3. **时间戳格式测试**: 验证时间戳格式正确性
4. **路径解析测试**: 验证相对路径和绝对路径处理

## 注意事项

### ⚠️ 重要提醒
- 时间戳基于系统当前时间
- 确保系统时间准确以获得正确的时间戳
- 时间戳精确到秒，同一秒内多次生成会覆盖

### 🔄 向后兼容
- 现有命令和参数完全兼容
- 默认行为保持不变
- 新增功能为可选特性

### 📝 最佳实践
- 使用目录路径进行批量生成
- 结合 `--preview` 选项预览效果
- 使用 `--force` 选项强制覆盖（谨慎使用）

## 更新日志

### v1.0.0 (2025-07-30)
- ✨ 新增时间戳文件名生成功能
- 🔧 智能路径处理逻辑
- 📝 更新命令行帮助信息
- 🧪 添加测试和演示脚本
- 📚 完善文档说明

## 相关文件

- `src/readme-generator/index.ts` - 主要实现逻辑
- `src/cli.ts` - 命令行处理逻辑
- `test-timestamp-filename.js` - 测试脚本
- `demo-timestamp-feature.js` - 演示脚本
- `TIMESTAMP_FILENAME_FEATURE.md` - 本文档 