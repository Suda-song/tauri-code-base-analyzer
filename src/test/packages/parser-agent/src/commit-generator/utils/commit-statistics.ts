/**
 * commit-statistics.ts
 * 代码统计服务，用于计算代码采纳率相关统计数据
 */
import path from "path";
import { exec } from "child_process";
import util from "util";
import { sequelize } from "../db";
import { QueryTypes } from "sequelize";
import { CommitManager } from "../db/commit-manager";

// 将exec转换为Promise
const execPromise = util.promisify(exec);

/**
 * 文件变更记录接口
 */
export interface FileChange {
  change_id: string;
  flow_id: string;
  file_path: string;
  branch_name: string;
  user_name: string;
  change_type: string;
  lines_added: number;
  lines_deleted: number;
  lines_modified: number;
  total_changed_lines: number;
  change_details?: string;
  created_at: string;
}

/**
 * Flow记录接口
 */
export interface FlowRecord {
  flow_id: string;
  user_name: string;
  project_name: string;
  branch_name: string;
  task_context?: string;
  last_commit_hash: string;
  duration_ms?: number;
  rate?: number;
  subtask_description?: string;
  route_info?: string;
  change_type: string;
  change_content?: string;
  flow_summary?: string;
  extend?: any;
  total_operations: number;
  accepted_operations: number;
  tool_calls?: any[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Commit统计数据接口
 */
export interface CommitStatistics {
  // 文件级统计
  totalFiles: number;
  includeAiCodeFiles: number;
  aiCodeFiles: number;
  fileAcceptanceRate: number;

  // 代码行级统计
  totalCodeLines: number;
  includeAiCodeLines: number;
  aiCodeLines: number;
  codeAcceptanceRate: number;

  // 其他信息
  lastCommitHash: string;
}

/**
 * Commit统计服务
 * 计算与AI代码采纳相关的统计数据
 */
export class CommitStatisticsService {
  /**
   * 通过SQL查询Flow记录
   * 根据last_commit_hash查询关联的Flow记录
   */
  private static async queryFlowsWithAcceptanceRate(
    lastCommitHash: string
  ): Promise<FlowRecord[]> {
    try {
      // 使用原生SQL查询modular_dev_flow_records表
      // 由于不能跨项目引用，我们直接使用SQL查询
      const [rows] = await sequelize.query(
        `
        SELECT * FROM modular_dev_flow_records 
        WHERE last_commit_hash = :lastCommitHash
        ORDER BY created_at DESC
        LIMIT 100
      `,
        {
          replacements: { lastCommitHash },
          type: QueryTypes.SELECT,
        }
      );
      console.log("🚀🚀🚀 ~ CommitStatisticsService ~ queryFlowsWithAcceptanceRate ~ rows=====>", rows)

      // 处理rows可能是单个对象或数组的情况
      if (!rows) {
        return [];
      }
      
      // 如果rows是数组，直接返回；如果是单个对象，包装成数组
      const flowRecords = Array.isArray(rows) ? rows : [rows];
      return flowRecords as FlowRecord[];
    } catch (error) {
      console.error("查询Flow记录失败:", error);
      return [];
    }
  }

  /**
   * 通过SQL查询文件变更记录
   * 根据flow_id查询关联的文件变更记录
   */
  private static async getFileChangesByFlowId(
    flowId: string
  ): Promise<FileChange[]> {
    try {
      // 使用原生SQL查询modular_dev_flow_file_changes表
      const [rows] = await sequelize.query(
        `
        SELECT * FROM modular_dev_flow_file_changes
        WHERE flow_id = :flowId
      `,
        {
          replacements: { flowId },
          type: QueryTypes.SELECT,
        }
      );

      // 处理rows可能是单个对象或数组的情况
      if (!rows) {
        return [];
      }
      
      // 如果rows是数组，直接返回；如果是单个对象，包装成数组
      const fileChanges = Array.isArray(rows) ? rows : [rows];
      return fileChanges as FileChange[];
    } catch (error) {
      console.error("查询文件变更记录失败:", error);
      return [];
    }
  }

  /**
   * 获取上一次提交的哈希值
   * @param currentHash 当前提交哈希
   * @returns 上一次提交的哈希值
   */
  public static async getPreviousCommitHash(
    currentHash: string,
    projectPath: string
  ): Promise<string> {
    try {
      console.log(
        `🚀🚀🚀 ~ CommitStatisticsService ~ getPreviousCommitHash ~ git repo path =====> ${projectPath}`
      );

      if (!projectPath) {
        console.error("无法找到有效的git仓库目录");
        return "";
      }

      // 使用git命令获取上一次提交的哈希值，确保在正确的git仓库目录中执行
      const { stdout } = await execPromise(`git rev-parse ${currentHash}^`, {
        cwd: projectPath, // 使用找到的git仓库目录
      });
      return stdout.trim();
    } catch (error) {
      console.error("获取上一次提交哈希失败:", error);
      return "";
    }
  }

  /**
   * 检查当前目录是否为git仓库
   */
  private static async isGitRepository(): Promise<boolean> {
    try {
      // 使用git rev-parse --git-dir命令检查是否为git仓库
      await execPromise("git rev-parse --git-dir");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 计算Commit的统计数据
   * @param commitHash 当前提交哈希
   * @param branchName 分支名称
   * @param filesChanged 变更的文件列表
   * @param codeLinesAdded 新增的代码行数
   * @param codeLinesDeleted 删除的代码行数
   * @returns Commit统计数据
   */
  public static async calculateCommitStatistics(
    commitHash: string,
    branchName: string,
    filesChanged: string[],
    codeLinesAdded: number,
    codeLinesDeleted: number,
    projectPath: string
  ): Promise<CommitStatistics> {
    try {
      console.log(
        `🔍 开始计算commit ${commitHash} 的统计数据...`
      );

      // 1. 尝试获取上一次提交的哈希值，如果失败则跳过这一步
      let lastCommitHash = "";
      try {
        lastCommitHash = await this.getPreviousCommitHash(
          commitHash,
          projectPath
        );
        console.log(
          `📄 上一次提交哈希: ${
            lastCommitHash ? lastCommitHash : "无"
          }`
        );
      } catch (error) {
        console.warn("获取上一次提交哈希失败，将继续执行其他逻辑:", error);
        return this.getDefaultStatistics(
          filesChanged,
          codeLinesAdded,
          codeLinesDeleted,
          ""
        );
      }

      if (!lastCommitHash) {
        // 如果无法获取上一次提交哈希，返回特殊值表示此阶段未执行AI出码
        return this.getDefaultStatistics(
          filesChanged,
          codeLinesAdded,
          codeLinesDeleted,
          ""
        );
      }
      if (!CommitManager.isInitializedCheck()) {
        await CommitManager.initialize();
      }
      // 2. 从Flow记录中查询与上次提交哈希相关的数据
      const flowRecords = await this.queryFlowsWithAcceptanceRate(
        lastCommitHash
      );
      console.log("🚀🚀🚀 ~ CommitStatisticsService ~ calculateCommitStatistics ~ flowRecords=====>", flowRecords)
      console.log(`📊 找到 ${flowRecords.length} 条相关Flow记录`);

      if (flowRecords.length === 0) {
        // 如果没有找到相关Flow记录，返回特殊值表示此阶段未执行AI出码
        return this.getDefaultStatistics(
          filesChanged,
          codeLinesAdded,
          codeLinesDeleted,
          lastCommitHash
        );
      }

      // 3. 获取这些Flow关联的文件变更记录
      const fileChanges: FileChange[] = [];
      for (const flow of flowRecords) {
        const changes = await this.getFileChangesByFlowId(flow.flow_id);
        fileChanges.push(...changes);
      }
      console.log(`📝 找到 ${fileChanges.length} 条文件变更记录`);

      if (fileChanges.length === 0) {
        // 如果没有找到文件变更记录，返回特殊值表示此阶段未执行AI出码
        return this.getDefaultStatistics(
          filesChanged,
          codeLinesAdded,
          codeLinesDeleted,
          lastCommitHash
        );
      }

      // 4. 计算文件级采纳率
      const fileStats = await this.calculateFileAcceptance(
        filesChanged,
        fileChanges
      );

      // 检查AI文件变更是否真的匹配到当前commit的文件
      // 如果aiCodeFiles > 0但includeAiCodeFiles = 0，表示AI有生成代码但全部未采纳
      // 如果aiCodeFiles = 0，则应该返回-1表示"无AI变更"
      if (fileStats.aiCodeFiles === 0) {
        // AI没有变更任何文件，使用-1特殊值表示"AI无变更"
        return this.getDefaultStatistics(
          filesChanged,
          codeLinesAdded,
          codeLinesDeleted,
          lastCommitHash
        );
      }

      // 5. 计算代码行级采纳率 - 使用优化版本
      const codeStats = await this.calculateCodeAcceptance(
        filesChanged,
        fileChanges,
        codeLinesAdded,
        codeLinesDeleted
      );

      // 6. 组合结果
      return {
        totalFiles: fileStats.totalFiles,
        includeAiCodeFiles: fileStats.includeAiCodeFiles,
        aiCodeFiles: fileStats.aiCodeFiles,
        fileAcceptanceRate: fileStats.fileAcceptanceRate,
        totalCodeLines: codeStats.totalCodeLines,
        includeAiCodeLines: codeStats.includeAiCodeLines,
        aiCodeLines: codeStats.aiCodeLines,
        codeAcceptanceRate: codeStats.codeAcceptanceRate,
        lastCommitHash,
      };
    } catch (error) {
      console.error("计算Commit统计数据失败:", error);

      // 返回特殊值表示计算失败
      return this.getDefaultStatistics(
        filesChanged,
        codeLinesAdded,
        codeLinesDeleted,
        ""
      );
    }
  }

  /**
   * 获取默认统计数据，使用-1表示特殊值
   */
  private static getDefaultStatistics(
    filesChanged: string[],
    codeLinesAdded: number,
    codeLinesDeleted: number,
    lastCommitHash: string
  ): CommitStatistics {
    return {
      totalFiles: filesChanged.length,
      includeAiCodeFiles: -1, // 特殊值表示此阶段未执行AI出码
      aiCodeFiles: -1, // 特殊值表示此阶段未执行AI出码
      fileAcceptanceRate: -1, // 特殊值表示此阶段未执行AI出码
      totalCodeLines: codeLinesAdded + codeLinesDeleted,
      includeAiCodeLines: -1, // 特殊值表示此阶段未执行AI出码
      aiCodeLines: -1, // 特殊值表示此阶段未执行AI出码
      codeAcceptanceRate: -1, // 特殊值表示此阶段未执行AI出码
      lastCommitHash: lastCommitHash || "",
    };
  }

  /**
   * 计算文件级采纳率
   */
  private static async calculateFileAcceptance(
    currentFiles: string[],
    fileChanges: FileChange[]
  ): Promise<{
    totalFiles: number;
    includeAiCodeFiles: number;
    aiCodeFiles: number;
    fileAcceptanceRate: number;
  }> {
    const totalFiles = currentFiles.length;
    let includeAiCodeFiles = 0;
    let aiCodeFiles = fileChanges.length;

    // 创建文件路径映射，方便查找
    const fileChangeMap = new Map<string, FileChange>();
    for (const change of fileChanges) {
      const normalizedPath = path.normalize(change.file_path);
      fileChangeMap.set(normalizedPath, change);
    }

    // 遍历当前commit的文件，检查是否存在于AI生成的文件变更记录中
    for (const filePath of currentFiles) {
      // 处理文件路径，以便进行比较
      const normalizedPath = path.normalize(filePath);

      // 查找精确匹配的文件
      if (fileChangeMap.has(normalizedPath)) {
        includeAiCodeFiles++;
        continue;
      }

      // 查找部分匹配的文件（路径结尾匹配）
      let found = false;
      for (const [changePath] of fileChangeMap.entries()) {
        if (normalizedPath.endsWith(changePath)) {
          includeAiCodeFiles++;
          found = true;
          break;
        }
      }

      // 如果没有找到匹配，可以尝试其他匹配方法
      if (!found) {
        // 例如文件名匹配
        const fileName = path.basename(normalizedPath);
        for (const [changePath] of fileChangeMap.entries()) {
          if (path.basename(changePath) === fileName) {
            includeAiCodeFiles++;
            break;
          }
        }
      }
    }

    // 计算文件级采纳率
    let fileAcceptanceRate = 0;

    // 只有当AI确实生成了代码文件(aiCodeFiles > 0)时，才计算采纳率
    // 否则使用0表示"AI有变更但全部未采纳"
    if (aiCodeFiles > 0) {
      if (totalFiles > 0) {
        fileAcceptanceRate = Number(
          ((includeAiCodeFiles * 100.0) / totalFiles).toFixed(2)
        );
      } else {
        fileAcceptanceRate = 0; // 当前commit没有变更文件，但AI有生成代码
      }
    }

    console.log(
      `📊 文件级统计: 总文件数=${totalFiles}, 包含AI代码的文件数=${includeAiCodeFiles}, AI变更总文件数=${aiCodeFiles}`
    );
    console.log(`📈 文件级采纳率: ${fileAcceptanceRate}%`);

    return {
      totalFiles,
      includeAiCodeFiles,
      aiCodeFiles,
      fileAcceptanceRate,
    };
  }

  /**
   * 计算代码行级采纳率
   * 使用change_details字段中的diff信息进行精确计算
   */
  private static async calculateCodeAcceptance(
    currentFiles: string[],
    fileChanges: FileChange[],
    codeLinesAdded: number,
    codeLinesDeleted: number
  ): Promise<{
    totalCodeLines: number;
    includeAiCodeLines: number;
    aiCodeLines: number;
    codeAcceptanceRate: number;
  }> {
    // 总代码行数 = 新增行数 + 删除行数
    const totalCodeLines = codeLinesAdded + codeLinesDeleted;

    // 初始化AI代码行计数
    let aiCodeLines = 0;
    let includeAiCodeLines = 0;

    // 创建文件路径映射，方便查找
    const fileChangeMap = new Map<string, FileChange[]>();
    for (const change of fileChanges) {
      const normalizedPath = path.normalize(change.file_path);
      if (!fileChangeMap.has(normalizedPath)) {
        fileChangeMap.set(normalizedPath, []);
      }
      fileChangeMap.get(normalizedPath)!.push(change);
    }

    // 遍历当前commit的文件，与AI生成的文件变更记录进行匹配
    for (const filePath of currentFiles) {
      // 处理文件路径，以便进行比较
      const normalizedPath = path.normalize(filePath);

      // 查找精确匹配或路径结尾匹配的文件变更记录
      let matchedChanges: FileChange[] = [];

      // 精确匹配
      if (fileChangeMap.has(normalizedPath)) {
        matchedChanges = fileChangeMap.get(normalizedPath)!;
      } else {
        // 路径结尾匹配
        for (const [changePath, changes] of fileChangeMap.entries()) {
          if (normalizedPath.endsWith(changePath)) {
            matchedChanges = changes;
            break;
          }
        }
      }

      // 如果找到匹配的文件变更记录
      for (const matchedChange of matchedChanges) {
        // 从change_details解析变更的行数信息
        if (matchedChange.change_details) {
          try {
            // 解析change_details中的diff信息
            const diffLines = this.parseDiffLines(matchedChange.change_details);

            // 累加AI生成的代码行数
            aiCodeLines += diffLines.added;

            // 如果文件在当前commit中，我们认为AI代码被采纳
            includeAiCodeLines += diffLines.added;
          } catch (error) {
            console.error(`解析文件 ${filePath} 的diff信息失败:`, error);

            // 使用备用方法计算
            aiCodeLines += matchedChange.lines_added || 0;
            includeAiCodeLines += matchedChange.lines_added || 0;
          }
        } else {
          // 如果没有change_details信息，使用lines_added等字段
          aiCodeLines += matchedChange.lines_added || 0;
          includeAiCodeLines += matchedChange.lines_added || 0;
        }
      }
    }

    // 如果没有找到AI代码变更记录，使用估算方法
    if (aiCodeLines === 0 && fileChanges.length > 0) {
      // 基于文件级变更统计估算
      aiCodeLines = fileChanges.reduce(
        (sum, change) =>
          sum + (change.lines_added || 0) + (change.lines_deleted || 0),
        0
      );

      // 简化为总代码行数的比例
      const fileRatio =
        currentFiles.length > 0
          ? Math.min(fileChanges.length / currentFiles.length, 1.0)
          : 0;

      includeAiCodeLines = Math.round(aiCodeLines * fileRatio);
    }

    // 确保数值合理
    aiCodeLines = Math.max(aiCodeLines, 0);
    includeAiCodeLines = Math.min(includeAiCodeLines, totalCodeLines);

    // 计算代码行级采纳率
    let codeAcceptanceRate = 0;

    // 只有当AI确实生成了代码行(aiCodeLines > 0)时，才计算采纳率
    // 否则使用0表示"AI有变更但全部未采纳"
    if (aiCodeLines > 0) {
      if (totalCodeLines > 0) {
        codeAcceptanceRate = Number(
          ((includeAiCodeLines * 100.0) / totalCodeLines).toFixed(2)
        );
      } else {
        codeAcceptanceRate = 0; // 当前commit没有代码行变更，但AI有生成代码
      }
    }

    console.log(
      `📊 代码行级统计: 总代码行数=${totalCodeLines}, 包含AI代码的行数=${includeAiCodeLines}, AI变更总代码行数=${aiCodeLines}`
    );
    console.log(`📈 代码行级采纳率: ${codeAcceptanceRate}%`);

    return {
      totalCodeLines,
      includeAiCodeLines,
      aiCodeLines,
      codeAcceptanceRate,
    };
  }

  /**
   * 解析diff信息，提取添加和删除的行数
   */
  private static parseDiffLines(diffContent: string): {
    added: number;
    deleted: number;
  } {
    if (!diffContent) return { added: 0, deleted: 0 };

    let addedLines = 0;
    let deletedLines = 0;

    // 按行分割diff内容
    const lines = diffContent.split("\n");

    // 遍历每一行，计算添加和删除的行数
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        addedLines++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletedLines++;
      }
    }

    return {
      added: addedLines,
      deleted: deletedLines,
    };
  }
}
