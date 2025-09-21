/**
 * 变更上下文分析器
 * 负责分析代码变更的上下文，处理diff内容和注释
 */

import { ChangeContext, ContextAnalyzer } from "../types";
import { GitUtils } from "../utils/git-utils";

export interface ChangeContextInput {
  changedFiles: string[];
  diffContent: string;
  gitUtils: GitUtils;
}

export class ChangeContextAnalyzer implements ContextAnalyzer<ChangeContext> {
  async analyze(input: ChangeContextInput): Promise<ChangeContext> {
    console.log("🔄 开始分析变更上下文...");

    const { changedFiles, diffContent, gitUtils } = input;

    // 提取新增的注释
    const addedComments = gitUtils.extractAddedComments(diffContent);

    // 提取新增和删除的行
    const { addedLines, deletedLines } = gitUtils.extractDiffLines(diffContent);

    const context: ChangeContext = {
      changedFiles,   // 变更数量
      diffContent,    // 变更内容
      addedComments,  // 新增注释
      deletedLines,   // 删除行
      addedLines,     // 新增行
    };

    console.log(`✅ 变更上下文分析完成，处理了 ${changedFiles.length} 个文件`);
    return context;
  }

  /**
   * 分析变更类型
   */
  analyzeChangeType(context: ChangeContext): {
    type: "feature" | "fix" | "refactor" | "style" | "docs" | "test" | "chore";
    confidence: number;
    reasons: string[];
  } {
    const { addedLines, deletedLines, addedComments, changedFiles } = context;

    const indicators = {
      feature: 0,
      fix: 0,
      refactor: 0,
      style: 0,
      docs: 0,
      test: 0,
      chore: 0,
    };

    const reasons: string[] = [];

    // 分析文件路径
    for (const file of changedFiles) {
      if (file.includes("test") || file.includes("spec")) {
        indicators.test += 2;
        reasons.push("包含测试文件");
      }
      if (file.includes("doc") || file.includes("readme")) {
        indicators.docs += 2;
        reasons.push("包含文档文件");
      }
      if (file.includes("style") || file.includes("css")) {
        indicators.style += 1;
        reasons.push("包含样式文件");
      }
    }

    // 分析新增代码
    for (const line of addedLines) {
      const trimmed = line.trim();

      // 功能新增指标
      if (
        trimmed.includes("function") ||
        trimmed.includes("const ") ||
        trimmed.includes("export")
      ) {
        indicators.feature += 1;
      }

      // 修复指标
      if (
        trimmed.includes("fix") ||
        trimmed.includes("bug") ||
        trimmed.includes("error")
      ) {
        indicators.fix += 2;
        reasons.push("包含修复相关代码");
      }

      // 重构指标
      if (
        trimmed.includes("refactor") ||
        trimmed.includes("rename") ||
        trimmed.includes("move")
      ) {
        indicators.refactor += 1;
        reasons.push("包含重构相关代码");
      }

      // 样式指标
      if (
        trimmed.includes("style") ||
        trimmed.includes("css") ||
        trimmed.includes("color")
      ) {
        indicators.style += 1;
      }
    }

    // 分析注释
    for (const comment of addedComments) {
      if (comment.includes("TODO") || comment.includes("FIXME")) {
        indicators.chore += 1;
        reasons.push("包含待办事项注释");
      }
      if (comment.includes("新增") || comment.includes("添加")) {
        indicators.feature += 1;
        reasons.push("注释提到新增功能");
      }
      if (comment.includes("修复") || comment.includes("解决")) {
        indicators.fix += 2;
        reasons.push("注释提到修复问题");
      }
    }

    // 分析删除代码
    if (deletedLines.length > addedLines.length * 0.8) {
      indicators.refactor += 1;
      reasons.push("大量代码删除，可能是重构");
    }

    // 确定最终类型
    const maxIndicator = Math.max(...Object.values(indicators));
    const type = Object.keys(indicators).find(
      (key) => indicators[key as keyof typeof indicators] === maxIndicator
    ) as keyof typeof indicators;

    // 计算置信度
    const totalIndicators = Object.values(indicators).reduce(
      (sum, val) => sum + val,
      0
    );
    const confidence =
      totalIndicators > 0 ? (maxIndicator / totalIndicators) * 100 : 50;

    return {
      type,
      confidence: Math.round(confidence),
      reasons,
    };
  }

  /**
   * 分析变更范围
   */
  analyzeChangeScope(context: ChangeContext): {
    scope: string;
    affectedModules: string[];
    impactLevel: "low" | "medium" | "high";
  } {
    const { changedFiles } = context;

    const moduleMap = new Map<string, number>();
    const affectedModules: string[] = [];

    // 分析受影响的模块
    for (const file of changedFiles) {
      const parts = file.split("/");
      if (parts.length > 1) {
        const module = parts[1]; // 假设第二层目录是模块
        moduleMap.set(module, (moduleMap.get(module) || 0) + 1);
      }
    }

    // 确定主要影响的模块
    const sortedModules = Array.from(moduleMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([module]) => module);

    // 确定主要范围
    const scope = sortedModules.length > 0 ? sortedModules[0] : "global";

    // 确定影响级别
    let impactLevel: "low" | "medium" | "high" = "low";
    if (changedFiles.length > 10) {
      impactLevel = "high";
    } else if (changedFiles.length > 3) {
      impactLevel = "medium";
    }

    return {
      scope,
      affectedModules: sortedModules,
      impactLevel,
    };
  }
}
