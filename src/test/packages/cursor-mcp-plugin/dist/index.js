#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const server_config_1 = require("./config/server-config");
const params_1 = require("./tools/params");
const start_analysis_handler_1 = require("./tools/handlers/start-analysis-handler");
const core_component_handler_1 = require("./tools/handlers/core-component-handler");
const modify_entity_handler_1 = require("./tools/handlers/modify-entity-handler");
const generate_prompt_handler_1 = require("./tools/handlers/generate-prompt-handler");
const quick_analysis_handler_1 = require("./tools/handlers/quick-analysis-handler");
const entity_file_status_handler_1 = require("./tools/handlers/entity-file-status-handler");
const multi_workspace_utils_1 = require("./utils/multi-workspace-utils");
/**
 * 主服务器类
 */
class CodeAnalysisServer {
    constructor() {
        this.server = new mcp_js_1.McpServer({
            name: server_config_1.serverConfig.name,
            version: server_config_1.serverConfig.version,
            // 优化工具触发条件，提高start-analysis的可发现性
            toolTriggers: {
                [params_1.TOOL_NAMES.START_ANALYSIS]: {
                    priority: 1.0,
                    default: true,
                    patterns: [
                        // 功能开发相关
                        /.*(?:实现|开发|创建|制作|构建|添加|新增).*(?:功能|特性|组件|页面|模块).*/,
                        // Bug修复相关  
                        /.*(?:修复|解决|修改|调试).*(?:bug|错误|问题|异常).*/,
                        // 优化相关
                        /.*(?:优化|改进|改善|提升).*(?:性能|体验|效率|速度).*/,
                        // 重构相关
                        /.*(?:重构|重写|整理|优化).*(?:代码|结构|架构|逻辑).*/,
                        // 通用编程需求
                        /.*(?:需要|想要|希望|计划|打算).*(?:写|做|改|加).*/,
                        // 直接的编程动作
                        /^(?:写|做|改|加|实现|开发|创建|修复|优化|重构).*/,
                    ]
                },
                [params_1.TOOL_NAMES.QUICK_ANALYSIS]: {
                    priority: 0.8,
                    patterns: [
                        /.*(?:快速|直接|立即|马上).*(?:生成|出码|实现).*/,
                        /.*一键.*(?:分析|生成|出码).*/,
                    ]
                }
            }
        });
        // 检查是否有任何可用的workspace
        this.hasEntitiesFile = multi_workspace_utils_1.multiWorkspaceManager.hasAnyWorkspace();
        // 初始化所有处理器
        this.startAnalysisHandler = new start_analysis_handler_1.StartAnalysisHandler(this.hasEntitiesFile);
        this.coreComponentHandler = new core_component_handler_1.CoreComponentHandler(this.hasEntitiesFile);
        this.modifyEntityHandler = new modify_entity_handler_1.ModifyEntityHandler(this.hasEntitiesFile);
        this.generatePromptHandler = new generate_prompt_handler_1.GeneratePromptHandler(this.hasEntitiesFile);
        this.quickAnalysisHandler = new quick_analysis_handler_1.QuickAnalysisHandler(this.hasEntitiesFile);
        this.entityFileStatusHandler = new entity_file_status_handler_1.EntityFileStatusHandler(this.hasEntitiesFile);
        // 输出状态信息
        if (!this.hasEntitiesFile) {
            const availableWorkspaces = multi_workspace_utils_1.multiWorkspaceManager.getAvailableWorkspaces();
            if (availableWorkspaces.length === 0) {
                console.error(`⚠️  警告: 未找到任何可用的实体文件`);
                console.error(`   已配置的路径: ${server_config_1.serverConfig.workspacePaths.join(', ')}`);
                console.error('   请确保在项目根目录运行，或先执行 parser-agent 生成实体文件');
            }
            else {
                console.info(`✅ 代码分析服务已启用，可用项目: ${availableWorkspaces.length}个`);
                availableWorkspaces.forEach((workspace, index) => {
                    const workspaceName = require('path').basename(workspace);
                    console.info(`   ${index + 1}. ${workspaceName} (${workspace})`);
                });
            }
        }
        else {
            const availableWorkspaces = multi_workspace_utils_1.multiWorkspaceManager.getAvailableWorkspaces();
            console.info(`✅ 代码分析服务已启用，共 ${availableWorkspaces.length} 个项目`);
        }
        // 设置进程退出时的清理
        this.setupCleanup();
        this.registerTools();
    }
    /**
     * 注册所有工具
     */
    registerTools() {
        // 创建通用的工具注解，支持returnDirect配置
        const createToolAnnotations = () => ({
            returnDirect: server_config_1.serverConfig.returnDirect
        });
        // 注册 start-analysis 工具 - 主要入口工具
        this.server.tool(params_1.TOOL_NAMES.START_ANALYSIS, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.START_ANALYSIS), params_1.TOOL_PARAMS.startAnalysis, createToolAnnotations(), async ({ input, sessionId }) => {
            return await this.startAnalysisHandler.handle(input, sessionId);
        });
        // 注册 select-core-component 工具
        this.server.tool(params_1.TOOL_NAMES.SELECT_CORE_COMPONENT, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.SELECT_CORE_COMPONENT), params_1.TOOL_PARAMS.selectCoreComponent, createToolAnnotations(), async ({ sessionId, maxRelated, workspaceEntities }) => {
            return await this.coreComponentHandler.handle(sessionId, maxRelated, workspaceEntities);
        });
        // 注册 modify-entity-selection 工具
        this.server.tool(params_1.TOOL_NAMES.MODIFY_ENTITY_SELECTION, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.MODIFY_ENTITY_SELECTION), params_1.TOOL_PARAMS.modifyEntitySelection, createToolAnnotations(), async ({ sessionId, maxRelated, workspaceEntities }) => {
            return await this.modifyEntityHandler.handle(sessionId, maxRelated, workspaceEntities);
        });
        // 注册 generate-code-prompt 工具
        this.server.tool(params_1.TOOL_NAMES.GENERATE_CODE_PROMPT, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.GENERATE_CODE_PROMPT), params_1.TOOL_PARAMS.generateCodePrompt, async ({ sessionId, additionalContext, workspaceEntities }) => {
            return await this.generatePromptHandler.handle(sessionId, additionalContext, workspaceEntities);
        });
        // 注册 quick-analysis 工具
        this.server.tool(params_1.TOOL_NAMES.QUICK_ANALYSIS, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.QUICK_ANALYSIS), params_1.TOOL_PARAMS.quickAnalysis, async ({ input, componentIndex, includeRelated, maxRelated, additionalContext }) => {
            return await this.quickAnalysisHandler.handle(input, componentIndex, includeRelated, maxRelated, additionalContext);
        });
        // 注册 entity-file-status 工具
        this.server.tool(params_1.TOOL_NAMES.ENTITY_FILE_STATUS, (0, params_1.getFullToolDescription)(params_1.TOOL_NAMES.ENTITY_FILE_STATUS), params_1.TOOL_PARAMS.entityFileStatus, async ({ action }) => {
            return await this.entityFileStatusHandler.handle(action);
        });
    }
    /**
     * 设置进程退出时的清理处理
     */
    setupCleanup() {
        const cleanup = () => {
            console.info('正在清理资源...');
            try {
                // 清理所有workspace的RAG工具
                multi_workspace_utils_1.multiWorkspaceManager.disposeAll();
                console.info('资源清理完成');
                process.exit(1);
            }
            catch (error) {
                console.error('清理资源时发生错误:', error);
            }
        };
        // 监听各种退出信号
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
        process.on('uncaughtException', (error) => {
            console.error('未捕获的异常:', error);
            cleanup();
        });
    }
    /**
     * 启动服务器
     */
    async start() {
        console.info('正在启动 Code Research MCP 服务器...');
        // 显示配置信息
        console.info(`🔧 配置信息:`);
        console.info(`   - 服务器名称: ${server_config_1.serverConfig.name}`);
        console.info(`   - 版本: ${server_config_1.serverConfig.version}`);
        console.info(`   - 直接返回模式: ${server_config_1.serverConfig.returnDirect ? '✅ 启用' : '❌ 关闭'}`);
        console.info(`   - 项目数量: ${server_config_1.serverConfig.workspacePaths.length}个`);
        console.info(`   - 实体文件路径: ${server_config_1.serverConfig.entitiesFilePaths.join(', ')}`);
        console.info(`   - 项目路径: ${server_config_1.serverConfig.workspacePaths.join(', ')}`);
        console.info('已注册的工具:');
        console.info('🎯 start-analysis: 智能需求分析，推荐5个核心组件（需要手动选择）');
        console.info('🎯 select-core-component: 选择最核心的组件进行深入分析');
        console.info('✏️ modify-entity-selection: 调整最终实体选择');
        console.info('🚀 generate-code-prompt: 生成完整的代码实现提示词');
        console.info('⚡ quick-analysis: 跳过交互的一键分析工具');
        console.info('📁 entity-file-status: 实体文件状态管理和热重载');
        // 启动服务器
        const transport = new stdio_js_1.StdioServerTransport();
        console.info('连接到传输层...');
        await this.server.connect(transport);
        console.info('MCP 服务器已启动并等待连接');
        // 显示实体文件状态
        const availableWorkspaces = multi_workspace_utils_1.multiWorkspaceManager.getAvailableWorkspaces();
        if (availableWorkspaces.length > 0) {
            console.info(`📁 实体文件状态: 共${availableWorkspaces.length}个workspace可用，文件监听已启用`);
        }
    }
}
/**
 * 导出 run 函数供 main.ts 调用
 */
async function run() {
    try {
        const server = new CodeAnalysisServer();
        await server.start();
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
