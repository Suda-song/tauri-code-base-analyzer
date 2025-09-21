/**
 * AI提交生成器
 * 负责调用大模型生成 Commit 消息
 */

import { createAnthropic } from "@xhs/aws-anthropic";
import { generateText } from "ai";
import {
  CommitAnalysisContext,
  CommitGenerationConfig,
  CommitCandidate,
  CommitGenerationResult,
  AIGeneratorConfig,
  TargetContext,
  BusinessContext,
} from "../types";

process.env.XHS_AWS_BEDROCK_API_KEY = "aa74edef9cb44aab8a03f37f36197ec6";

const anthropic = createAnthropic({});

export class AICommitGenerator {
  private config: AIGeneratorConfig;

  constructor(config?: Partial<AIGeneratorConfig>) {
    this.config = {
      model: "claude-3-7-sonnet-latest",
      temperature: 0.7,
      maxTokens: 1000,
      ...config,
    };
  }

  /**
   * 生成提交消息
   */
  async generateCommitMessage(
    context: CommitAnalysisContext,
    config: CommitGenerationConfig
  ): Promise<CommitGenerationResult> {
    console.log("🤖 开始生成AI提交消息...");

    try {
      // 根据变更文件数量调整配置
      const dynamicConfig = this.adjustConfigByFileCount(context, config);
      // 构建提示词
      const prompt = this.buildPrompt(context, dynamicConfig);


      // 调用AI模型
      const response = await generateText({
        // @ts-ignore
        model: anthropic(this.config.model),
        prompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      // 解析AI响应
      const candidates = this.parseAIResponse(response.text, dynamicConfig);

      console.log(
        `✅ AI提交消息生成完成，生成了 ${candidates.length} 个候选项`
      );

      return {
        candidates,
        analysisContext: context,
        selectedCandidate: candidates[0],
        finalCommitMessage: candidates[0]?.fullMessage,
      };
    } catch (error) {
      console.error("❌ AI提交消息生成失败:", error);
      throw new Error(
        `AI提交消息生成失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 根据变更文件数量调整配置策略
   */
  private adjustConfigByFileCount(
    context: CommitAnalysisContext,
    config: CommitGenerationConfig
  ): CommitGenerationConfig {
    const fileCount = context.changeContext.changedFiles.length;
    const adjustedConfig = { ...config };

    // 文件数量策略：
    // 1-2个文件：禁用body，简化描述
    // 3-5个文件：可选body，中等详细度
    // 6+个文件：完整body，详细描述
    if (fileCount <= 2) {
      adjustedConfig.includeBody = false;
      adjustedConfig.maxLength = Math.min(config.maxLength, 50);
    } else if (fileCount <= 5) {
      adjustedConfig.includeBody = config.includeBody;
      adjustedConfig.maxLength = Math.min(config.maxLength, 65);
    }
    // 6+文件保持原配置

    console.log(
      `📊 文件数量: ${fileCount}, 调整策略: body=${adjustedConfig.includeBody}, maxLength=${adjustedConfig.maxLength}`
    );

    return adjustedConfig;
  }

  /**
   * 构建AI提示词
   */
  private buildPrompt(
    context: CommitAnalysisContext,
    config: CommitGenerationConfig
  ): string {
    const { targetContext, businessContext, changeContext } = context;
    const fileCount = changeContext.changedFiles.length;

    // 核心上下文信息
    const coreContext = this.buildCoreContext(targetContext, businessContext);

    // 变更摘要信息
    const changeSummary = this.buildChangeSummary(changeContext);

    // 生成规则
    const generationRules = this.buildGenerationRules(config, fileCount);

    const prompt = `你是Git commit消息生成专家。基于以下信息生成${
      config.maxCandidates
    }个符合Conventional Commits规范的commit消息。
${coreContext}

${changeSummary}

${generationRules}

## 输出格式
请严格按照以下格式输出${config.maxCandidates}个候选项：

CANDIDATE_1: [type]: [subject]${config.includeBody ? "\n\n[body]" : ""}
CANDIDATE_2: [type]: [subject]${config.includeBody ? "\n\n[body]" : ""}
${config.maxCandidates > 2 ? "..." : ""}

直接返回${
      config.maxCandidates
    }个候选项，严禁其他任何额外说明以及输出不符合数量的候选项。`;

    return prompt;
  }

  /**
   * 构建核心上下文
   */
  private buildCoreContext(
    targetContext: TargetContext,
    businessContext: BusinessContext
  ): string {
    const sections = [];

    // 使用文档内容作为需求上下文
    if (targetContext.documentContent) {
      sections.push("## 🎯 需求上下文");
      sections.push(targetContext.documentContent);
    }

    // 使用已构建的业务上下文信息
    if (businessContext.entities.length > 0) {
      sections.push("## 🏗️ 业务功能上下文");

      // 业务概览
      if (businessContext.businessOverview) {
        sections.push(`**概览**: ${businessContext.businessOverview}`);
      }

      // 文件功能详情
      if (businessContext.fileBusinessContexts.length > 0) {
        sections.push("### 📄 涉及文件的业务功能");
        businessContext.fileBusinessContexts.forEach((fileContext) => {
          sections.push(`**${fileContext.filePath}**`);
          sections.push(`- 核心功能: ${fileContext.primaryPurpose}`);
          if (fileContext.businessLogic) {
            sections.push(`- 业务逻辑: ${fileContext.businessLogic}`);
          }
          if (fileContext.keyEntities.length > 0) {
            sections.push(`- 关键实体: ${fileContext.keyEntities.join(", ")}`);
          }
        });
      }

      // 业务标签
      if (businessContext.entityTags.length > 0) {
        sections.push("### 🏷️ 业务标签");
        sections.push(businessContext.entityTags.slice(0, 8).join(" | "));
      }

      // 关键实体摘要
      if (businessContext.keyEntitySummaries.length > 0) {
        sections.push("### 📋 核心实体功能");
        businessContext.keyEntitySummaries.forEach((summary, index) => {
          sections.push(`${index + 1}. ${summary}`);
        });
      }
    }

    return sections.join("\n");
  }

  /**
   * 构建变更摘要
   */
  private buildChangeSummary(changeContext: any): string {
    const sections = ["## 📝 变更摘要"];

    sections.push(
      `文件: ${changeContext.changedFiles.length}个 | +${changeContext.addedLines.length}行 | -${changeContext.deletedLines.length}行`
    );

    if (changeContext.addedComments.length > 0) {
      sections.push(
        `新增注释: ${changeContext.addedComments.slice(0, 2).join("; ")}`
      );
    }

    if (changeContext.diffContent) {
      sections.push("\n### 变更内容");
      sections.push(
        changeContext.diffContent.length > 10000
          ? changeContext.diffContent.slice(0, 10000) + "..."
          : changeContext.diffContent
      );
    }

    return sections.join("\n");
  }

  /**
   * 构建生成规则
   */
  private buildGenerationRules(
    config: CommitGenerationConfig,
    fileCount: number
  ): string {
    const rules = ["## 生成规则"];

    rules.push(
      `1. 格式: type: subject${config.includeBody ? " + body" : ""} (${
        config.language === "zh" ? "中文" : "英文"
      })`
    );
    rules.push(`2. 限制使用类型: ${config.commitTypes.join("|")}`);
    rules.push(
      `3. 长度: 请根据变更文件数量以及代码变更内容长度，来动态决定字符，但最大不超过${config.maxLength}字符`
    );

    rules.push("4. 内容要求:");
    rules.push(
      "   - 基于上下文以及实际代码变更内容，客观描述技术变更，优先使用需求上下文里面提到的业务专用名词"
    );
    rules.push(
      "   - 如果代码变更涉及多个变更点，需要确保囊括所有变更项，避免遗漏"
    );
    rules.push(
      "   - 禁止使用增强了/修复了/添加了/优化了等xx了等主观性词汇以及相关表达"
    );
    rules.push("   - 禁止直接使用函数名或者代码内容以及使用限制类型以外的类型");

    if (config.includeBody) {
      rules.push("5. Body要求:");
      if (fileCount <= 2) {
        rules.push(
          "   - 简洁明了说明变更动作，避免过分冗余阐述具体的函数名和代码内容"
        );
      } else {
        rules.push(
          "   - 概括说明变更动作，避免过分冗余阐述具体的函数名和代码内容"
        );
      }
      rules.push("   - 避免重复type和subject内容");
      rules.push("   - 禁止使用序号和分段格式");
      rules.push(
        "   - 禁止使用增强了/修复了/添加了/优化了等xx了等主观性词汇以及相关表达"
      );
    }

    return rules.join("\n");
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(
    responseText: string,
    config: CommitGenerationConfig
  ): CommitCandidate[] {
    const candidates: CommitCandidate[] = [];
    const lines = responseText.split("\n").filter((line) => line.trim());

    // 检查是否包含CANDIDATE_前缀
    const hasCandidatePrefix = lines.some((line) =>
      line.startsWith("CANDIDATE_")
    );

    if (!hasCandidatePrefix) {
      // 没有CANDIDATE_前缀，手动添加前缀并重新解析
      const prefixedText = `CANDIDATE_1: ${lines[0]}\n${lines
        .slice(1)
        .join("\n")}`;
      return this.parseAIResponse(prefixedText, config);
    }

    let currentCandidate: Partial<CommitCandidate> = {};
    let bodyLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("CANDIDATE_")) {
        // 保存上一个候选项
        if (currentCandidate.type && currentCandidate.subject) {
          candidates.push({
            type: currentCandidate.type,
            subject: currentCandidate.subject,
            body: bodyLines.join("\n"),
            fullMessage: this.formatCommitMessage(
              currentCandidate,
              bodyLines.join("\n")
            ),
          });
        }

        // 开始新的候选项
        const content = line.substring(line.indexOf(":") + 1).trim();
        const match = content.match(/^(\w+):\s*(.+)$/);

        if (match) {
          currentCandidate = {
            type: match[1],
            subject: match[2],
          };
          bodyLines = [];
        }
      } else if (currentCandidate.type && line.trim()) {
        // 这是body内容
        bodyLines.push(line.trim());
      }
    }

    // 处理最后一个候选项
    if (currentCandidate.type && currentCandidate.subject) {
      candidates.push({
        type: currentCandidate.type,
        subject: currentCandidate.subject,
        body: bodyLines.join("\n"),
        fullMessage: this.formatCommitMessage(
          currentCandidate,
          bodyLines.join("\n")
        ),
      });
    }

    return candidates.slice(0, config.maxCandidates);
  }

  /**
   * 格式化commit消息
   */
  private formatCommitMessage(
    candidate: Partial<CommitCandidate>,
    body: string
  ): string {
    let message = `${candidate.type}: ${candidate.subject}`;

    if (body && body.trim()) {
      message += `\n\n${body}`;
    }

    return message;
  }
}
