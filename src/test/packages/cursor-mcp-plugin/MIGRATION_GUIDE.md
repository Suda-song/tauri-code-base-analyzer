# 🔄 cursor-mcp-plugin 架构迁移指南

## 📋 迁移步骤

### 第一步: 备份原文件
```bash
cd packages/cursor-mcp-plugin/src
mv index.ts index.old.ts
```

### 第二步: 启用新架构
```bash
mv index-refactored.ts index.ts
```

### 第三步: 验证功能
```bash
# 重新构建项目
cd packages/cursor-mcp-plugin
pnpm run build

# 测试 MCP 服务器
pnpm run start
```

### 第四步: 更新 package.json（如需要）
检查并更新 `package.json` 中的 `main` 字段：
```json
{
  "main": "dist/index.js"
}
```

## 🔧 故障排除

### 问题1: 类型错误
如果遇到 TypeScript 类型错误，请检查：
- 是否所有新模块都正确导入
- 类型定义是否完整
- `tsconfig.json` 配置是否正确

### 问题2: 工具注册失败
如果工具无法正确注册：
1. 检查 `ToolRegistry` 中的工具定义
2. 确认所有处理器类都正确实例化
3. 验证 MCP 协议版本兼容性

### 问题3: 运行时错误
如果运行时出现错误：
1. 检查实体文件路径是否正确
2. 确认 RAG 工具初始化成功
3. 查看控制台错误日志

## 🚀 验证迁移成功

### 功能测试清单
- [ ] `start-analysis` 工具正常工作
- [ ] `select-core-component` 智能关联功能正常
- [ ] `modify-entity-selection` 实体修改功能正常
- [ ] `generate-code-prompt` 代码生成正常
- [ ] `quick-analysis` 快速分析正常
- [ ] 会话状态管理正常
- [ ] 错误处理机制正常

### 性能验证
- [ ] 启动时间无明显变化
- [ ] 内存使用无异常增长
- [ ] 工具响应时间正常

## 📈 迁移收益

### 立即收益
- ✅ 代码结构更清晰
- ✅ 维护成本降低
- ✅ 开发效率提升

### 长期收益
- 🚀 新功能扩展更容易
- 🧪 单元测试覆盖率可提升
- 👥 多人协作更高效
- 📊 代码质量持续改善

## 🔄 回滚方案

如果迁移过程中遇到无法解决的问题，可以快速回滚：

```bash
cd packages/cursor-mcp-plugin/src
mv index.ts index-refactored.ts
mv index.old.ts index.ts
pnpm run build
```

## 📞 支持

如果在迁移过程中遇到问题，请：
1. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解架构详情
2. 检查控制台错误日志
3. 比较新旧版本的差异
4. 提交 Issue 描述具体问题

## 🎯 下一步

迁移完成后，可以考虑：
1. 添加单元测试覆盖关键模块
2. 实现新的分析功能
3. 优化现有工具的性能
4. 扩展支持更多代码分析场景

祝您迁移顺利！🎉 