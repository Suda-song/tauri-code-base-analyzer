/**
 * Git操作工具类
 * 提供项目所需的基础Git操作功能
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ChangeRange } from "./entity-matcher";

const execAsync = promisify(exec);

export interface CommitOptions {
  mode: "auto" | "manual";
  saveToDb: boolean;
  amendDb: boolean;
}

export interface CommitResult {
  commitId?: string;
  commitMessage: string;
  dbRecordId?: string;
  mode: string;
}

export interface CommitFullInfo {
  hash: string;
  author: { email: string; name: string };
  info: { type: string; summary: string; fullMessage: string };
  diff: string;
  parsedDiff: {
    files: Record<
      string,
      {
        filePath: string;
        changeType: "added" | "modified" | "deleted" | "renamed";
        addedLines: number;
        deletedLines: number;
        diffContent: string; // 该文件的完整diff内容
      }
    >;
    summary: {
      totalFiles: number;
      totalAddedLines: number;
      totalDeletedLines: number;
    };
  };
  files: { modifiedFiles: string[]; deletedFiles: string[] };
  stats: { linesAdded: number; linesDeleted: number };
}

export interface DiffAnalysis {
  content: string;
  addedLines: string[];
  deletedLines: string[];
  addedComments: string[];
  changeRanges: Map<string, ChangeRange[]>;
}

/**
 * Git操作工具类
 */
export class GitUtils {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * 创建GitUtils实例的静态方法
   */
  static create(projectPath?: string): GitUtils {
    return new GitUtils(projectPath);
  }

  /**
   * 获取Git仓库的根目录
   */
  static async getGitRootPath(workingDir?: string): Promise<string> {
    try {
      const { stdout } = await execAsync("git rev-parse --show-toplevel", {
        cwd: workingDir || process.cwd(),
      });
      return stdout.trim();
    } catch (error) {
      throw new Error("无法获取Git根目录，请确保在Git仓库中运行");
    }
  }

