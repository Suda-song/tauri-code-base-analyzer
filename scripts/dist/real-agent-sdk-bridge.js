#!/usr/bin/env node
/**
 * Real Claude Agent SDK Bridge - 真正使用官方 @anthropic-ai/claude-agent-sdk
 *
 * 功能:
 * - 真正调用官方 Claude Agent SDK
 * - 项目上下文管理 (CLAUDE.md)
 * - 细粒度工具权限控制
 * - 代码变更追踪
 * - 专门的编程任务优化
 */
import { query, } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
/**
 * Real Claude Agent SDK Bridge
 *
 * 真正使用官方 @anthropic-ai/claude-agent-sdk
 */
class RealClaudeAgentSdkBridge {
    constructor() {
        this.workspace = "";
        this.claudeMdContext = "";
        this.permissions = {
            allow_all: false,
            allow_patterns: [],
            deny_patterns: [],
        };
        this.codeChanges = [];
        this.toolUses = [];
        this.filesModified = new Set();
        this.commandsExecuted = [];
        this.conversationId = "";
    }
    async handleRequest(request) {
        try {
            console.error("🤖 Real Claude Agent SDK Bridge 启动");
            console.error(`   行动: ${request.action}`);
            console.error(`   工作空间: ${request.workspace}`);
            console.error(`   SDK: @anthropic-ai/claude-agent-sdk`);
            // 1. 设置工作空间和上下文
            await this.setupWorkspace(request.workspace, request.claude_md_content);
            // 2. 配置权限
            this.configurePermissions(request.permissions);
            // 3. 重置追踪状态
            this.resetTracking();
            // 4. 构建增强的提示词
            const fullPrompt = this.buildFullPrompt(request);
            // 5. 配置 SDK 选项
            const options = this.buildSdkOptions(request);
            // 6. 调用 Claude Agent SDK
            console.error("\n🚀 调用官方 Claude Agent SDK...\n");
            const response = query({
                prompt: fullPrompt,
                options,
            });
            // 7. 处理响应流
            const result = await this.processQueryStream(response);
            return result;
        }
        catch (error) {
            console.error(`❌ Agent 执行失败: ${error.message}`);
            return {
                success: false,
                content: "",
                code_changes: [],
                tool_uses: [],
                files_modified: [],
                commands_executed: [],
                conversation_id: "",
                turn_count: 0,
                is_complete: false,
                error: error.message,
                warnings: [],
                suggestions: [],
                agent_info: {
                    sdk_version: "0.1.5",
                    model: "unknown",
                    total_tokens: 0,
                    total_cost_usd: 0,
                    thinking_enabled: true,
                },
            };
        }
    }
    async setupWorkspace(workspace, claudeMdContent) {
        this.workspace = workspace;
        this.conversationId = this.generateConversationId();
        // 尝试读取 CLAUDE.md 文件
        const claudeMdPath = path.join(workspace, "CLAUDE.md");
        if (fs.existsSync(claudeMdPath)) {
            this.claudeMdContext = fs.readFileSync(claudeMdPath, "utf-8");
            console.error("✅ 加载了现有的 CLAUDE.md");
        }
        else if (claudeMdContent) {
            // 如果提供了内容，写入文件
            await fs.promises.writeFile(claudeMdPath, claudeMdContent);
            this.claudeMdContext = claudeMdContent;
            console.error("✅ 创建了新的 CLAUDE.md");
        }
        else {
            // 生成默认的 CLAUDE.md
            this.claudeMdContext = this.generateDefaultClaudeMd(workspace);
            console.error("ℹ️  使用默认的项目上下文");
        }
    }
    configurePermissions(permissions) {
        this.permissions = permissions;
        console.error(`🔒 权限配置: ${permissions.allow_all
            ? "允许所有"
            : `${permissions.allow_patterns.length} 个允许规则, ${permissions.deny_patterns.length} 个拒绝规则`}`);
    }
    resetTracking() {
        this.codeChanges = [];
        this.toolUses = [];
        this.filesModified = new Set();
        this.commandsExecuted = [];
    }
    buildFullPrompt(request) {
        let prompt = request.prompt;
        // 添加工作空间信息
        prompt += `\n\n## 工作空间\n路径: ${request.workspace}`;
        // 添加相关文件内容
        if (request.files.length > 0) {
            prompt += "\n\n## 相关文件:";
            for (const file of request.files) {
                const filePath = path.join(request.workspace, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, "utf-8");
                    const ext = path.extname(file).slice(1) || "text";
                    // 限制文件内容长度
                    const truncated = content.length > 50000
                        ? content.slice(0, 50000) + "\n\n... (文件过长，已截断)"
                        : content;
                    prompt += `\n\n### ${file}\n\`\`\`${ext}\n${truncated}\n\`\`\``;
                }
                else {
                    prompt += `\n\n### ${file}\n*文件不存在*`;
                }
            }
        }
        return prompt;
    }
    buildSdkOptions(request) {
        // 根据权限配置决定 permission mode
        const permissionMode = this.permissions.allow_all
            ? "bypassPermissions"
            : "default";
        // 构建系统提示
        const systemPrompt = this.buildSystemPrompt(request.action);
        const options = {
            cwd: request.workspace,
            maxTurns: request.max_turns,
            permissionMode: permissionMode,
            systemPrompt: systemPrompt,
            // 根据模式设置允许/禁止的工具
            allowedTools: this.mapToolsToSdkFormat(request.allowed_tools),
        };
        // 如果需要禁止某些工具
        if (!this.permissions.allow_all &&
            this.permissions.deny_patterns.length > 0) {
            const disallowedTools = this.extractDisallowedTools(this.permissions.deny_patterns);
            if (disallowedTools.length > 0) {
                options.disallowedTools = disallowedTools;
            }
        }
        return options;
    }
    mapToolsToSdkFormat(tools) {
        // SDK 的工具名称映射
        const toolMap = {
            Read: "read_file",
            Write: "write_file",
            Edit: "edit_file",
            Bash: "bash",
        };
        return tools.map((tool) => toolMap[tool] || tool.toLowerCase());
    }
    extractDisallowedTools(denyPatterns) {
        const disallowed = new Set();
        for (const pattern of denyPatterns) {
            const match = pattern.match(/^(\w+)\(/);
            if (match) {
                const tool = match[1];
                const mappedTool = this.mapToolsToSdkFormat([tool])[0];
                disallowed.add(mappedTool);
            }
        }
        return Array.from(disallowed);
    }
    buildSystemPrompt(action) {
        const agentRole = this.getAgentRole(action);
        return `${agentRole}

# 项目上下文
${this.claudeMdContext}

# 工作原则
1. 收集上下文 - 充分理解环境和任务
2. 执行操作 - 系统性地完成任务
3. 验证工作 - 确保质量和正确性
4. 迭代改进 - 持续优化直到完成

请按照上述原则工作，并清晰地说明你的思考过程和行动。`;
    }
    getAgentRole(action) {
        const roles = {
            code: `你是一个代码生成专家。
专注于编写高质量、可维护的代码。
遵循最佳实践和设计模式。`,
            analyze: `你是一个代码分析专家。
专注于理解代码结构、识别模式和潜在问题。
提供具体的改进建议。`,
            refactor: `你是一个代码重构专家。
在保持功能不变的前提下优化代码。
提高代码可读性和可维护性。`,
            debug: `你是一个调试专家。
系统性地分析和定位问题。
验证修复的正确性。`,
            edit: `你是一个代码编辑专家。
精准修改指定代码段。
保持代码风格一致性。`,
        };
        return roles[action] || roles.code;
    }
    async processQueryStream(queryGenerator) {
        let finalContent = "";
        let turnCount = 0;
        let totalTokens = 0;
        let totalCost = 0;
        let model = "unknown";
        let sessionId = "";
        try {
            for await (const message of queryGenerator) {
                // 记录 session_id
                if (message.session_id) {
                    sessionId = message.session_id;
                }
                console.error(`📨 收到消息: ${message.type}`);
                switch (message.type) {
                    case "system":
                        if (message.subtype === "init") {
                            console.error(`✅ 系统初始化`);
                            console.error(`   模型: ${message.model}`);
                            console.error(`   工作目录: ${message.cwd}`);
                            console.error(`   工具: ${message.tools.join(", ")}`);
                            console.error(`   权限模式: ${message.permissionMode}`);
                            model = message.model;
                        }
                        break;
                    case "assistant":
                        console.error(`🤖 Assistant 消息`);
                        const assistantMsg = message.message;
                        // 提取文本内容
                        if (assistantMsg.content) {
                            for (const block of assistantMsg.content) {
                                if (block.type === "text") {
                                    finalContent += block.text + "\n";
                                    console.error(`   文本: ${block.text.slice(0, 100)}...`);
                                }
                                else if (block.type === "tool_use") {
                                    console.error(`   工具调用: ${block.name}`);
                                    this.trackToolUse(block.name, block.input);
                                }
                            }
                        }
                        turnCount++;
                        break;
                    case "result":
                        console.error(`\n✅ 任务完成`);
                        console.error(`   结果: ${message.subtype}`);
                        console.error(`   轮数: ${message.num_turns}`);
                        console.error(`   耗时: ${message.duration_ms}ms`);
                        console.error(`   API 耗时: ${message.duration_api_ms}ms`);
                        console.error(`   成本: $${message.total_cost_usd.toFixed(4)}`);
                        turnCount = message.num_turns;
                        totalCost = message.total_cost_usd;
                        // 累计 token 使用
                        if (message.usage) {
                            totalTokens =
                                (message.usage.input_tokens || 0) +
                                    (message.usage.output_tokens || 0);
                        }
                        // 如果有结果文本
                        if (message.subtype === "success" && message.result) {
                            finalContent = message.result;
                        }
                        // 检查权限拒绝
                        if (message.permission_denials &&
                            message.permission_denials.length > 0) {
                            console.error(`\n⚠️  权限拒绝: ${message.permission_denials.length} 个`);
                            for (const denial of message.permission_denials) {
                                console.error(`   - ${denial.tool_name}`);
                            }
                        }
                        break;
                    case "user":
                        // 用户消息（可能是合成的）
                        if (message.isSynthetic) {
                            console.error(`   合成用户消息`);
                        }
                        break;
                    case "stream_event":
                        // 流式事件（部分助手消息）
                        break;
                }
            }
            return {
                success: true,
                content: finalContent,
                code_changes: this.codeChanges,
                tool_uses: this.toolUses,
                files_modified: Array.from(this.filesModified),
                commands_executed: this.commandsExecuted,
                conversation_id: sessionId || this.conversationId,
                turn_count: turnCount,
                is_complete: true,
                warnings: this.generateWarnings(),
                suggestions: this.generateSuggestions(),
                agent_info: {
                    sdk_version: "0.1.5",
                    model: model,
                    total_tokens: totalTokens,
                    total_cost_usd: totalCost,
                    thinking_enabled: true,
                },
            };
        }
        catch (error) {
            throw error;
        }
    }
    trackToolUse(toolName, input) {
        const toolUse = {
            tool: toolName,
            action: JSON.stringify(input),
            target: input.path || input.command || "",
            result: "",
            success: true,
        };
        this.toolUses.push(toolUse);
        // 跟踪文件修改
        if ((toolName === "write_file" || toolName === "edit_file") && input.path) {
            this.filesModified.add(input.path);
            // 记录代码变更
            this.codeChanges.push({
                file_path: input.path,
                change_type: toolName === "write_file" ? "modify" : "modify",
                diff: input.content || input.new_text || "",
                language: this.detectLanguage(input.path),
            });
        }
        // 跟踪命令执行
        if (toolName === "bash" && input.command) {
            this.commandsExecuted.push(input.command);
        }
    }
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const langMap = {
            ".ts": "typescript",
            ".js": "javascript",
            ".tsx": "typescript",
            ".jsx": "javascript",
            ".rs": "rust",
            ".py": "python",
            ".go": "go",
            ".java": "java",
            ".cpp": "cpp",
            ".c": "c",
            ".md": "markdown",
            ".json": "json",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".toml": "toml",
            ".sh": "bash",
        };
        return langMap[ext] || "text";
    }
    generateWarnings() {
        const warnings = [];
        if (this.filesModified.size > 10) {
            warnings.push(`修改了 ${this.filesModified.size} 个文件，请仔细审查`);
        }
        if (this.commandsExecuted.length > 0) {
            warnings.push(`执行了 ${this.commandsExecuted.length} 个命令，请检查执行结果`);
        }
        return warnings;
    }
    generateSuggestions() {
        const suggestions = [];
        if (this.filesModified.size > 0) {
            suggestions.push("运行测试以验证更改");
            suggestions.push("使用 git diff 查看详细更改");
            suggestions.push("提交前审查所有修改");
        }
        return suggestions;
    }
    generateDefaultClaudeMd(workspace) {
        return `# 项目信息
- 工作空间: ${workspace}
- Agent SDK: @anthropic-ai/claude-agent-sdk (Official)

# 代码规范
- 使用一致的命名约定
- 添加适当的注释
- 遵循 DRY 原则
- 编写单元测试

# Agent 工作原则
1. 收集上下文 - 充分理解问题
2. 执行操作 - 系统性地完成任务
3. 验证工作 - 确保质量
4. 迭代改进 - 持续优化

# 安全要求
- 文件操作限制在工作空间内
- 谨慎执行系统命令
- 遵循权限配置
`;
    }
    generateConversationId() {
        return `real_agent_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
    }
}
// 主函数
async function main() {
    const bridge = new RealClaudeAgentSdkBridge();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });
    let inputData = "";
    rl.on("line", (line) => {
        inputData += line;
    });
    rl.on("close", async () => {
        try {
            const request = JSON.parse(inputData);
            const response = await bridge.handleRequest(request);
            console.log(JSON.stringify(response));
            process.exit(0);
        }
        catch (error) {
            const errorResponse = {
                success: false,
                content: "",
                code_changes: [],
                tool_uses: [],
                files_modified: [],
                commands_executed: [],
                conversation_id: "",
                turn_count: 0,
                is_complete: false,
                error: error.message,
                warnings: [],
                suggestions: [],
                agent_info: {
                    sdk_version: "0.1.5",
                    model: "unknown",
                    total_tokens: 0,
                    total_cost_usd: 0,
                    thinking_enabled: true,
                },
            };
            console.log(JSON.stringify(errorResponse));
            process.exit(1);
        }
    });
}
main().catch((error) => {
    console.error(JSON.stringify({
        success: false,
        error: error.message,
    }));
    process.exit(1);
});
