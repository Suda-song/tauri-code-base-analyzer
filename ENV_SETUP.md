# 环境变量配置说明

## 📝 配置步骤

### 1. 创建 .env 文件

在 `src-tauri` 目录下创建 `.env` 文件：

```bash
cd src-tauri
touch .env
```

然后编辑 `.env` 文件，添加以下内容：

```bash
# Anthropic API Key
# 获取地址: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

### 2. 修改 main.rs

在 `src-tauri/src/main.rs` 文件中，修改 `main` 函数：

**修改前：**

```rust
fn main() {
    run();
}
```

**修改后：**

```rust
fn main() {
    // 加载 .env 文件中的环境变量
    dotenv::dotenv().ok();

    println!("🔧 环境变量已加载");

    run();
}
```

### 3. 创建 .env.example 文件（可选）

在 `src-tauri` 目录下创建 `.env.example` 作为模板：

```bash
# .env.example
# 复制此文件为 .env 并填入你的实际 API Key
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

### 4. 更新 .gitignore

确保 `.gitignore` 中包含：

```
# Environment variables
.env
```

## ✅ 验证配置

运行项目后，如果配置正确，你会看到：

```
🔧 环境变量已加载
✅ Claude 客户端初始化成功
```

如果 API Key 未配置，会看到：

```
⚠️  Claude 客户端初始化失败: environment variable not found，将使用回退逻辑
```

## 🔑 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 在 API Keys 页面创建新的 API Key
4. 复制 API Key 到 `.env` 文件中

## 📋 文件结构

```
tauri-code-base-analyzer/
├── src-tauri/
│   ├── .env              # 本地配置（不提交到 git）
│   ├── .env.example      # 配置模板（提交到 git）
│   ├── src/
│   │   └── main.rs       # 需要修改此文件加载 dotenv
│   └── Cargo.toml        # 已包含 dotenv 依赖
└── .gitignore            # 确保包含 .env
```

## 🚀 运行项目

```bash
cd src-tauri
cargo run
```

或者在项目根目录：

```bash
npm run tauri dev
```
