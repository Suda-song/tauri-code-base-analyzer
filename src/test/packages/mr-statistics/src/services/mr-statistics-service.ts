/**
 * mr-statistics-service.ts
 * MR统计服务的核心实现
 */

import { v4 as uuidv4 } from 'uuid';
import { getSequelize, FileChange, FlowRecord, QueryTypes } from '../imports';
import { getHttpClient } from './http-client';
import { exec } from 'child_process';
import util from 'util';
import { BranchInfoService } from '../git/branch-info';

// 将exec转换为Promise
const execPromise = util.promisify(exec);
import { CodeMatcher } from '../utils/code-matcher';
import { 
  MRStatisticsOptions, 
  MRStatisticsResult, 
  BranchInfo,
  FileChangeWithMatchStatus
} from '../models/interfaces';

/**
 * MR统计服务类
 * 提供计算MR阶段代码采纳率的核心功能
 */
export class MRStatisticsService {
  private projectPath: string;
  private options: MRStatisticsOptions;
  private branchInfoService: BranchInfoService;
  private codeMatcher: CodeMatcher;

  /**
   * 构造函数
   * @param options MR统计选项
   */
  constructor(options: MRStatisticsOptions = {}) {
    this.projectPath = process.cwd();
    this.options = {
      sourceBranch: undefined, // 默认使用当前分支
      targetBranch: 'master',  // 默认目标分支
      verbose: false,
      thresholds: {
        fileMatch: 0.7,
        codeMatch: 0.6
      },
      ignorePatterns: [
        '**/*.min.js',
        '**/*.min.css',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**'
      ],
      ...options
    };
    
    this.branchInfoService = new BranchInfoService(this.projectPath, this.options.targetBranch, this.options.isPodMode);
    this.codeMatcher = new CodeMatcher(
      this.options.thresholds?.fileMatch,
      this.options.thresholds?.codeMatch
    );
  }

