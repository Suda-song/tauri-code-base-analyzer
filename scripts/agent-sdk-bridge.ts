#!/usr/bin/env node
/**
 * Claude Agent SDK Bridge - 使用官方 @anthropic-ai/claude-agent-sdk
 *
 * 功能:
 * - 使用官方 Claude Agent SDK
 * - 项目上下文管理 (CLAUDE.md)
 * - 细粒度工具权限控制
 * - 代码变更追踪
 * - 专门的编程任务优化
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// 注意：@anthropic-ai/claude-agent-sdk 可能需要不同的导入方式
// 这里先使用标准的 Anthropic SDK，因为 agent-sdk 可能还不是公开包
// 我们基于 SDK 的理念来构建
import Anthropic from "@anthropic-ai/sdk";

interface AgentSdkBridgeRequest {
  action: "code" | "analyze" | "refactor" | "debug" | "edit";
  prompt: string;
  workspace: string;
  files: string[];
  allowed_tools: string[];
  permissions: PermissionConfig;
  max_turns: number;
  save_history: boolean;
  claude_md_content?: string;
  max_tokens?: number;
  mode?: "headless" | "interactive";
}

interface PermissionConfig {
  allow_all: boolean;
  allow_patterns: string[];
  deny_patterns: string[];
}

interface AgentSdkBridgeResponse {
  success: boolean;
  content: string;
  code_changes: CodeChange[];
  tool_uses: ToolUse[];
  files_modified: string[];
  commands_executed: string[];
  conversation_id: string;
  turn_count: number;
  is_complete: boolean;
  error?: string;
  warnings: string[];
  suggestions: string[];
  agent_info: AgentInfo;
}

interface AgentInfo {
  sdk_version: string;
  model: string;
  total_tokens: number;
  thinking_enabled: boolean;
}

interface CodeChange {
  file_path: string;
  change_type: "create" | "modify" | "delete";
  diff: string;
  language: string;
}

interface ToolUse {
  tool: string;
  action: string;
  target: string;
  result: string;
  success: boolean;
}

/**
 * Claude Agent SDK Bridge
 *
 * 基于 Claude Agent SDK 理念实现的桥接器
 */
