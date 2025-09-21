/**
 * code-matcher.ts
 * 代码匹配工具类，用于计算AI生成代码的采纳率
 */

import path from 'path';
import { FileChange } from '../imports';
import { FileChangeWithMatchStatus, CodeMatchResult, MRFileChange } from '../models/interfaces';

/**
 * 代码匹配工具类
 * 提供用于匹配AI生成代码与最终提交代码的工具方法
 */
export class CodeMatcher {
  private fileMatchThreshold: number;
  private codeMatchThreshold: number;
  
  /**
   * 构造函数
   * @param fileMatchThreshold 文件匹配阈值 (0-1)，默认0.7
   * @param codeMatchThreshold 代码匹配阈值 (0-1)，默认0.6
   */
  constructor(fileMatchThreshold: number = 0.7, codeMatchThreshold: number = 0.6) {
    this.fileMatchThreshold = fileMatchThreshold;
    this.codeMatchThreshold = codeMatchThreshold;
  }

  /**
   * 匹配AI生成的文件与MR变更的文件
   * @param mrFiles MR变更的文件列表
   * @param aiFileChanges AI生成的文件变更列表
   * @param mrFileContents 可选参数，MR文件内容映射 {文件路径: 内容}
   * @param aiFileContents 可选参数，AI文件内容映射 {文件路径: 内容}
   * @returns 带匹配状态的AI文件变更列表
   */
  public matchFiles(
    mrFiles: string[], 
    aiFileChanges: FileChange[], 
    mrFileContents?: Record<string, string>,
    aiFileContents?: Record<string, string>
  ): FileChangeWithMatchStatus[] {
    const result: FileChangeWithMatchStatus[] = [];
    
    // 规范化MR文件路径
    const normalizedMrFiles = mrFiles.map(filePath => path.normalize(filePath));
    
    // 遍历AI生成的文件变更
    for (const change of aiFileChanges) {
      const normalizedChangePath = path.normalize(change.file_path);
      let matchStatus: {
        isMatched: boolean;
        matchType: 'exact' | 'partial' | 'name' | 'none';
        matchScore: number;
        matchedFilePath?: string;
        codeMatchScore?: number;
        codeMatchedLines?: number;
        codeTotalLines?: number;
      } = {
        isMatched: false,
        matchType: 'none',
        matchScore: 0,
        codeMatchScore: 0,
        codeMatchedLines: 0,
        codeTotalLines: 0
      };
      
      // 1. 尝试精确匹配
      const exactMatchIndex = normalizedMrFiles.findIndex(filePath => filePath === normalizedChangePath);
      let bestMatchIndex = -1;
      
      if (exactMatchIndex !== -1) {
        matchStatus.matchType = 'exact';
        matchStatus.matchScore = 1.0;
        matchStatus.matchedFilePath = mrFiles[exactMatchIndex];
        bestMatchIndex = exactMatchIndex;
      } else {
        // 2. 尝试部分路径匹配
        const partialMatchIndex = normalizedMrFiles.findIndex(filePath => 
          filePath.endsWith(normalizedChangePath) || normalizedChangePath.endsWith(filePath));
          
        if (partialMatchIndex !== -1) {
          matchStatus.matchType = 'partial';
          matchStatus.matchScore = 0.9;
          matchStatus.matchedFilePath = mrFiles[partialMatchIndex];
          bestMatchIndex = partialMatchIndex;
        } else {
          // 3. 尝试文件名匹配
          const fileName = path.basename(normalizedChangePath);
          
          // 使用find而不是filter+map，只要找到一个匹配项就可以
          const nameMatchIndex = normalizedMrFiles.findIndex(filePath => path.basename(filePath) === fileName);
          
          if (nameMatchIndex !== -1) {
            matchStatus.matchType = 'name';
            matchStatus.matchScore = 0.8;
            matchStatus.matchedFilePath = mrFiles[nameMatchIndex];
            bestMatchIndex = nameMatchIndex;
            
            // 如果文件内容可用，尝试找到最佳内容匹配
            if (mrFileContents && aiFileContents) {
              const mrPath = mrFiles[nameMatchIndex];
              const mrContent = mrFileContents[mrPath];
              const aiContent = aiFileContents[change.file_path];
              
              if (mrContent && aiContent) {
                const codeMatch = this.matchCode(mrContent, aiContent);
                matchStatus.codeMatchScore = codeMatch.matchScore;
                matchStatus.codeMatchedLines = codeMatch.matchedLines;
                matchStatus.codeTotalLines = codeMatch.totalLines;
                
                // 如果有多个同名文件，优先考虑代码内容最相似的
                if (codeMatch.matchScore < 0.5) {
                  // 内容匹配度低，继续查找其他同名文件
                  for (let i = nameMatchIndex + 1; i < normalizedMrFiles.length; i++) {
                    if (path.basename(normalizedMrFiles[i]) === fileName) {
                      const altMrPath = mrFiles[i];
                      const altMrContent = mrFileContents[altMrPath];
                      
                      if (altMrContent) {
                        const altCodeMatch = this.matchCode(altMrContent, aiContent);
                        if (altCodeMatch.matchScore > matchStatus.codeMatchScore!) {
                          matchStatus.codeMatchScore = altCodeMatch.matchScore;
                          matchStatus.codeMatchedLines = altCodeMatch.matchedLines;
                          matchStatus.codeTotalLines = altCodeMatch.totalLines;
                          matchStatus.matchedFilePath = altMrPath;
                          bestMatchIndex = i;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // 4. 如果找到匹配的文件，尝试比较代码内容
      if (bestMatchIndex !== -1 && matchStatus.matchedFilePath && mrFileContents && aiFileContents) {
        const mrPath = matchStatus.matchedFilePath;
        const mrContent = mrFileContents[mrPath];
        const aiContent = aiFileContents[change.file_path];
        
        if (mrContent && aiContent) {
          const codeMatch = this.matchCode(mrContent, aiContent);
          matchStatus.codeMatchScore = codeMatch.matchScore;
          matchStatus.codeMatchedLines = codeMatch.matchedLines;
          matchStatus.codeTotalLines = codeMatch.totalLines;
          
          // 如果文件路径匹配但内容匹配分数低于阈值，则降低整体匹配分数
          if (codeMatch.matchScore < this.codeMatchThreshold) {
            // 降低但不完全抵消文件路径匹配分数
            matchStatus.matchScore = Math.max(matchStatus.matchScore * 0.7, 0.6);
          }
          
          // 如果代码内容完全不匹配（匹配率低于30%），则认为文件不匹配
          if (codeMatch.matchScore < 0.3) {
            matchStatus.matchScore = 0.5; // 低于默认阈值
          }
        }
      }
      
      // 5. 处理有change_details的情况
      if (change.change_details && matchStatus.matchScore >= this.fileMatchThreshold) {
        try {
          // 解析change_details中的diff内容，确认是否包含相似代码
          const aiDiffLines = this.parseDiffLines(change.change_details);
          if (aiDiffLines.added > 0) {
            // 如果没有内容匹配信息，则基于diff评估
            if (!matchStatus.codeMatchScore) {
              // 默认设置一个基于文件匹配类型的代码匹配分数
              matchStatus.codeMatchScore = 
                matchStatus.matchType === 'exact' ? 0.9 : 
                matchStatus.matchType === 'partial' ? 0.8 : 0.7;
            }
          }
        } catch (error) {
          console.warn(`解析文件 ${change.file_path} 的diff信息失败:`, error);
        }
      }
      
      // 最终判断是否匹配，综合考虑文件路径和代码内容
      matchStatus.isMatched = matchStatus.matchScore >= this.fileMatchThreshold;
      
      // 将匹配状态添加到结果中
      result.push({
        ...change,
        matchStatus
      });
    }
    
    return result;
  }

  /**
   * 解析diff内容，提取添加和删除的行数
   * @param diffContent diff内容
   * @returns 添加和删除的行数
   */
  public parseDiffLines(diffContent: string): { added: number, deleted: number } {
    if (!diffContent) return { added: 0, deleted: 0 };
    
    let addedLines = 0;
    let deletedLines = 0;
    
    // 按行分割diff内容
    const lines = diffContent.split('\n');
    
    // 遍历每一行，计算添加和删除的行数
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletedLines++;
      }
    }
    
    return {
      added: addedLines,
      deleted: deletedLines
    };
  }

  /**
   * 匹配代码内容
   * @param mrFileContent MR文件内容
   * @param aiFileContent AI生成的文件内容
   * @returns 代码匹配结果
   */
  public matchCode(mrFileContent: string, aiFileContent: string): CodeMatchResult {
    if (!mrFileContent || !aiFileContent) {
      return {
        isMatched: false,
        matchScore: 0,
        matchedLines: 0,
        totalLines: 0
      };
    }
    
    // 将内容按行分割
    const mrLines = mrFileContent.split('\n');
    const aiLines = aiFileContent.split('\n');
    
    let matchedLines = 0;
    const totalLines = aiLines.length;
    
    // 简单的行匹配算法，计算AI生成代码在最终代码中出现的行数
    // 这里使用简化版本，实际项目中可能需要更复杂的算法
    for (const aiLine of aiLines) {
      const trimmedAiLine = aiLine.trim();
      if (trimmedAiLine && trimmedAiLine.length > 5) { // 忽略太短的行
        if (mrLines.some(mrLine => mrLine.trim() === trimmedAiLine)) {
          matchedLines++;
        }
      }
    }
    
    // 计算匹配分数
    const matchScore = totalLines > 0 ? matchedLines / totalLines : 0;
    
    return {
      isMatched: matchScore >= this.codeMatchThreshold,
      matchScore,
      matchedLines,
      totalLines
    };
  }

  /**
   * 计算采纳率
   * @param matchedItems 匹配的项目数
   * @param totalItems 总项目数
   * @returns 采纳率（百分比）
   */
  public calculateAcceptanceRate(matchedItems: number, totalItems: number): number {
    if (totalItems <= 0) return 0;
    
    // 计算百分比并保留两位小数
    return Number(((matchedItems * 100.0) / totalItems).toFixed(2));
  }
}

export default CodeMatcher;