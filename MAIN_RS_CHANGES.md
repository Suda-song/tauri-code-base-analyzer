# main.rs 修改指南

## 📝 需要修改的文件

**文件路径：** `src-tauri/src/main.rs`

## 🔧 修改内容

### 找到 main 函数（在文件末尾，约 246 行）

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

    #[cfg(debug_assertions)]
    println!("🔧 环境变量已加载");

    run();
}
```

## 📋 完整改动

只需要在 `run();` 之前添加这两行：

```rust
dotenv::dotenv().ok();
#[cfg(debug_assertions)]
println!("🔧 环境变量已加载");
```

## ✅ 验证修改

保存文件后，运行：

```bash
cd src-tauri
cargo build
```

如果编译成功，说明修改正确！

## 🎯 下一步

1. ✅ dotenv 依赖已添加（Cargo.toml）
2. ✅ .env 和 .env.example 文件已创建
3. ✅ .gitignore 已更新
4. ⏳ **修改 main.rs（请按照上面的指南修改）**
5. ⏳ **编辑 src-tauri/.env，填入你的 Anthropic API Key**

## 🔑 获取 API Key

访问：https://console.anthropic.com/

## 🚀 运行项目

```bash
# 方式 1
cd src-tauri
cargo run

# 方式 2
npm run tauri dev
```

成功后你会看到：

```
🔧 环境变量已加载
✅ Claude 客户端初始化成功
```