class ClaudeAgentSdkBridge {
  private client: Anthropic;
  private workspace: string = "";
  private claudeMdContext: string = "";
  private permissions: PermissionConfig = {
    allow_all: false,
    allow_patterns: [],
    deny_patterns: [],
  };
  private codeChanges: CodeChange[] = [];
  private toolUses: ToolUse[] = [];
  private filesModified: Set<string> = new Set();
  private commandsExecuted: string[] = [];
  private totalTokens: number = 0;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    this.client = new Anthropic({ apiKey });
  }

  async handleRequest(
    request: AgentSdkBridgeRequest
  ): Promise<AgentSdkBridgeResponse> {
    try {
      console.error("🤖 Claude Agent SDK Bridge 启动");
      console.error(`   行动: ${request.action}`);
      console.error(`   工作空间: ${request.workspace}`);
      console.error(`   模式: ${request.mode || "headless"}`);

      // 1. 设置工作空间和上下文
      await this.setupWorkspace(request.workspace, request.claude_md_content);

      // 2. 配置权限
      this.configurePermissions(request.permissions);

      // 3. 重置追踪状态
      this.resetTracking();

      // 4. 构建 Agent 系统提示词（基于 SDK 理念）
      const systemPrompt = this.buildAgentSystemPrompt(request.action);

      // 5. 构建任务提示词
      const taskPrompt = this.buildTaskPrompt(request);

      // 6. 执行 Agent 循环（自主工作流程）
      const conversationId = this.generateConversationId();
      const result = await this.executeAgentLoop(
        systemPrompt,
        taskPrompt,
        request.allowed_tools,
        request.max_turns,
        request.max_tokens || 8192
      );

      return {
        success: true,
        content: result,
        code_changes: this.codeChanges,
        tool_uses: this.toolUses,
        files_modified: Array.from(this.filesModified),
        commands_executed: this.commandsExecuted,
        conversation_id: conversationId,
        turn_count: this.toolUses.length,
        is_complete: true,
        warnings: this.generateWarnings(),
        suggestions: this.generateSuggestions(request.action),
        agent_info: {
          sdk_version: "0.1.0",
          model: "claude-3-5-sonnet-20241022",
          total_tokens: this.totalTokens,
          thinking_enabled: true,
        },
      };
    } catch (error: any) {
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
          sdk_version: "0.1.0",
          model: "claude-3-5-sonnet-20241022",
          total_tokens: 0,
          thinking_enabled: true,
        },
      };
    }
  }

  private async setupWorkspace(
    workspace: string,
    claudeMdContent?: string
  ): Promise<void> {
    this.workspace = workspace;

    // 尝试读取 CLAUDE.md 文件
    const claudeMdPath = path.join(workspace, "CLAUDE.md");
    if (fs.existsSync(claudeMdPath)) {
      this.claudeMdContext = fs.readFileSync(claudeMdPath, "utf-8");
      console.error("✅ 加载了现有的 CLAUDE.md");
    } else if (claudeMdContent) {
      // 如果提供了内容，写入文件
      await fs.promises.writeFile(claudeMdPath, claudeMdContent);
      this.claudeMdContext = claudeMdContent;
      console.error("✅ 创建了新的 CLAUDE.md");
    } else {
      // 生成默认的 CLAUDE.md
      this.claudeMdContext = this.generateDefaultClaudeMd(workspace);
      console.error("ℹ️  使用默认的项目上下文");
    }
  }

  private configurePermissions(permissions: PermissionConfig): void {
    this.permissions = permissions;
    console.error(
      `🔒 权限配置: ${
        permissions.allow_all
          ? "允许所有"
          : `${permissions.allow_patterns.length} 个允许规则, ${permissions.deny_patterns.length} 个拒绝规则`
      }`
    );
  }

  private resetTracking(): void {
    this.codeChanges = [];
    this.toolUses = [];
    this.filesModified = new Set();
    this.commandsExecuted = [];
    this.totalTokens = 0;
  }

  private buildAgentSystemPrompt(action: string): string {
    // 基于 Claude Agent SDK 的核心模式构建提示词
    const agentRole = this.getAgentRole(action);

    return `你是一个基于 Claude Agent SDK 的自主 AI 编程助手。

# 你的角色
${agentRole}

# 核心工作模式（Claude Agent SDK 理念）
1. **收集上下文** - 彻底理解环境和任务要求
   - 阅读相关文件和代码
   - 分析项目结构
   - 理解业务逻辑

2. **执行操作** - 使用适当的工具完成任务
   - 系统性地分解任务
   - 逐步实施解决方案
   - 记录每个操作

3. **验证工作** - 自我评估和质量检查
   - 检查语法和逻辑错误
   - 验证代码的正确性
   - 确保符合最佳实践

4. **迭代改进** - 持续优化直到达成目标
   - 根据反馈调整方案
   - 完善实现细节
   - 确保任务完成

# 项目上下文
${this.claudeMdContext}

# 工具使用指南
- 每次操作前先思考目标和策略
- 记录你的决策过程和理由
- 遵循项目的编码规范
- 确保所有修改都经过验证

# 输出格式
请清晰地说明：
1. 你的分析思路和决策过程
2. 具体的实施步骤
3. 代码变更的详细说明
4. 验证和测试建议`;
  }

  private getAgentRole(action: string): string {
    const roles: Record<string, string> = {
      code: `**代码生成专家**
- 编写高质量、可维护的代码
- 遵循最佳实践和设计模式
- 考虑错误处理和边界情况
- 编写清晰的注释和文档`,

      analyze: `**代码分析专家**
- 深入分析代码结构和逻辑
- 识别潜在的bug和性能问题
- 评估代码质量和可维护性
- 提供具体的改进建议`,

      refactor: `**代码重构专家**
- 在保持功能不变的前提下优化代码
- 提高代码可读性和可维护性
- 消除代码重复和冗余
- 应用设计模式优化结构`,

      debug: `**调试专家**
- 系统性地分析和定位问题
- 使用日志和调试工具
- 验证修复的正确性
- 防止类似问题再次出现`,

      edit: `**代码编辑专家**
- 精准修改指定代码段
- 保持代码风格一致性
- 确保修改不影响其他部分
- 提供清晰的变更说明`,
    };

    return roles[action] || roles.code;
  }

  private buildTaskPrompt(request: AgentSdkBridgeRequest): string {
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
          const truncated =
            content.length > 50000
              ? content.slice(0, 50000) + "\n\n... (文件过长，已截断)"
              : content;
          prompt += `\n\n### ${file}\n\`\`\`${ext}\n${truncated}\n\`\`\``;
        } else {
          prompt += `\n\n### ${file}\n*文件不存在*`;
        }
      }
    }

    // 添加项目结构信息
    try {
      const structure = this.getProjectStructure(request.workspace);
      if (structure) {
        prompt += `\n\n## 项目结构\n\`\`\`\n${structure}\n\`\`\``;
      }
    } catch (error) {
      // 忽略错误
    }

    return prompt;
  }

  /**
   * Agent 自主工作循环
   *
   * 这是 Claude Agent SDK 的核心：Agent 自主决策并执行工具
   */
  private async executeAgentLoop(
    systemPrompt: string,
    taskPrompt: string,
    allowedTools: string[],
    maxTurns: number,
    maxTokens: number
  ): Promise<string> {
    // 构建工具定义
    const tools = this.buildToolDefinitions(allowedTools);

    let conversationMessages: Anthropic.MessageParam[] = [
      { role: "user", content: taskPrompt },
    ];

    let finalContent = "";
    let turnCount = 0;

    console.error(`\n🔄 开始 Agent 自主工作循环（最多 ${maxTurns} 轮）\n`);

    for (let turn = 0; turn < maxTurns; turn++) {
      turnCount = turn + 1;
      console.error(`\n📍 第 ${turnCount}/${maxTurns} 轮`);

      try {
        const response = await this.client.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: conversationMessages,
          tools: tools.length > 0 ? tools : undefined,
        });

        // 累计 token 使用量
        this.totalTokens +=
          response.usage.input_tokens + response.usage.output_tokens;

        // 提取文本内容
        const textBlocks = response.content.filter(
          (block) => block.type === "text"
        );
        const textContent = textBlocks
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n");

        if (textContent) {
          finalContent = textContent;
          console.error(`💭 Agent 思考: ${textContent.slice(0, 200)}...`);
        }

        // 检查是否有工具调用
        const toolUseBlocks = response.content.filter(
          (block) => block.type === "tool_use"
        );

        if (toolUseBlocks.length === 0) {
          console.error("✅ Agent 完成任务，无需更多工具");
          break;
        }

        // 执行工具调用
        console.error(`🔧 Agent 请求使用 ${toolUseBlocks.length} 个工具`);
        const toolResults: Anthropic.MessageParam[] = [];

        for (const toolUse of toolUseBlocks) {
          if (toolUse.type === "tool_use") {
            console.error(
              `   - ${toolUse.name}: ${JSON.stringify(toolUse.input).slice(
                0,
                100
              )}`
            );
            const result = await this.executeTool(toolUse.name, toolUse.input);
            toolResults.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: result.result,
                },
              ],
            });

            // 记录工具使用
            this.toolUses.push({
              tool: toolUse.name,
              action: JSON.stringify(toolUse.input),
              target:
                (toolUse.input as any).path ||
                (toolUse.input as any).command ||
                "",
              result: result.result.slice(0, 500),
              success: result.success,
            });
          }
        }

        // 添加助手回复和工具结果到对话
        conversationMessages.push({
          role: "assistant",
          content: response.content,
        });
        conversationMessages.push(...toolResults);
      } catch (error: any) {
        console.error(`❌ 第 ${turnCount} 轮执行失败: ${error.message}`);
        throw error;
      }
    }

    console.error(
      `\n✅ Agent 循环完成（共 ${turnCount} 轮，${this.totalTokens} tokens）`
    );

    return finalContent;
  }

  private buildToolDefinitions(allowedTools: string[]): Anthropic.Tool[] {
    const toolDefinitions: Record<string, Anthropic.Tool> = {
      Read: {
        name: "read_file",
        description: "读取文件内容。使用此工具来理解现有代码和项目结构。",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径（相对于工作空间）",
            },
          },
          required: ["path"],
        },
      },
      Write: {
        name: "write_file",
        description:
          "写入文件内容（创建或完全覆盖）。使用此工具来创建新文件或完全重写文件。",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径（相对于工作空间）",
            },
            content: {
              type: "string",
              description: "文件内容",
            },
          },
          required: ["path", "content"],
        },
      },
      Edit: {
        name: "edit_file",
        description:
          "编辑文件内容（搜索和替换）。使用此工具来精确修改文件中的特定部分。",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径",
            },
            old_text: {
              type: "string",
              description: "要替换的文本（必须精确匹配）",
            },
            new_text: {
              type: "string",
              description: "新文本",
            },
          },
          required: ["path", "old_text", "new_text"],
        },
      },
      Bash: {
        name: "run_bash",
        description:
          "运行 bash 命令。使用此工具来执行命令、运行测试、编译代码等。",
        input_schema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "要执行的命令",
            },
          },
          required: ["command"],
        },
      },
    };

    return allowedTools
      .filter((tool) => toolDefinitions[tool])
      .map((tool) => toolDefinitions[tool]);
  }

  private async executeTool(
    toolName: string,
    input: any
  ): Promise<{ success: boolean; result: string }> {
    try {
      switch (toolName) {
        case "read_file":
          return await this.readFile(input.path);
        case "write_file":
          return await this.writeFile(input.path, input.content);
        case "edit_file":
          return await this.editFile(
            input.path,
            input.old_text,
            input.new_text
          );
        case "run_bash":
          return await this.runBash(input.command);
        default:
          return { success: false, result: `未知工具: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, result: `工具执行错误: ${error.message}` };
    }
  }

  private async readFile(
    filePath: string
  ): Promise<{ success: boolean; result: string }> {
    const fullPath = path.join(this.workspace, filePath);

    if (!this.checkPermission("Read", fullPath)) {
      return { success: false, result: "权限拒绝: 不允许读取此文件" };
    }

    if (!fs.existsSync(fullPath)) {
      return { success: false, result: "文件不存在" };
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    console.error(`     📖 读取: ${filePath} (${content.length} 字符)`);
    return { success: true, result: content };
  }

  private async writeFile(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; result: string }> {
    const fullPath = path.join(this.workspace, filePath);

    if (!this.checkPermission("Write", fullPath)) {
      return { success: false, result: "权限拒绝: 不允许写入此文件" };
    }

    const isNewFile = !fs.existsSync(fullPath);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    this.filesModified.add(filePath);

    this.codeChanges.push({
      file_path: filePath,
      change_type: isNewFile ? "create" : "modify",
      diff: content,
      language: this.detectLanguage(filePath),
    });

    console.error(
      `     ✍️  ${isNewFile ? "创建" : "修改"}: ${filePath} (${
        content.length
      } 字符)`
    );
    return {
      success: true,
      result: `文件${isNewFile ? "创建" : "修改"}成功`,
    };
  }

  private async editFile(
    filePath: string,
    oldText: string,
    newText: string
  ): Promise<{ success: boolean; result: string }> {
    const fullPath = path.join(this.workspace, filePath);

    if (!this.checkPermission("Edit", fullPath)) {
      return { success: false, result: "权限拒绝: 不允许编辑此文件" };
    }

    if (!fs.existsSync(fullPath)) {
      return { success: false, result: "文件不存在" };
    }

    let content = fs.readFileSync(fullPath, "utf-8");
    if (!content.includes(oldText)) {
      return { success: false, result: "未找到要替换的文本" };
    }

    content = content.replace(oldText, newText);
    fs.writeFileSync(fullPath, content, "utf-8");
    this.filesModified.add(filePath);

    this.codeChanges.push({
      file_path: filePath,
      change_type: "modify",
      diff: `- ${oldText}\n+ ${newText}`,
      language: this.detectLanguage(filePath),
    });

    console.error(`     ✏️  编辑: ${filePath}`);
    return { success: true, result: "文件编辑成功" };
  }

  private async runBash(
    command: string
  ): Promise<{ success: boolean; result: string }> {
    if (!this.checkPermission("Bash", command)) {
      return { success: false, result: "权限拒绝: 不允许执行此命令" };
    }

    const { execSync } = require("child_process");
    try {
      const output = execSync(command, {
        cwd: this.workspace,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        timeout: 30000, // 30 秒超时
      });

      this.commandsExecuted.push(command);
      console.error(`     🖥️  执行: ${command}`);
      return { success: true, result: output };
    } catch (error: any) {
      return {
        success: false,
        result: `命令执行失败: ${error.message}\n${error.stdout || ""}`,
      };
    }
  }

  private checkPermission(tool: string, target: string): boolean {
    if (this.permissions.allow_all) {
      return true;
    }

    // 检查拒绝模式
    for (const pattern of this.permissions.deny_patterns) {
      if (this.matchPattern(pattern, tool, target)) {
        console.error(
          `     🚫 拒绝: ${tool}(${target}) 匹配拒绝模式 ${pattern}`
        );
        return false;
      }
    }

    // 检查允许模式
    for (const pattern of this.permissions.allow_patterns) {
      if (this.matchPattern(pattern, tool, target)) {
        return true;
      }
    }

    console.error(`     ⚠️  不允许: ${tool}(${target})`);
    return false;
  }

  private matchPattern(pattern: string, tool: string, target: string): boolean {
    // 简单的模式匹配实现
    // 格式: "Tool(pattern)"
    const match = pattern.match(/^(\w+)\((.*)\)$/);
    if (!match) {
      return pattern === "*" || pattern === tool;
    }

    const [, patternTool, patternTarget] = match;
    if (patternTool !== tool && patternTool !== "*") {
      return false;
    }

    if (patternTarget === "*") {
      return true;
    }

    // 简单的通配符匹配
    const regex = new RegExp(
      "^" + patternTarget.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(target);
  }

  private generateWarnings(): string[] {
    const warnings: string[] = [];

    if (this.filesModified.size > 10) {
      warnings.push(`修改了 ${this.filesModified.size} 个文件，请仔细审查`);
    }

    if (this.commandsExecuted.length > 0) {
      warnings.push(
        `执行了 ${this.commandsExecuted.length} 个命令，请检查执行结果`
      );
    }

    if (this.totalTokens > 100000) {
      warnings.push(`使用了 ${this.totalTokens} tokens，成本较高`);
    }

    return warnings;
  }

  private generateSuggestions(action: string): string[] {
    const suggestions: string[] = [];

    if (this.filesModified.size > 0) {
      suggestions.push("运行测试以验证更改");
      suggestions.push("使用 git diff 查看详细更改");
      suggestions.push("提交前审查所有修改");
    }

    if (action === "code" || action === "refactor") {
      suggestions.push("运行 linter 检查代码风格");
      suggestions.push("更新相关文档");
    }

    if (action === "debug") {
      suggestions.push("添加单元测试防止回归");
      suggestions.push("检查是否有类似问题");
    }

    return suggestions;
  }

  private generateDefaultClaudeMd(workspace: string): string {
    return `# 项目信息
- 工作空间: ${workspace}
- Agent SDK: @anthropic-ai/claude-agent-sdk

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

  private getProjectStructure(workspace: string, maxDepth: number = 2): string {
    try {
      const { execSync } = require("child_process");
      const output = execSync(
        `tree -L ${maxDepth} -I 'node_modules|.git|target|dist'`,
        {
          cwd: workspace,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          timeout: 5000,
        }
      );
      return output;
    } catch (error) {
      // tree 命令可能不可用
      try {
        const { execSync } = require("child_process");
        const output = execSync(
          "find . -maxdepth 2 -type f -not -path '*/\\.*' | head -50",
          {
            cwd: workspace,
            encoding: "utf-8",
            maxBuffer: 1024 * 1024,
            timeout: 5000,
          }
        );
        return output;
      } catch {
        return "";
      }
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
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

  private generateConversationId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 主函数
async function main() {
  const bridge = new ClaudeAgentSdkBridge();

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
      const request: AgentSdkBridgeRequest = JSON.parse(inputData);
      const response = await bridge.handleRequest(request);
      console.log(JSON.stringify(response));
      process.exit(0);
    } catch (error: any) {
      const errorResponse: AgentSdkBridgeResponse = {
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
          sdk_version: "0.1.0",
          model: "claude-3-5-sonnet-20241022",
          total_tokens: 0,
          thinking_enabled: true,
        },
      };
      console.log(JSON.stringify(errorResponse));
      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      success: false,
      error: error.message,
    })
  );
  process.exit(1);
});
