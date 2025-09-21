import path from "path";
import { execSync } from "child_process";
import { getWorkspaceChangedFiles } from "@xhs/shared-utils";

/**
 * 获取所有Git变更文件（不基于特定rootDir过滤）
 * @param gitRootDir git仓库根目录，默认为当前工作目录
 * @param commitHash 可选的commit hash
 * @returns 所有变更文件和删除文件
 */
export async function getAllGitChangedFiles(
  gitRootDir: string = process.cwd(),
  commitHash?: string
): Promise<{ changedFiles: string[]; deletedFiles: string[] }> {
  let gitRoot = "";
  
  try {
    gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      cwd: gitRootDir,
    }).trim();
  } catch (error) {
    console.log("警告: 指定目录不是 git 仓库");
    return { changedFiles: [], deletedFiles: [] };
  }

  let changedFiles: string[] = [];
  let deletedFiles: string[] = [];

  try {
    if (commitHash) {
      // 验证commit hash是否存在
      try {
        execSync(`git rev-parse --verify ${commitHash}`, {
          encoding: "utf-8",
          cwd: gitRoot,
          stdio: "pipe",
        });
      } catch (error) {
        console.log(`❌ 错误: commit hash '${commitHash}' 不存在`);
        return { changedFiles: [], deletedFiles: [] };
      }

      // 获取commit的修改、新增、重命名文件
      const changedOutput = execSync(
        `git diff-tree --diff-filter=ACMR --name-only --no-commit-id -r ${commitHash}`,
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      changedFiles = changedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 获取commit的删除文件
      const deletedOutput = execSync(
        `git diff-tree --diff-filter=D --name-only --no-commit-id -r ${commitHash}`,
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      deletedFiles = deletedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      console.log(`🔍 [纯净] Commit ${commitHash} 变更检测:`);
      console.log(`  - 变更文件: ${changedFiles.length} 个`);
      console.log(`  - 删除文件: ${deletedFiles.length} 个`);

    } else {
      // 获取已跟踪的变更文件
      const diffOutput = execSync("git diff --diff-filter=ACMR --name-only", {
        encoding: "utf-8",
        cwd: gitRoot,
      });
      const trackedFiles = diffOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 获取未跟踪的文件
      const untrackedOutput = execSync(
        "git ls-files --others --exclude-standard",
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      const untrackedFiles = untrackedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      changedFiles = [...trackedFiles, ...untrackedFiles];

      // 获取删除文件
      try {
        const deletedOutput = execSync("git diff --diff-filter=D --name-only", {
          encoding: "utf-8",
          cwd: gitRoot,
        });
        deletedFiles = deletedOutput
          .split("\n")
          .filter((file) => file.trim())
          .map((file) => path.resolve(gitRoot, file.trim()));
      } catch (error) {
        deletedFiles = [];
      }

      console.log(`🔍 [纯净] Git变更检测:`);
      console.log(`  - 变更文件: ${changedFiles.length} 个`);
      console.log(`  - 删除文件: ${deletedFiles.length} 个`);
    }

  } catch (error) {
    console.log("警告: 无法获取 git 变更文件");
    return { changedFiles: [], deletedFiles: [] };
  }

  return { changedFiles, deletedFiles };
}

// Git变更文件获取器
export class GitChangedFilesProvider {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async getGitChangedFiles(): Promise<string[]> {
    let gitRoot = "";
    let relativePath = "";

    try {
      gitRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf-8",
        cwd: this.rootDir,
      }).trim();
      const currentDir = this.rootDir;
      console.log("gitRoot", gitRoot);
      console.log("currentDir", currentDir);
      relativePath = path.relative(gitRoot, currentDir);
      console.log("relativePath", relativePath);
    } catch (error) {
      console.log("警告: 指定目录不是 git 仓库，将处理所有文件");
      return [];
    }

    let changedFiles: string[] = [];
    let allGitChangedFiles: string[] = [];

    try {
      // 获取已跟踪的变更文件（在git根目录执行）
      const diffOutput = execSync("git diff --diff-filter=ACMR --name-only", {
        encoding: "utf-8",
        cwd: gitRoot,
      });
      const trackedFiles = diffOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 获取未跟踪的文件（在git根目录执行）
      const untrackedOutput = execSync(
        "git ls-files --others --exclude-standard",
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      const untrackedFiles = untrackedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 保存所有变更文件（用于workspace包检测）
      allGitChangedFiles = [...trackedFiles, ...untrackedFiles];

      // 过滤当前目录下的文件
      changedFiles = allGitChangedFiles.filter(
        (file) =>
          !relativePath ||
          file.startsWith(path.resolve(gitRoot, relativePath) + path.sep) ||
          file === path.resolve(gitRoot, relativePath)
      );

      console.log(`🔍 Git变更检测:`);
      console.log(`  - 全部变更文件: ${allGitChangedFiles.length} 个`);
      console.log(`  - 当前目录变更: ${changedFiles.length} 个`);

      // 检测workspace包中的变更文件
      console.log(`\n🔗 检测workspace包变更...`);
      const workspaceChangedFiles = getWorkspaceChangedFiles(
        this.rootDir,
        allGitChangedFiles,
        {
          includeDevDependencies: true,
          includePeerDependencies: false,
          maxDepth: 3,
        }
      );

      if (workspaceChangedFiles.length > 0) {
        console.log(
          `📦 发现workspace包变更文件: ${workspaceChangedFiles.length} 个`
        );

        // 去重：只添加不在 changedFiles 中的 workspace 文件
        const uniqueWorkspaceFiles = workspaceChangedFiles.filter(
          (wsFile) =>
            !changedFiles.some(
              (existingFile) =>
                path.resolve(existingFile) === path.resolve(wsFile)
            )
        );

        if (uniqueWorkspaceFiles.length > 0) {
          console.log(
            `📦 添加 ${uniqueWorkspaceFiles.length} 个新的workspace变更文件`
          );
          changedFiles.push(...uniqueWorkspaceFiles);
        } else {
          console.log(`📦 workspace变更文件已在git变更列表中，无需重复添加`);
        }

        console.log(`📊 合并后总变更文件: ${changedFiles.length} 个`);
      } else {
        console.log(`📭 无workspace包变更`);
      }
    } catch (error) {
      console.log("警告: 无法获取 git 变更");
      return [];
    }

    return changedFiles;
  }

  getDeletedFiles(): string[] {
    let gitRoot = "";
    let relativePath = "";

    try {
      gitRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf-8",
        cwd: this.rootDir,
      }).trim();
      const currentDir = this.rootDir;
      relativePath = path.relative(gitRoot, currentDir);
    } catch (error) {
      return [];
    }

    try {
      const deletedOutput = execSync("git diff --diff-filter=D --name-only", {
        encoding: "utf-8",
        cwd: gitRoot,
      });
      return (
        deletedOutput
          .split("\n")
          .filter((file) => file.trim())
          // 只保留当前目录下的文件
          .filter(
            (file) =>
              !relativePath ||
              file.startsWith(relativePath + path.sep) ||
              file === relativePath
          )
          // 转换为绝对路径
          .map((file) => path.resolve(gitRoot, file.trim()))
      );
    } catch (error) {
      console.log("警告: 无法获取删除的文件列表");
      return [];
    }
  }

  /**
   * 获取指定commit的变更文件
   * @param commitHash commit哈希值
   * @returns 返回包含changedFiles和deletedFiles的对象
   */
  async getCommitChangedFiles(
    commitHash: string
  ): Promise<{ changedFiles: string[]; deletedFiles: string[] }> {
    let gitRoot = "";
    let relativePath = "";

    try {
      gitRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf-8",
        cwd: this.rootDir,
      }).trim();
      const currentDir = this.rootDir;
      relativePath = path.relative(gitRoot, currentDir);
      console.log("gitRoot", gitRoot);
      console.log("currentDir", currentDir);
      console.log("relativePath", relativePath);
    } catch (error) {
      console.log("警告: 指定目录不是 git 仓库");
      return { changedFiles: [], deletedFiles: [] };
    }

    let changedFiles: string[] = [];
    let deletedFiles: string[] = [];

    try {
      // 验证commit hash是否存在
      try {
        execSync(`git rev-parse --verify ${commitHash}`, {
          encoding: "utf-8",
          cwd: gitRoot,
          stdio: "pipe",
        });
      } catch (error) {
        console.log(`❌ 错误: commit hash '${commitHash}' 不存在`);
        return { changedFiles: [], deletedFiles: [] };
      }

      // 获取commit的修改、新增、重命名文件
      const changedOutput = execSync(
        `git diff-tree --diff-filter=ACMR --name-only --no-commit-id -r ${commitHash}`,
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      const allChangedFiles = changedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 获取commit的删除文件
      const deletedOutput = execSync(
        `git diff-tree --diff-filter=D --name-only --no-commit-id -r ${commitHash}`,
        {
          encoding: "utf-8",
          cwd: gitRoot,
        }
      );
      const allDeletedFiles = deletedOutput
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => path.resolve(gitRoot, file.trim()));

      // 过滤当前目录下的文件
      changedFiles = allChangedFiles.filter(
        (file) =>
          !relativePath ||
          file.startsWith(path.resolve(gitRoot, relativePath) + path.sep) ||
          file === path.resolve(gitRoot, relativePath)
      );

      deletedFiles = allDeletedFiles.filter(
        (file) =>
          !relativePath ||
          file.startsWith(path.resolve(gitRoot, relativePath) + path.sep) ||
          file === path.resolve(gitRoot, relativePath)
      );

      console.log(`🔍 Commit ${commitHash} 变更检测:`);
      console.log(`  - 全部变更文件: ${allChangedFiles.length} 个`);
      console.log(`  - 当前目录变更: ${changedFiles.length} 个`);
      console.log(`  - 全部删除文件: ${allDeletedFiles.length} 个`);
      console.log(`  - 当前目录删除: ${deletedFiles.length} 个`);

      // 检测workspace包中的变更文件（只对修改文件进行workspace检测）
      if (allChangedFiles.length > 0) {
        console.log(`\n🔗 检测workspace包变更...`);
        const workspaceChangedFiles = getWorkspaceChangedFiles(
          this.rootDir,
          allChangedFiles,
          {
            includeDevDependencies: true,
            includePeerDependencies: false,
            maxDepth: 3,
          }
        );

        if (workspaceChangedFiles.length > 0) {
          console.log(
            `📦 发现workspace包变更文件: ${workspaceChangedFiles.length} 个`
          );

          // 去重：只添加不在 changedFiles 中的 workspace 文件
          const uniqueWorkspaceFiles = workspaceChangedFiles.filter(
            (wsFile) =>
              !changedFiles.some(
                (existingFile) =>
                  path.resolve(existingFile) === path.resolve(wsFile)
              )
          );

          if (uniqueWorkspaceFiles.length > 0) {
            console.log(
              `📦 添加 ${uniqueWorkspaceFiles.length} 个新的workspace变更文件`
            );
            changedFiles.push(...uniqueWorkspaceFiles);
          } else {
            console.log(`📦 workspace变更文件已在变更列表中，无需重复添加`);
          }

          console.log(`📊 合并后总变更文件: ${changedFiles.length} 个`);
        } else {
          console.log(`📭 无workspace包变更`);
        }
      }
    } catch (error) {
      console.log(`警告: 无法获取commit ${commitHash} 的变更文件:`, error);
      return { changedFiles: [], deletedFiles: [] };
    }

    return { changedFiles, deletedFiles };
  }
}
