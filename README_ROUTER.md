# Claude Code Router 使用说明

## 📦 文件说明

- **router-config.json** - 项目中的 Claude Code Router 配置文件
- **setup-router.sh** - 自动配置和启动脚本

## 🚀 快速开始

### 1. 修改配置（可选）

编辑 `router-config.json`，修改你的 DeerAPI Key 或其他设置：

```bash
vim router-config.json
```

主要配置项：
- `api_key` - 你的 DeerAPI Key
- `models` - 可用的模型列表
- `Router.default` - 默认使用的模型

### 2. 运行配置脚本

```bash
./setup-router.sh
```

这个脚本会：
1. ✅ 检查 ccr 是否安装
2. ✅ 读取项目中的 `router-config.json`
3. ✅ 复制配置到 `~/.claude-code-router/config.json`
4. ✅ 启动 claude-code-router 服务
5. ✅ 测试 DeerAPI 连接
6. ✅ 显示使用说明

### 3. 运行测试

```bash
cd src-tauri
cargo run --example agent_sdk_example
```

## 🔧 常用操作

### 查看服务状态

```bash
ccr status
```

### 重启服务（修改配置后）

```bash
./setup-router.sh  # 会自动重启
```

或手动：

```bash
ccr restart
```

### 停止服务

```bash
ccr stop
```

### 查看日志

```bash
# 实时日志
tail -f /tmp/ccr.log

# 或官方日志
tail -f ~/.claude-code-router/logs/ccr-*.log
```

### 使用 UI 配置

```bash
ccr ui
```

## 📝 配置文件结构

```json
{
  "Providers": [
    {
      "name": "deerapi",                                    // 提供商名称
      "api_base_url": "https://api.deerapi.com/v1/messages", // API 端点
      "api_key": "your-key",                                // API Key
      "models": ["claude-sonnet-4-5-20250929"],            // 可用模型
      "transformer": {"use": ["anthropic"]}                 // 格式转换器
    }
  ],
  "Router": {
    "default": "deerapi,claude-sonnet-4-5-20250929",       // 默认路由
    "background": "deerapi,claude-3-5-sonnet-20241022",    // 后台任务
    "think": "deerapi,claude-opus-4-1-20250805"            // 推理任务
  }
}
```

## 🎯 工作流程

```
1. 编辑 router-config.json (配置你的设置)
   ↓
2. 运行 ./setup-router.sh (配置并启动服务)
   ↓
3. 运行 cargo run --example agent_sdk_example (测试)
```

## ⚠️ 注意事项

1. **首次使用**: 确保已安装 `ccr`
   ```bash
   pnpm install -g @musistudio/claude-code-router
   ```

2. **修改配置**: 修改 `router-config.json` 后，重新运行 `./setup-router.sh`

3. **端口占用**: 默认使用 3456 端口，如需修改，编辑配置文件的 `PORT` 字段

4. **环境变量**: 确保 `src-tauri/.env` 中有：
   ```bash
   ANTHROPIC_BASE_URL="http://localhost:3456"
   ANTHROPIC_API_KEY="any-key-is-ok"
   ```

## 🐛 故障排查

### 问题: 服务启动失败

```bash
# 查看详细日志
tail -50 /tmp/ccr.log

# 检查端口是否被占用
lsof -i :3456

# 杀死占用进程
pkill -f "ccr start"
```

### 问题: 配置不生效

```bash
# 确认配置文件位置
cat ~/.claude-code-router/config.json

# 重新运行配置脚本
./setup-router.sh
```

### 问题: 测试连接失败

```bash
# 手动测试
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{"model": "deerapi,claude-sonnet-4-5-20250929", "max_tokens": 50, "messages": [{"role": "user", "content": "Hello"}]}'
```

## 📚 更多信息

- **Claude Code Router 文档**: https://github.com/musistudio/claude-code-router
- **项目架构文档**: `REAL_AGENT_SDK_ARCHITECTURE.md`
- **DeerAPI 集成指南**: `DEERAPI_INTEGRATION_GUIDE.md`