  /**
   * 获取当前Git分支
   */
  static async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD");
      return stdout.trim();
    } catch (error) {
      throw new Error("无法获取当前Git分支，请确保在Git仓库中运行");
    }
  }

  /**
   * 检查当前目录是否为Git仓库
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync("git rev-parse --git-dir", { cwd: this.projectPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取基础Git信息
   */
  async getBasicInfo(): Promise<{
    branch: string;
    currentHash: string;
    isRepo: boolean;
  }> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      return { branch: "unknown", currentHash: "", isRepo: false };
    }

    try {
      const [branchResult, hashResult] = await Promise.all([
        execAsync("git rev-parse --abbrev-ref HEAD", { cwd: this.projectPath }),
        execAsync("git rev-parse HEAD", { cwd: this.projectPath }),
      ]);

      return {
        branch: branchResult.stdout.trim(),
        currentHash: hashResult.stdout.trim(),
        isRepo: true,
      };
    } catch (error) {
      return { branch: "unknown", currentHash: "", isRepo: true };
    }
  }

  /**
   * 获取暂存区文件和diff内容
   */
  async getStagedInfo(): Promise<{
    files: string[];
    diffContent: string;
  }> {
    try {
      const allFiles = await this.getFilesList("git diff --cached --name-only");
      const filteredFiles = this.filterSupportedFiles(allFiles);

      console.log(
        `🔍 暂存区总文件数: ${allFiles.length}, 需处理文件数: ${filteredFiles.length}`
      );

      if (filteredFiles.length === 0) {
        return { files: [], diffContent: "" };
      }

      const diffContent = await this.getBatchDiffContent(
        filteredFiles,
        "git diff --cached"
      );
      return { files: filteredFiles, diffContent };
    } catch (error) {
      console.warn("获取暂存区信息失败", error);
      return { files: [], diffContent: "" };
    }
  }

  /**
   * 过滤出支持的文件类型（公开方法）
   */
  filterSupportedFiles(files: string[]): string[] {
    const frontendExtensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".vue",
      ".html",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".json",
      ".md",
    ];

    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.nyc_output/,
      /\.vscode/,
      /\.idea/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /\.tsbuildinfo$/,
      /\.min\.(js|css)$/,
      /\.map$/,
    ];

    return files.filter((file) => {
      if (ignoredPatterns.some((pattern) => pattern.test(file))) {
        return false;
      }

      const hasValidExtension = frontendExtensions.some((ext) =>
        file.toLowerCase().endsWith(ext)
      );

      const fileName = file.split("/").pop() || "";
      const isConfigFile = [
        "package.json",
        "tsconfig.json",
        "vite.config.js",
        "vite.config.ts",
        "webpack.config.js",
        "vue.config.js",
        "nuxt.config.js",
        ".eslintrc.js",
        ".eslintrc.json",
        "prettier.config.js",
        "tailwind.config.js",
        "postcss.config.js",
      ].includes(fileName);

      return hasValidExtension || isConfigFile;
    });
  }

  /**
   * 获取文件列表的通用方法
   */
  private async getFilesList(command: string): Promise<string[]> {
    const result = await execAsync(command, { cwd: this.projectPath });
    return result.stdout
      .trim()
      .split("\n")
      .filter((file) => file.length > 0);
  }

  /**
   * 分批获取diff内容的通用方法
   */
  private async getBatchDiffContent(
    files: string[],
    baseCommand: string,
    batchSize: number = 20
  ): Promise<string> {
    if (files.length === 0) return "";

    const diffContents: string[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      try {
        const command = `${baseCommand} -- ${batch
          .map((f) => `"${f}"`)
          .join(" ")}`;
        const result = await execAsync(command, { cwd: this.projectPath });
        diffContents.push(result.stdout);
      } catch (batchError) {
        console.warn(`处理文件批次失败: ${batch.join(", ")}`, batchError);
      }
    }

    return diffContents.join("\n");
  }

  /**
   * 获取指定提交的完整信息
   */
  async getCommitFullInfo(commitHash?: string): Promise<CommitFullInfo> {
    const hash = commitHash || "HEAD";

    try {
      // 先获取基本信息和文件列表
      const [authorResult, messageResult, filesResult] = await Promise.all([
        execAsync(`git show --format="%ae|%an" --no-patch ${hash}`, {
          cwd: this.projectPath,
        }),
        execAsync(`git show --format="%B" --no-patch ${hash}`, {
          cwd: this.projectPath,
        }),
        execAsync(`git show --name-status --format="" ${hash}`, {
          cwd: this.projectPath,
        }),
      ]);

      const [email, name] = authorResult.stdout.trim().split("|");
      const author = { email: email || "", name: name || "" };

      const fullMessage = messageResult.stdout.trim();
      const { type, summary } = this.parseCommitMessage(fullMessage);
      const info = { type, summary, fullMessage };

      const files = this.parseFileChanges(filesResult.stdout);

      // 获取需要处理的文件列表
      const allChangedFiles = [...files.modifiedFiles, ...files.deletedFiles];
      const filteredFiles = this.filterSupportedFiles(allChangedFiles);

      console.log(
        `📊 commit ${hash.substring(0, 7)}: 总文件数 ${
          allChangedFiles.length
        }, 需处理 ${filteredFiles.length}`
      );

      const diffContent = await this.getBatchDiffContent(
        filteredFiles,
        `git show ${hash}`,
        15
      );

      // 计算统计信息
      const { addedLines, deletedLines } = this.extractDiffLines(diffContent);
      const stats = {
        linesAdded: addedLines.length,
        linesDeleted: deletedLines.length,
      };

      // 解析结构化的diff信息
      const parsedDiff = this.parseDiffByFiles(diffContent, true);

      return {
        hash,
        author,
        info,
        diff: diffContent,
        parsedDiff, // 新增结构化diff
        files,
        stats,
      };
    } catch (error) {
      console.warn(`获取提交完整信息失败: ${error}`);
      return {
        hash,
        author: { email: "", name: "" },
        info: { type: "chore", summary: "代码更新", fullMessage: "" },
        diff: "",
        parsedDiff: {
          files: {},
          summary: { totalFiles: 0, totalAddedLines: 0, totalDeletedLines: 0 },
        },
        files: { modifiedFiles: [], deletedFiles: [] },
        stats: { linesAdded: 0, linesDeleted: 0 },
      };
    }
  }

  /**
   * 从diff内容中提取新增和删除的代码行
   */
  extractDiffLines(diffContent: string): {
    addedLines: string[];
    deletedLines: string[];
  } {
    const addedLines: string[] = [];
    const deletedLines: string[] = [];
    const lines = diffContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        addedLines.push(line.substring(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletedLines.push(line.substring(1));
      }
    }

    return { addedLines, deletedLines };
  }

  /**
   * 从diff内容中提取新增的注释行
   */
  extractAddedComments(diffContent: string): string[] {
    const comments: string[] = [];
    const lines = diffContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("+")) {
        const content = line.substring(1).trim();
        if (this.isCommentLine(content)) {
          comments.push(content);
        }
      }
    }

    return comments;
  }

  /**
   * 统一的数据和文件提交方法
   * @param mode 提交模式：amend（追加到当前提交）或 separate（创建独立提交）
   * @param targetCommitHash 目标提交哈希（用于amend模式验证）
   * @param commitMessage 提交消息
   * @param filesToAdd 要添加的文件列表，如果为空则使用默认的data/目录
   */
  async commitDataChanges(
    mode: "amend" | "separate" = "separate",
    targetCommitHash?: string,
    commitMessage?: string,
    filesToAdd?: string[]
  ): Promise<void> {
    try {
      // 如果没有指定文件列表，使用默认的data/目录
      const defaultFiles = ["data/"];
      const targetFiles =
        filesToAdd && filesToAdd.length > 0 ? filesToAdd : defaultFiles;

      // 检查是否有变更
      let hasChanges = false;
      for (const file of targetFiles) {
        try {
          const { stdout } = await execAsync(`git status --porcelain ${file}`, {
            cwd: this.projectPath,
          });
          if (stdout.trim().length > 0) {
            hasChanges = true;
            break;
          }
        } catch (error) {
          console.warn(`⚠️ 检查文件 ${file} 状态失败:`, error);
        }
      }

      if (!hasChanges) {
        console.log("💡 目标文件没有变更，跳过提交");
        return;
      }

      // 添加所有目标文件
      for (const file of targetFiles) {
        await execAsync(`git add ${file}`, { cwd: this.projectPath });
      }

      console.log(
        `📋 已添加 ${targetFiles.length} 个文件/目录到暂存区:`,
        targetFiles
      );

      if (mode === "amend") {
        console.log("📝 正在将文件变更追加到提交...");

        if (targetCommitHash) {
          const { currentHash } = await this.getBasicInfo();
          if (currentHash !== targetCommitHash) {
            console.warn(
              `⚠️ 当前HEAD (${currentHash.substring(
                0,
                7
              )}) 不是目标提交 (${targetCommitHash.substring(0, 7)})`
            );
            console.warn("💡 为了安全起见，将创建独立的数据提交");
            mode = "separate";
          }
        }

        if (mode === "amend") {
          await execAsync("git commit --amend --no-edit --no-verify", {
            cwd: this.projectPath,
          });
          console.log("✅ 文件变更已成功追加到提交");
          return;
        }
      }

      console.log("📝 正在为文件变更创建独立提交...");
      const finalCommitMessage =
        commitMessage ||
        "chore: update data and files, executed by post-commit hook";
      await execAsync(`git commit -m "${finalCommitMessage}" --no-verify`, {
        cwd: this.projectPath,
      });
      console.log("✅ 文件变更已创建独立提交");
    } catch (error) {
      console.warn("⚠️ 文件提交失败:", error);
      console.warn("💡 文件变更仍已保存，但未添加到Git提交中");
    }
  }

  /**
   * 获取当前分支最近N个commit的简要信息
   * 用于AI生成commit时参考历史风格
   */
  async getRecentCommits(
    count: number = 5,
    skipMergeCommits: boolean = true
  ): Promise<
    {
      hash: string;
      type: string;
      summary: string;
      fullMessage: string;
      author: string;
      date: string;
    }[]
  > {
    try {
      // 构建git log命令，获取最近的commit
      let command = `git log --oneline --format="%H|%an|%ad|%s" --date=short -${count}`;

      if (skipMergeCommits) {
        command += " --no-merges";
      }

      const { stdout } = await execAsync(command, { cwd: this.projectPath });

      if (!stdout.trim()) {
        return [];
      }

      const commits = [];
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        const [hash, author, date, message] = line.split("|");

        if (hash && message) {
          const { type, summary } = this.parseCommitMessage(message);

          commits.push({
            hash: hash.trim(),
            type,
            summary,
            fullMessage: message.trim(),
            author: author?.trim() || "",
            date: date?.trim() || "",
          });
        }
      }

      return commits;
    } catch (error) {
      console.warn("获取最近提交历史失败:", error);
      return [];
    }
  }

  /**
   * 获取文件的变更行号范围
   */
  async getFileChangeRanges(
    staged: boolean = true,
    commitHash?: string
  ): Promise<Map<string, ChangeRange[]>> {
    try {
      const filesCommand = this.buildFilesCommand(staged, commitHash);
      const allFiles = await this.getFilesList(filesCommand);
      const filteredFiles = this.filterSupportedFiles(allFiles);

      if (filteredFiles.length === 0) {
        return new Map();
      }

      return await this.getBatchChangeRanges(filteredFiles, staged, commitHash);
    } catch (error) {
      console.warn("获取文件变更范围失败:", error);
      return new Map();
    }
  }

  /**
   * 获取文件列表的命令
   */
  private buildFilesCommand(staged: boolean, commitHash?: string): string {
    if (commitHash) {
      return `git show --name-only --format="" ${commitHash}`;
    }
    return staged ? "git diff --cached --name-only" : "git diff --name-only";
  }

  /**
   * 分批获取文件变更范围
   */
  private async getBatchChangeRanges(
    files: string[],
    staged: boolean,
    commitHash?: string,
    batchSize: number = 20
  ): Promise<Map<string, ChangeRange[]>> {
    const allRanges = new Map<string, ChangeRange[]>();

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const command = this.buildDiffCommand(batch, staged, commitHash);

      try {
        const { stdout } = await execAsync(command, { cwd: this.projectPath });
        const batchRanges = this.parseDiffOutput(stdout);

        // 合并到总的范围Map中
        for (const [file, ranges] of batchRanges.entries()) {
          allRanges.set(file, ranges);
        }
      } catch (batchError) {
        console.warn(
          `获取文件变更范围失败 (批次: ${batch.join(", ")})`,
          batchError
        );
      }
    }

    return allRanges;
  }

  /**
   * 构建diff命令
   */
  private buildDiffCommand(
    batch: string[],
    staged: boolean,
    commitHash?: string
  ): string {
    const fileArgs = batch.map((f) => `"${f}"`).join(" ");

    if (commitHash) {
      return `git show ${commitHash} -U0 --format="" -- ${fileArgs}`;
    }

    const diffType = staged ? "--cached" : "";
    return `git diff ${diffType} -U0 -- ${fileArgs}`;
  }

  /**
   * 解析提交消息，提取类型和描述
   */
  private parseCommitMessage(commitMessage: string): {
    type: string;
    summary: string;
  } {
    // 分割commit message为行
    const lines = commitMessage
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return {
        type: "chore",
        summary: "代码更新",
      };
    }

    const firstLine = lines[0];

    // 尝试匹配conventional commits格式
    const conventionalPattern = /^(\w+)(?:\([^)]+\))?\s*:\s*(.+)$/;
    const match = firstLine.match(conventionalPattern);

    if (match) {
      // 如果是conventional格式，提取summary（可能包含多行）
      let summary = match[2].trim();

      // 如果有后续行且不是空行，将其作为summary的一部分
      if (lines.length > 1) {
        const additionalLines = lines
          .slice(1)
          .filter((line) => line.length > 0 && !line.startsWith("#")) // 过滤空行和注释
          .slice(0, 2); // 最多取前2行作为summary的补充

        if (additionalLines.length > 0) {
          summary += " " + additionalLines.join(" ");
        }
      }

      return {
        type: match[1].toLowerCase(),
        summary: summary,
      };
    }

    return {
      type: "chore",
      summary: "代码更新",
    };
  }

  /**
   * 解析文件变更状态
   */
  private parseFileChanges(output: string): {
    modifiedFiles: string[];
    deletedFiles: string[];
  } {
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    const lines = output
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const [status, filepath] = line.split("\t");

      if (status === "D") {
        deletedFiles.push(filepath);
      } else if (status === "A" || status === "M" || status.startsWith("R")) {
        if (status.startsWith("R")) {
          const parts = line.split("\t");
          if (parts.length >= 3) {
            modifiedFiles.push(parts[2]);
          }
        } else {
          modifiedFiles.push(filepath);
        }
      }
    }

    return { modifiedFiles, deletedFiles };
  }

  /**
   * 解析diff输出，提取变更行号范围
   */
  private parseDiffOutput(diffOutput: string): Map<string, ChangeRange[]> {
    const fileRanges = new Map<string, ChangeRange[]>();
    const lines = diffOutput.split("\n");
    let currentFile = "";

    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match) {
          currentFile = match[2];
          if (!fileRanges.has(currentFile)) {
            fileRanges.set(currentFile, []);
          }
        }
      }

      if (line.startsWith("@@") && currentFile) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          const newStart = parseInt(match[3]);
          const newCount = parseInt(match[4] || "1");
          const oldStart = parseInt(match[1]);
          const oldCount = parseInt(match[2] || "1");

          const ranges = fileRanges.get(currentFile) || [];

          if (newCount > 0) {
            ranges.push({
              start: newStart,
              end: newStart + newCount - 1,
              type: "added",
            });
          }

          if (oldCount > 0) {
            ranges.push({
              start: oldStart,
              end: oldStart + oldCount - 1,
              type: "deleted",
            });
          }

          fileRanges.set(currentFile, ranges);
        }
      }
    }

    return fileRanges;
  }

  /**
   * 解析diff内容，按文件分组并提取详细变更信息
   */
  parseDiffByFiles(
    diffContent: string,
    filterFiles: boolean = true
  ): {
    files: Record<
      string,
      {
        filePath: string;
        changeType: "added" | "modified" | "deleted" | "renamed";
        addedLines: number;
        deletedLines: number;
        diffContent: string; // 该文件的完整diff内容
      }
    >;
    summary: {
      totalFiles: number;
      totalAddedLines: number;
      totalDeletedLines: number;
    };
  } {
    const result = {
      files: {} as Record<string, any>,
      summary: {
        totalFiles: 0,
        totalAddedLines: 0,
        totalDeletedLines: 0,
      },
    };

    if (!diffContent || diffContent.trim() === "") {
      return result;
    }

    const lines = diffContent.split("\n");
    let currentFile = "";
    let currentFileDiff = "";
    let currentFileInfo: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测文件头
      if (line.startsWith("diff --git")) {
        // 保存上一个文件的信息
        if (currentFile && currentFileInfo) {
          // 只保存通过过滤的文件
          if (
            !filterFiles ||
            this.filterSupportedFiles([currentFile]).length > 0
          ) {
            currentFileInfo.diffContent = currentFileDiff.trim();
            result.files[currentFile] = currentFileInfo;
            result.summary.totalFiles++;
          }
        }

        // 解析文件路径
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match) {
          currentFile = match[2];

          // 检查文件是否需要处理
          const shouldProcessFile =
            !filterFiles || this.filterSupportedFiles([currentFile]).length > 0;

          if (shouldProcessFile) {
            currentFileDiff = line + "\n";
            currentFileInfo = {
              filePath: currentFile,
              changeType: "modified" as const,
              addedLines: 0,
              deletedLines: 0,
              diffContent: "",
            };
          } else {
            // 跳过不需要处理的文件
            currentFile = "";
            currentFileDiff = "";
            currentFileInfo = null;
          }
        }
        continue;
      }

      // 只处理需要处理的文件
      if (!currentFile || !currentFileInfo) {
        continue;
      }

      // 添加到当前文件的diff内容
      currentFileDiff += line + "\n";

      // 检测文件模式变更
      if (line.startsWith("new file mode")) {
        currentFileInfo.changeType = "added";
        continue;
      }
      if (line.startsWith("deleted file mode")) {
        currentFileInfo.changeType = "deleted";
        continue;
      }
      if (line.startsWith("rename from")) {
        currentFileInfo.changeType = "renamed";
        continue;
      }

      // 统计变更行数（简单统计）
      if (line.startsWith("+") && !line.startsWith("+++")) {
        currentFileInfo.addedLines++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        currentFileInfo.deletedLines++;
      }
    }

    // 保存最后一个文件的信息
    if (currentFile && currentFileInfo) {
      // 只保存通过过滤的文件
      if (!filterFiles || this.filterSupportedFiles([currentFile]).length > 0) {
        currentFileInfo.diffContent = currentFileDiff.trim();
        result.files[currentFile] = currentFileInfo;
        result.summary.totalFiles++;
      }
    }

    // 计算总体统计
    Object.values(result.files).forEach((fileInfo: any) => {
      result.summary.totalAddedLines += fileInfo.addedLines;
      result.summary.totalDeletedLines += fileInfo.deletedLines;
    });

    return result;
  }

  /**
   * 判断代码行是否为注释
   */
  private isCommentLine(line: string): boolean {
    const trimmed = line.trim();

    return (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("<!--") ||
      trimmed.includes("<!-- ")
    );
  }
}
