"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolTriggers = exports.serverConfig = void 0;
const shared_utils_1 = require("@xhs/shared-utils");
// 获取工作空间路径数组（支持多workspace）
const workspacePaths = (0, shared_utils_1.getWorkspacePath)();
const entitiesFilePaths = (0, shared_utils_1.getEntitiesFilePath)('entities.enriched.json');
// 服务器配置
exports.serverConfig = {
    name: process.env.APP_NAME || "code-research-server",
    version: process.env.APP_VERSION || "0.1.0",
    // 多workspace支持
    workspacePaths: workspacePaths,
    entitiesFilePaths: entitiesFilePaths,
    // 是否直接返回工具结果，不经过大模型处理
    returnDirect: process.env.MCP_RETURN_DIRECT === "true" || false,
};
// 工具触发条件配置
exports.toolTriggers = {
    "start-analysis": {
        priority: 1.0,
        default: true,
        patterns: [
            /.*(需求|功能|特性|bug|问题|优化|重构).*/,
            /.*(修改|增加|添加|删除|调整|优化|重构).*/,
            /.*(页面|组件|按钮|事件|流程|逻辑).*/,
        ]
    }
};
