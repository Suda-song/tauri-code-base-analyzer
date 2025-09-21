/**
 * 目标上下文分析器
 * 负责分析PRD内容、工作项、技术方案等目标上下文信息
 */

import { ContextAnalyzer, TargetContext } from "../types";
import * as fs from "fs/promises";

export class TargetContextAnalyzer implements ContextAnalyzer<TargetContext> {
  async analyze(input: TargetContext): Promise<TargetContext> {
    console.log("📋 开始分析目标上下文...", input);

    const context: TargetContext = {
      links: input.links,
      redDocContexts: input.redDocContexts,
    };

    // 处理链接内容
    if (input.links && input.links.length > 0) {
      console.log(`   🔗 链接内容: 已加载 ${input.links.length} 个链接`);
    }

    // 处理RedDoc文档内容并拼接所有文档内容
    const allDocumentContents: string[] = [];

    if (input.redDocContexts && input.redDocContexts.length > 0) {
      for (const redDoc of input.redDocContexts) {
        try {
          const mdContent = await this.readMarkdownFile(redDoc.filePath);
          if (mdContent) {
            allDocumentContents.push(`## ${redDoc.title}\n\n${mdContent}`);
            console.log(`   📖 RedDoc文档: ${redDoc.title} 已加载`);
          }
        } catch (error) {
          console.warn(`   ⚠️  无法读取RedDoc文档 ${redDoc.title}: ${error}`);
        }
      }
    }

    // 拼接所有文档内容
    if (allDocumentContents.length > 0) {
      context.documentContent = allDocumentContents.join("\n\n---\n\n");
      console.log(`   📦 已拼接 ${allDocumentContents.length} 个文档内容`);
    }

    // 记录上下文来源
    const hasContent = !!context.documentContent;

    if (hasContent) {
      console.log("📦 已从上下文加载目标信息");
    } else {
      console.log("💡 没有找到目标上下文信息");
    }

    console.log("✅ 目标上下文分析完成");
    return context;
  }

  /**
   * 读取Markdown文件内容
   */
  private async readMarkdownFile(filePath: string): Promise<string | null> {
    try {
      // 检查文件是否存在
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        console.warn(`   ⚠️  文件不存在: ${filePath}`);
        return null;
      }

      // 读取文件内容
      const content = await fs.readFile(filePath, "utf-8");
      return this.processTextContent(content) || null;
    } catch (error) {
      console.error(`   ❌ 读取文件失败 ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 处理文本内容
   */
  private processTextContent(content?: string): string | undefined {
    if (!content) return undefined;

    // 简单清洗：去除多余空白和换行
    return content.trim().replace(/\n\s*\n/g, "\n");
  }
}
