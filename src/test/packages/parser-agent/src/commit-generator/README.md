<div align="center">
  <h1 align="center">AI Commit Generator</h1>
  <p>智能AI提交信息生成器 - 用AI为你的代码变更自动生成规范的Git提交信息</p>
  <p>再也不用为写提交信息而烦恼，让AI帮你生成专业的提交信息。</p>
</div>

---

## 前置条件

### 安装 Modular 插件
> **说明**: 本工具基于 Modular 代码分析框架，需要先安装相关插件。
> 
> _（此部分内容待补充）_

### 安装依赖

确保你的环境满足以下要求：

- **Node.js**: 推荐 v16 或更高版本
- **Git**: 确保项目是 Git 仓库
- **pnpm**: 推荐使用 pnpm 作为包管理器

1. **安装项目依赖**:
   ```bash
   cd packages/parser-agent
   pnpm install
   ```

2. **构建项目**:
   ```bash
   pnpm build
   ```

### 检查版本

检查工具是否正确安装：

```bash
ai-commit --version
```

---

## 配置上下文

> **说明**: 目标上下文功能可以帮助AI更好地理解你的开发意图。
> 
> _（此部分配置功能即将被弃用，可以忽略）_

### 设置目标上下文

为当前分支设置开发上下文信息：

```bash
ai-commit context set
```

这将启动交互式配置，你可以输入：
- **PRD需求描述**: 产品需求文档内容
- **PingCode任务内容**: 具体的开发任务
- **技术方案**: 实现的技术方案

### 查看当前上下文

```bash
ai-commit context show
```

### 清除上下文配置

```bash
ai-commit context clear
```

---

## 正常开发

### 暂存文件

在使用 AI 生成提交信息之前，需要先暂存你要提交的文件：

```bash
# 暂存特定文件
git add src/components/UserLogin.tsx

# 或暂存所有更改
git add .
```

### 使用指令

#### 基本使用

为已暂存的更改生成提交信息：

```bash
ai-commit
```

或使用简写：

```bash
aic
```

**交互流程示例**:
```bash
🚀 AI智能提交生成器
===================

🔍 分析代码变更...
📦 已从配置加载目标上下文 (分支: feature/user-auth)

📝 生成的提交消息: feat: 添加用户登录组件验证功能

❓ 是否使用此提交消息？(y/n): y

🚀 执行提交...
✅ 提交成功！
```

#### 一键暂存并提交

自动暂存所有跟踪文件的更改并生成提交：

```bash
ai-commit --all
# 或
ai-commit -a
```

#### 生成多个候选消息

生成多个提交信息供你选择：

```bash
ai-commit --generate 3
# 或
ai-commit -g 3
```

**输出示例**:
```bash
📊 生成的候选提交消息:

1. feat: 添加用户登录组件验证功能
   置信度: 85.2%

2. feat: 实现用户登录表单验证逻辑
   置信度: 78.9%

3. update: 优化用户登录组件代码结构
   置信度: 72.1%

❓ 请选择提交消息 (1-3)，或输入 'n' 复制到剪贴板: 1
```

### 完整工作流程示例

```bash
# 1. 创建新功能分支
git checkout -b feature/user-profile

# 2. 开发代码
vim src/components/UserProfile.tsx

# 3. 暂存文件
git add src/components/UserProfile.tsx

# 4. 生成并提交
ai-commit

# 5. 继续开发
git add src/api/userProfile.ts
ai-commit

# 6. 一键暂存所有文件并提交
ai-commit --all
```

---

## 配置大全

### 配置管理

#### 查看所有配置

```bash
ai-commit config get
```

#### 查看单个或多个配置

```bash
# 查看单个配置
ai-commit config get locale

# 查看多个配置
ai-commit config get locale generate timeout
```

#### 设置配置

```bash
# 设置单个配置
ai-commit config set locale=en

# 设置多个配置
ai-commit config set locale=zh generate=3 max-length=80
```

### 配置选项详解

| 配置项 | 类型 | 有效值 | 默认值 | 说明 |
|--------|------|--------|--------|------|
| `locale` | string | `zh`, `en` | `zh` | 生成消息的语言 |
| `generate` | number | 1-5 | 1 | 单次生成的候选消息数量 |
| `timeout` | number | ≥500 | 10000 | AI请求超时时间（毫秒） |
| `max-length` | number | ≥20 | 50 | 提交信息最大字符长度 |
| `type` | string | `conventional` | `conventional` | 提交信息格式类型 |

### 配置示例

#### 设置为英文环境

```bash
ai-commit config set locale=en
```

#### 增加候选消息数量

```bash
ai-commit config set generate=3
```

#### 调整超时时间

```bash
ai-commit config set timeout=20000  # 20秒
```

#### 设置消息长度限制

```bash
ai-commit config set max-length=100
```

### 配置文件

配置文件位置：`~/.ai-commit`

**配置文件示例**:
```json
{
  "locale": "zh",
  "generate": "2",
  "timeout": "10000",
  "max-length": "50",
  "type": "conventional"
}
```

---

## 常见问题

### 错误处理

#### 没有暂存文件

```bash
❌ 没有暂存的文件，请先使用 git add 暂存文件或使用 --all 选项

# 解决方案：
git add .              # 暂存所有文件
# 或
ai-commit --all        # 自动暂存所有跟踪文件
```

#### 不是 Git 仓库

```bash
❌ 无法检查暂存文件，请确保当前目录是Git仓库

# 解决方案：
git init               # 初始化Git仓库
# 或
cd /path/to/git/repo   # 切换到Git仓库目录
```

#### 配置格式错误

```bash
❌ 设置配置失败: Invalid format: locale. Expected format: key=value

# 解决方案：
ai-commit config set locale=zh  # 使用正确的key=value格式
```

### 获取帮助

```bash
# 查看主命令帮助
ai-commit --help

# 查看配置子命令帮助
ai-commit config --help

# 查看上下文子命令帮助
ai-commit context --help
```

---

## 工作原理

这个CLI工具通过以下步骤工作：

1. **代码分析**: 运行 `git diff` 获取所有暂存的代码变更
2. **上下文收集**: 收集目标上下文信息（如果已配置）
3. **AI生成**: 将代码变更和上下文信息发送给AI模型
4. **消息生成**: AI基于代码变更的语义和上下文生成合适的提交信息
5. **用户确认**: 展示生成的提交信息供用户确认或选择
6. **执行提交**: 使用生成的消息执行 `git commit`

---

## 快速指令参考

| 指令 | 简写 | 功能描述 |
|------|------|----------|
| `ai-commit` | `aic` | 为已暂存的更改生成提交信息 |
| `ai-commit --all` | `ai-commit -a` | 暂存所有跟踪文件的更改并提交 |
| `ai-commit --generate <i>` | `ai-commit -g <i>` | 生成i个提交信息供选择 |
| `ai-commit config get` | - | 获取所有配置值 |
| `ai-commit config set <key>=<value>` | - | 设置配置项 |
| `ai-commit context set` | - | 设置目标上下文 |
| `ai-commit context show` | - | 显示当前上下文 |
| `ai-commit context clear` | - | 清除上下文配置 |
| `ai-commit --help` | - | 显示帮助信息 |
| `ai-commit --version` | - | 显示版本信息 |

---

## 技术实现

- **核心引擎**: 基于现有的 `generateCommit` 函数
- **CLI框架**: Commander.js
- **配置存储**: JSON格式，存储在 `~/.ai-commit`
- **Git集成**: 通过 `execSync` 执行Git命令
- **交互体验**: readline实现用户选择界面
- **分支管理**: 自动获取当前Git分支，实现分支级别的上下文隔离 