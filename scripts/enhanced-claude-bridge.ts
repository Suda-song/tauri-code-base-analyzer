#!/usr/bin/env node
/**
 * Enhanced Claude Bridge - 模拟 Claude Code SDK 功能
 *
 * 功能:
 * - 项目上下文管理 (CLAUDE.md)
 * - 细粒度工具权限控制
 * - 代码变更追踪
 * - 专门的编程任务优化
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

interface EnhancedBridgeRequest {
  action: "code" | "analyze" | "refactor" | "debug";
  prompt: string;
  workspace: string;
  files: string[];
  allowed_tools: string[];
  permissions: PermissionConfig;
  max_turns: number;
  save_history: boolean;
  claude_md_content?: string;
  max_tokens?: number;
}

interface PermissionConfig {
  allow_all: boolean;
  allow_patterns: string[];
  deny_patterns: string[];
}

interface EnhancedBridgeResponse {
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

class EnhancedClaudeBridge {
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

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    this.client = new Anthropic({ apiKey });
  }

  async handleRequest(
    request: EnhancedBridgeRequest
  ): Promise<EnhancedBridgeResponse> {
    try {
      // 1. 设置工作空间和上下文
      await this.setupWorkspace(request.workspace, request.claude_md_content);

      // 2. 配置权限
      this.configurePermissions(request.permissions);

      // 3. 重置追踪状态
      this.resetTracking();

      // 4. 构建系统提示词
      const systemPrompt = this.buildSystemPrompt(request.action);

      // 5. 构建增强的用户提示词
      const userPrompt = this.buildEnhancedPrompt(request);

      // 6. 执行任务
      const conversationId = this.generateConversationId();
      const result = await this.executeWithTools(
        systemPrompt,
        userPrompt,
        request.allowed_tools,
        request.max_turns,
        request.max_tokens || 8192
      );

      // 7. 分析响应并提取代码变更
      this.analyzeResponseForChanges(result);

      return {
        success: true,
        content: result,
        code_changes: this.codeChanges,
        tool_uses: this.toolUses,
        files_modified: Array.from(this.filesModified),
        commands_executed: this.commandsExecuted,
        conversation_id: conversationId,
        turn_count: 1,
        is_complete: true,
        warnings: this.generateWarnings(),
        suggestions: this.generateSuggestions(request.action),
      };
    } catch (error: any) {
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
  }

  private buildSystemPrompt(action: string): string {
    const actionPrompts = {
      code: `你是一个专业的代码生成专家。专注于编写高质量、可维护的代码。

核心原则：
- 遵循最佳实践和设计模式
- 编写清晰的注释和文档
- 考虑错误处理和边界情况
- 优先考虑代码可读性和可维护性`,

      analyze: `你是一个代码分析专家。专注于理解代码结构、识别模式和潜在问题。

核心原则：
- 深入分析代码逻辑和架构
- 识别潜在的bug和性能问题
- 评估代码质量和可维护性
- 提供具体的改进建议`,

      refactor: `你是一个代码重构专家。专注于改进代码质量而不改变功能。

核心原则：
- 保持功能不变的前提下优化代码
- 提高代码可读性和可维护性
- 消除代码重复和冗余
- 应用设计模式优化结构`,

      debug: `你是一个调试专家。专注于定位和修复代码问题。

核心原则：
- 系统性地分析问题
- 使用日志和调试工具
- 验证修复的正确性
- 防止类似问题再次出现`,
    };

    const basePrompt = actionPrompts[action] || actionPrompts.code;

    return `${basePrompt}

## 项目上下文
${this.claudeMdContext}

## 工具使用指南
- 在修改文件前，先仔细阅读现有代码
- 记录你使用的每个工具和操作
- 确保所有修改都有明确的理由
- 遵循项目的编码规范

## 输出格式
请在你的回复中清晰地说明：
1. 你的分析和思考过程
2. 具体的实施步骤
3. 代码变更的详细说明（如果有）
4. 测试和验证建议`;
  }

  private buildEnhancedPrompt(request: EnhancedBridgeRequest): string {
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
          prompt += `\n\n### ${file}\n\`\`\`${ext}\n${content}\n\`\`\``;
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

  private async executeWithTools(
    systemPrompt: string,
    userPrompt: string,
    allowedTools: string[],
    maxTurns: number,
    maxTokens: number
  ): Promise<string> {
    // 构建工具定义
    const tools = this.buildToolDefinitions(allowedTools);

    let conversationMessages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    let finalContent = "";

    for (let turn = 0; turn < maxTurns; turn++) {
      console.error(`\n🔄 第 ${turn + 1}/${maxTurns} 轮对话`);

      const response = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: conversationMessages,
        tools: tools.length > 0 ? tools : undefined,
      });

      // 提取文本内容
      const textBlocks = response.content.filter(
        (block) => block.type === "text"
      );
      const textContent = textBlocks
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n");

      finalContent = textContent;

      // 检查是否有工具调用
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        console.error("✅ 任务完成，没有更多工具调用");
        break;
      }

      // 执行工具调用
      console.error(`🔧 执行 ${toolUseBlocks.length} 个工具调用`);
      const toolResults: Anthropic.MessageParam[] = [];

      for (const toolUse of toolUseBlocks) {
        if (toolUse.type === "tool_use") {
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
            target: (toolUse.input as any).path || "",
            result: result.result,
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
    }

    return finalContent;
  }

  private buildToolDefinitions(allowedTools: string[]): Anthropic.Tool[] {
    const toolDefinitions: Record<string, Anthropic.Tool> = {
      Read: {
        name: "read_file",
        description: "读取文件内容",
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
        description: "写入文件内容（创建或覆盖）",
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
        description: "编辑文件内容（搜索替换）",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径",
            },
            old_text: {
              type: "string",
              description: "要替换的文本",
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
        description: "运行 bash 命令",
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
    console.error(`  📖 读取文件: ${filePath} (${content.length} 字符)`);
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
      `  ✍️  ${isNewFile ? "创建" : "修改"}文件: ${filePath} (${
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

    console.error(`  ✏️  编辑文件: ${filePath}`);
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
      });

      this.commandsExecuted.push(command);
      console.error(`  🖥️  执行命令: ${command}`);
      return { success: true, result: output };
    } catch (error: any) {
      return {
        success: false,
        result: `命令执行失败: ${error.message}`,
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
          `  🚫 权限拒绝: ${tool}(${target}) 匹配拒绝模式 ${pattern}`
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

    console.error(`  ⚠️  权限不足: ${tool}(${target}) 不匹配任何允许模式`);
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

  private analyzeResponseForChanges(response: string): void {
    // 分析响应，提取可能的代码块和建议
    // 这里可以添加更复杂的解析逻辑
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

    return warnings;
  }

  private generateSuggestions(action: string): string[] {
    const suggestions: string[] = [];

    if (this.filesModified.size > 0) {
      suggestions.push("运行测试以验证更改");
      suggestions.push("使用 git diff 查看详细更改");
    }

    if (action === "code" || action === "refactor") {
      suggestions.push("运行 linter 检查代码风格");
      suggestions.push("更新相关文档");
    }

    return suggestions;
  }

  private generateDefaultClaudeMd(workspace: string): string {
    return `# 项目信息
- 工作空间: ${workspace}

# 代码规范
- 使用一致的命名约定
- 添加适当的注释
- 遵循 DRY 原则

# 安全要求
- 文件操作限制在工作空间内
- 谨慎执行系统命令
`;
  }

  private getProjectStructure(workspace: string, maxDepth: number = 2): string {
    try {
      const { execSync } = require("child_process");
      const output = execSync(
        `tree -L ${maxDepth} -I 'node_modules|.git|target'`,
        {
          cwd: workspace,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
        }
      );
      return output;
    } catch (error) {
      // tree 命令可能不可用，使用简单的 ls
      try {
        const { execSync } = require("child_process");
        const output = execSync(
          "find . -maxdepth 2 -type f -not -path '*/\\.*'",
          {
            cwd: workspace,
            encoding: "utf-8",
            maxBuffer: 1024 * 1024,
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
    };
    return langMap[ext] || "text";
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 主函数
async function main() {
  const bridge = new EnhancedClaudeBridge();

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
      const request: EnhancedBridgeRequest = JSON.parse(inputData);
      const response = await bridge.handleRequest(request);
      console.log(JSON.stringify(response));
      process.exit(0);
    } catch (error: any) {
      const errorResponse = {
        success: false,
        error: error.message,
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