  /**
   * 计算MR统计数据
   * @returns MR统计结果
   */
  public async calculateMRStatistics(): Promise<MRStatisticsResult> {
    try {
      console.log(`🚀 开始计算MR统计数据...`);
      
      // 1. 获取分支信息
      // 在这里，getBranchInfo会自动处理是否在合并后的主分支上执行的情况
      // 如果是在合并后的主分支上执行，会提取原分支信息
      const branchInfo = await this.getBranchInfo();
      console.log(`📋 分支信息: ${branchInfo.currentBranch} -> ${branchInfo.targetBranch}`);
      
      // 2. 获取分支的所有变更文件
      const mrFiles = await this.getMRChangedFiles(branchInfo);
      console.log(`📁 MR变更文件数: ${mrFiles.length}`);
      
      // 3. 获取相关的AI出码任务记录
      const aiFlowRecords = await this.getAIFlowRecords(branchInfo);
      console.log(`🤖 相关AI任务数: ${aiFlowRecords.length}`);
      
      // 4. 获取AI出码的文件变更记录
      const aiFileChanges = await this.getAIFileChanges(aiFlowRecords);
      console.log(`📝 AI文件变更数: ${aiFileChanges.length}`);
      
      // 5. 尝试获取文件内容，用于更精确的匹配
      console.log(`🔍 获取文件内容用于精确匹配...`);
      const mrFileContents = await this.getMRFileContents(mrFiles, branchInfo.latestSha);
      const aiFileContents = await this.getAIFileContents(aiFileChanges);
      
      // 6. 匹配AI生成的文件与MR变更的文件，使用代码内容进行精确匹配
      const matchedAiFiles = this.codeMatcher.matchFiles(
        mrFiles, 
        aiFileChanges,
        mrFileContents,
        aiFileContents
      );
      const matchedFiles = matchedAiFiles.filter(file => file.matchStatus.isMatched);
      console.log(`🔍 匹配到的AI文件数: ${matchedFiles.length}/${aiFileChanges.length}`);
      
      // 7. 计算文件级采纳率
      const fileAcceptanceStats = this.calculateFileAcceptance(mrFiles.length, matchedFiles.length, aiFileChanges.length);
      
      // 8. 计算代码行级采纳率 - 使用改进的基于内容的计算方法
      const codeAcceptanceStats = await this.calculateImprovedCodeAcceptance(matchedAiFiles);
      
      // 9. 获取分支的所有提交
      const commits = await this.branchInfoService.getBranchCommits(branchInfo.baseSha, branchInfo.latestSha);
      console.log(`📊 MR包含提交数: ${commits.length}`);
      
      // 10. 解析应用名（如果未在选项中提供）
      let appName = this.options.appName;
      if (!appName) {
        console.log(`🔍 未提供应用名，尝试从Git信息中自动解析...`);
        appName = await this.branchInfoService.parseAppName();
        if (appName) {
          console.log(`✅ 自动解析到应用名: ${appName}`);
        }
      } else {
        console.log(`📝 使用用户提供的应用名: ${appName}`);
      }
      
      // 11. 生成MR统计结果
      const result: MRStatisticsResult = {
        id: uuidv4(),
        appName,
        sourceBranch: branchInfo.currentBranch,
        targetBranch: branchInfo.targetBranch,
        
        // 文件级采纳统计
        totalMRFiles: mrFiles.length,
        includeAiCodeFiles: fileAcceptanceStats.includeAiCodeFiles,
        aiCodeFiles: fileAcceptanceStats.aiCodeFiles,
        mrFileAcceptanceRate: fileAcceptanceStats.fileAcceptanceRate,
        
        // 代码行级采纳统计
        totalMRCodeLines: codeAcceptanceStats.totalMRCodeLines,
        includeAiCodeLines: codeAcceptanceStats.includeAiCodeLines,
        mrCodeAcceptanceRate: codeAcceptanceStats.mrCodeAcceptanceRate,
        
        // 相关提交信息
        relatedCommits: commits,
        
        // 时间信息
        createdAt: new Date(),
        mergedAt: branchInfo.isMerged ? new Date() : undefined
      };
      
      console.log(`✅ MR统计数据计算完成`);
      console.log(`📊 文件级采纳率: ${result.mrFileAcceptanceRate}%`);
      console.log(`📊 代码行级采纳率: ${result.mrCodeAcceptanceRate}%`);
      
      return result;
    } catch (error) {
      console.error('计算MR统计数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取分支信息
   * @returns 分支信息
   */
  private async getBranchInfo(): Promise<BranchInfo> {
    return await this.branchInfoService.getCurrentBranchInfo(this.options.targetBranch);
  }

  /**
   * 获取MR变更的文件列表
   * @param branchInfo 分支信息
   * @returns MR变更的文件列表
   */
  private async getMRChangedFiles(branchInfo: BranchInfo): Promise<string[]> {
    console.log(`📁 获取分支变更文件: ${branchInfo.baseSha.substring(0, 7)}...${branchInfo.latestSha.substring(0, 7)}`);
    
    const files = await this.branchInfoService.getBranchChangedFiles(
      branchInfo.baseSha, 
      branchInfo.latestSha
    );
    
    console.log(`🔍 找到 ${files.length} 个变更文件`);
    
    // 过滤忽略的文件
    if (this.options.ignorePatterns && this.options.ignorePatterns.length > 0) {
      console.log(`🔎 应用忽略模式过滤: ${this.options.ignorePatterns.join(', ')}`);
      
      // 简单的通配符匹配，实际项目中可能需要使用minimatch等库实现更精确的匹配
      const filteredFiles = files.filter(file => {
        for (const pattern of this.options.ignorePatterns || []) {
          if (this.simpleGlobMatch(file, pattern)) {
            if (this.options.verbose) {
              console.log(`⏩ 忽略文件: ${file} (匹配模式: ${pattern})`);
            }
            return false;
          }
        }
        return true;
      });
      
      console.log(`📋 过滤后剩余 ${filteredFiles.length} 个文件`);
      return filteredFiles;
    }
    
    return files;
  }

  /**
   * 获取与当前分支相关的AI流程记录
   * @param branchInfo 分支信息
   * @returns AI流程记录列表
   */
  private async getAIFlowRecords(branchInfo: BranchInfo): Promise<FlowRecord[]> {
    try {
      console.log(`🔍 获取分支 ${branchInfo.currentBranch} 相关的AI流程记录`);
      
      // 检查是否为Pod模式（HTTP模式）
      if (this.options.isPodMode) {
        try {
          const records = await getHttpClient().getFlowsByBranchName(branchInfo.currentBranch);
          console.log(`✅ HTTP模式查询到 ${records.length} 条AI流程记录，使用分支名: ${branchInfo.currentBranch}`);
          
          if (this.options.verbose && records.length > 0) {
            records.forEach((record, index) => {
              console.log(`🤖 AI流程 [${index+1}/${records.length}]: ${record.flow_id} - ${record.task_context || '无上下文'} - ${record.last_commit_hash || '无提交哈希'}`);
            });
          }
          
          return records as FlowRecord[];
        } catch (error) {
          console.error('HTTP模式查询AI流程记录失败，回退到空结果:', error);
          return [];
        }
      }
      
      // 数据库模式
      const sequelize = await getSequelize();
      const [rows] = await sequelize.query(`
        SELECT * FROM modular_dev_flow_records 
        WHERE branch_name = :branchName
        ORDER BY created_at DESC
      `, {
        replacements: { 
          branchName: branchInfo.currentBranch 
        },
        type: QueryTypes.SELECT
      });
      
      const records = Array.isArray(rows) ? rows as FlowRecord[] : (rows ? [rows as FlowRecord] : []);
      console.log(`✅ 数据库模式查询到 ${records.length} 条AI流程记录，使用分支名: ${branchInfo.currentBranch}`);
      
      if (this.options.verbose && records.length > 0) {
        records.forEach((record, index) => {
          console.log(`🤖 AI流程 [${index+1}/${records.length}]: ${record.flow_id} - ${record.task_context || '无上下文'} - ${record.last_commit_hash || '无提交哈希'}`);
        });
      }
      
      return records;
    } catch (error) {
      console.error('查询AI流程记录失败:', error);
      return [];
    }
  }

  /**
   * 获取AI生成的文件变更记录
   * @param flowRecords AI流程记录列表
   * @returns AI文件变更记录列表
   */
  private async getAIFileChanges(flowRecords: FlowRecord[]): Promise<FileChange[]> {
    if (!flowRecords || flowRecords.length === 0) {
      return [];
    }
    
    try {
      const flowIds = flowRecords.map(flow => flow.flow_id);
      
      // 检查是否为Pod模式（HTTP模式）
      if (this.options.isPodMode) {
        try {
          const allChanges = await getHttpClient().getFileChangesByFlowIds(flowIds);
          
          // 对变更记录进行去重，同一文件路径只保留最新的变更记录
          const latestChangesByPath = new Map<string, FileChange>();
          
          for (const change of allChanges) {
            const filePath = change.file_path;
            
            // 如果这个文件路径还没有记录，或者当前记录比已有记录更新
            // 因为我们的查询已经按created_at降序排序，所以第一次遇到的记录就是最新的
            if (!latestChangesByPath.has(filePath)) {
              latestChangesByPath.set(filePath, change as FileChange);
            }
          }
          
          console.log(`📝 HTTP模式获取到 ${allChanges.length} 条AI文件变更记录，去重后剩余 ${latestChangesByPath.size} 条`);
          
          // 返回去重后的结果
          return Array.from(latestChangesByPath.values());
        } catch (error) {
          console.error('HTTP模式查询AI文件变更记录失败，回退到空结果:', error);
          return [];
        }
      }
      
      // 数据库模式
      const sequelize = await getSequelize();
      const [rows] = await sequelize.query(`
        SELECT * FROM modular_dev_flow_file_changes
        WHERE flow_id IN (:flowIds)
        ORDER BY created_at DESC
      `, {
        replacements: { flowIds },
        type: QueryTypes.SELECT
      });
      
      const allChanges = Array.isArray(rows) ? rows as FileChange[] : (rows ? [rows as FileChange] : []);
      
      // 对变更记录进行去重，同一文件路径只保留最新的变更记录
      const latestChangesByPath = new Map<string, FileChange>();
      
      for (const change of allChanges) {
        const filePath = change.file_path;
        
        // 如果这个文件路径还没有记录，或者当前记录比已有记录更新
        // 因为我们的查询已经按created_at降序排序，所以第一次遇到的记录就是最新的
        if (!latestChangesByPath.has(filePath)) {
          latestChangesByPath.set(filePath, change);
        }
      }
      
      console.log(`📝 数据库模式获取到 ${allChanges.length} 条AI文件变更记录，去重后剩余 ${latestChangesByPath.size} 条`);
      
      // 返回去重后的结果
      return Array.from(latestChangesByPath.values());
    } catch (error) {
      console.error('查询AI文件变更记录失败:', error);
      return [];
    }
  }

  /**
   * 计算文件级采纳率
   * @param totalFiles MR总文件数
   * @param includeAiCodeFiles 包含AI代码的文件数
   * @param aiCodeFiles AI变更总文件数
   * @returns 文件级采纳率统计数据
   */
  private calculateFileAcceptance(
    totalFiles: number, 
    includeAiCodeFiles: number, 
    aiCodeFiles: number
  ): {
    totalFiles: number,
    includeAiCodeFiles: number,
    aiCodeFiles: number,
    fileAcceptanceRate: number
  } {
    // 只有当AI确实生成了代码文件(aiCodeFiles > 0)时，才计算采纳率
    // 否则使用0表示"AI有变更但全部未采纳"
    let fileAcceptanceRate = 0;
    
    if (aiCodeFiles > 0) {
      if (totalFiles > 0) {
        // 计算AI文件采纳率
        fileAcceptanceRate = this.codeMatcher.calculateAcceptanceRate(includeAiCodeFiles, aiCodeFiles);
      }
    }
    
    return {
      totalFiles,
      includeAiCodeFiles,
      aiCodeFiles,
      fileAcceptanceRate
    };
  }

  /**
   * 获取MR文件的内容
   * @param mrFiles MR变更的文件列表 
   * @param commitSha 提交SHA
   * @returns 文件内容映射
   */
  private async getMRFileContents(mrFiles: string[], commitSha: string): Promise<Record<string, string>> {
    const fileContents: Record<string, string> = {};
    
    console.log(`尝试获取 ${mrFiles.length} 个MR文件的内容...`);
    
    try {
      // 批量获取文件内容，每次处理最多10个文件，避免执行命令太大
      const batchSize = 10;
      for (let i = 0; i < mrFiles.length; i += batchSize) {
        const batchFiles = mrFiles.slice(i, i + batchSize);
        
        for (const filePath of batchFiles) {
          try {
            // 使用git命令获取特定提交中的文件内容
            const { stdout } = await execPromise(`git show ${commitSha}:${filePath}`, {
              cwd: this.projectPath,
              maxBuffer: 5 * 1024 * 1024 // 增加缓冲区大小，处理大文件
            });
            
            fileContents[filePath] = stdout;
          } catch (error) {
            // 文件可能不存在，或者是二进制文件，忽略错误
            console.warn(`无法获取文件内容 ${filePath}: ${error}`);
          }
        }
      }
      
      console.log(`✅ 成功获取 ${Object.keys(fileContents).length}/${mrFiles.length} 个文件的内容`);
    } catch (error) {
      console.error('批量获取文件内容失败:', error);
    }
    
    return fileContents;
  }
  
  /**
   * 获取AI生成的文件内容
   * @param aiFileChanges AI生成的文件变更列表
   * @returns 文件内容映射
   */
  private async getAIFileContents(aiFileChanges: FileChange[]): Promise<Record<string, string>> {
    const fileContents: Record<string, string> = {};
    
    console.log(`尝试从change_details解析 ${aiFileChanges.length} 个AI文件的内容...`);
    
    // 从change_details字段获取AI生成的文件内容
    for (const change of aiFileChanges) {
      if (change.change_details) {
        try {
          // 解析change_details中的文件内容
          // 通常change_details是diff格式，我们需要提取新增的内容
          const content = this.extractNewContentFromDiff(change.change_details);
          if (content) {
            fileContents[change.file_path] = content;
          }
        } catch (error) {
          console.warn(`无法从change_details解析文件内容 ${change.file_path}: ${error}`);
        }
      }
    }
    
    console.log(`✅ 成功解析 ${Object.keys(fileContents).length}/${aiFileChanges.length} 个AI文件的内容`);
    
    return fileContents;
  }
  
  /**
   * 从diff内容中提取新增的文件内容
   * @param diffContent diff格式的内容
   * @returns 提取的文件内容
   */
  private extractNewContentFromDiff(diffContent: string): string {
    if (!diffContent) return '';
    
    // 按行分割
    const lines = diffContent.split('\n');
    const newContent: string[] = [];
    
    // 忽略diff头部
    let inHeader = true;
    
    for (const line of lines) {
      // 跳过diff头部
      if (inHeader) {
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
          // 还在头部
          if (line.startsWith('@@')) {
            inHeader = false; // 下一行开始是内容
          }
          continue;
        } else {
          inHeader = false; // 不是头部格式，开始处理内容
        }
      }
      
      // 提取新增的行（以+开头，但不是diff头部的+++）
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // 去掉前缀'+'，添加到新内容中
        newContent.push(line.substring(1));
      } else if (!line.startsWith('-') && !line.startsWith('\\')) {
        // 保留上下文行（不以-或\开头）
        newContent.push(line);
      }
    }
    
    return newContent.join('\n');
  }
  
  // 此处已删除原始的calculateCodeAcceptance方法，因为已被calculateImprovedCodeAcceptance替代
  
  /**
   * 从AI变更中提取具体的代码行
   * @param change AI文件变更
   * @returns 变更的代码行集合
   */
  private extractChangedLines(change: FileChange): Set<string> {
    const changedLines = new Set<string>();
    
    try {
      // 优先使用change_details字段
      if (change.change_details) {
        const lines = change.change_details.split('\n');
        
        // 忽略diff头部
        let inHeader = true;
        
        for (const line of lines) {
          // 跳过diff头部
          if (inHeader) {
            if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
              if (line.startsWith('@@')) {
                inHeader = false; // 下一行开始是内容
              }
              continue;
            } else {
              inHeader = false; // 不是头部格式，开始处理内容
            }
          }
          
          // 提取新增的代码行（去掉前缀'+'）
          if (line.startsWith('+') && !line.startsWith('+++')) {
            // 归一化代码行，使比较更准确
            const trimmedLine = line.substring(1).trim();
            if (trimmedLine.length > 0) {
              changedLines.add(trimmedLine);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`解析文件变更 ${change.file_path} 的代码行失败:`, error);
    }
    
    return changedLines;
  }
  
  /**
   * 改进的代码行级采纳率计算方法，使用代码内容匹配结果
   * @param matchedAiFiles 匹配的AI文件变更记录
   * @returns 代码行级采纳率统计数据
   */
  private async calculateImprovedCodeAcceptance(
    matchedAiFiles: FileChangeWithMatchStatus[]
  ): Promise<{
    totalMRCodeLines: number,
    includeAiCodeLines: number,
    mrCodeAcceptanceRate: number
  }> {
    // 汇总所有文件变更的代码行数
    let totalAiCodeLines = 0;   // AI生成的总代码行数
    let includeAiCodeLines = 0; // 被采纳的AI代码行数
    
    // 按文件路径分组，处理同一文件的多次变更
    const filePathGroups = matchedAiFiles.reduce((groups, file) => {
      const filePath = file.file_path;
      if (!groups.has(filePath)) {
        groups.set(filePath, []);
      }
      groups.get(filePath)!.push(file);
      return groups;
    }, new Map<string, FileChangeWithMatchStatus[]>());
    
    // 遍历每个唯一的文件路径
    for (const [_, changes] of filePathGroups.entries()) {
      // 获取所有变更中唯一的代码行
      const allUniqueLines = new Set<string>();
      
      // 以最新的变更记录为基准（前面已经按created_at降序排序）
      const latestChange = changes[0];
      const matchStatus = latestChange.matchStatus;
      
      // 合并同一文件所有变更的代码行
      for (const change of changes) {
        const changedLines = this.extractChangedLines(change);
        changedLines.forEach(line => allUniqueLines.add(line));
      }
      
      // 计算这个文件的总代码行数（去重后）
      const aiFileUniqueLines = allUniqueLines.size;
      totalAiCodeLines += aiFileUniqueLines;
      
      // 如果文件匹配，计算被采纳的代码行数
      if (matchStatus.isMatched) {
        let adoptionRate = 0.8; // 默认采纳率
        
        // 如果有代码内容匹配分数，使用它作为采纳率
        if (matchStatus.codeMatchScore !== undefined && matchStatus.codeMatchScore > 0) {
          adoptionRate = matchStatus.codeMatchScore;
        }
        
        // 按内容匹配率比例计算采纳的行数
        includeAiCodeLines += Math.round(aiFileUniqueLines * adoptionRate);
      }
    }
    
    // 计算代码行级采纳率 - 使用AI代码采纳行数与AI总代码行数比例
    let mrCodeAcceptanceRate = 0;
    if (totalAiCodeLines > 0) {
      mrCodeAcceptanceRate = this.codeMatcher.calculateAcceptanceRate(
        includeAiCodeLines, 
        totalAiCodeLines
      );
    }
    
    return {
      totalMRCodeLines: totalAiCodeLines, // 使用AI代码总行数作为指标
      includeAiCodeLines,
      mrCodeAcceptanceRate
    };
  }

  /**
   * 简单的通配符匹配
   * @param filePath 文件路径
   * @param pattern 通配符模式
   * @returns 是否匹配
   */
  private simpleGlobMatch(filePath: string, pattern: string): boolean {
    // 替换通配符为正则表达式
    let regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.{0,}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    // 转换为正则表达式并匹配
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

export default MRStatisticsService;