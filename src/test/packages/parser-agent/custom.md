# 商家商品侧 README Agent 优化点

## 架构特点说明

### UI与逻辑解耦架构
代码是UI和逻辑解耦的架构，其中逻辑层大部分在shared-item里，所以shared-item的信息也要呈现在readme中。

### 目录结构优化需求
Project Directory Structure 的目录描述有点杂乱，需要重新梳理下另外尽可能齐全。

## 重点关注事项

- **shared-item 逻辑层**: 需要特别关注和展示 shared-item 目录中的业务逻辑组件
- **架构解耦**: 强调 UI 层与逻辑层的分离设计
- **目录结构完整性**: 确保目录结构描述的完整性和清晰性 