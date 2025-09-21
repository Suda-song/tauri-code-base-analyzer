/**
 * branch-info.ts
 * Git分支信息处理模块
 * 
 * 本模块负责处理与Git分支相关的信息，包括：
 * - 获取当前分支信息
 * - 获取分支变更的文件列表
 * - 获取分支的提交历史
 * - 处理合并提交的场景
 * 
 * 特别地，本模块增加了对MR合并后执行的场景支持：
 * 当在主分支(如master)上运行，并且刚刚合并了一个MR时，
 * 可以自动识别合并提交，提取原开发分支信息，
 * 从而能够正确计算合并前的开发分支与主分支的代码差异。
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BranchInfo } from '../models/interfaces';

// 将exec转换为Promise
const execPromise = promisify(exec);

/**
 * Git分支信息服务
 * 用于获取和处理Git分支相关的信息
 */
export class BranchInfoService {
  private projectPath: string;
  private defaultTargetBranch: string;
  private isPodMode: boolean;

  /**
   * 构造函数
   * @param projectPath 项目根路径
   * @param defaultTargetBranch 默认目标分支
   * @param isPodMode 是否为容器环境模式
   */
  constructor(projectPath: string = process.cwd(), defaultTargetBranch: string = 'master', isPodMode: boolean = false) {
    this.projectPath = projectPath;
    this.defaultTargetBranch = defaultTargetBranch;
    this.isPodMode = isPodMode;
  }

  /**
   * 为容器环境解析分支引用
   * @param branchName 分支名称
   * @returns 解析后的分支引用
   */
  private resolveBranchForPod(branchName: string): string {
    // 如果已经是远程分支引用，直接返回
    if (branchName.startsWith('origin/')) {
      return branchName;
    }
    // 容器环境下将本地分支名转换为远程分支引用
    return `origin/${branchName}`;
  }

  /**
   * 获取当前分支信息
   * @param targetBranch 目标分支名称（默认为master）
   */
  public async getCurrentBranchInfo(targetBranch?: string): Promise<BranchInfo> {
    const target = targetBranch || this.defaultTargetBranch;
    
    try {
      // 获取当前分支
      const { stdout: currentBranchOutput } = await execPromise('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
      });
      const currentBranch = currentBranchOutput.trim();
      
      // 检查是否是合并后的主分支场景
      if (currentBranch === target) {
        // 尝试获取最近的合并提交信息
        const mergeInfo = await this.getLatestMergeCommitInfo();
        if (mergeInfo) {
          // 如果找到合并提交，获取原始分支信息
          const mergedBranchInfo = await this.getMergeCommitBranchInfo(
            mergeInfo.mergeCommitHash,
            mergeInfo.sourceBranchName
          );
          if (mergedBranchInfo) {
            console.log(`检测到合并后场景，使用原始分支信息: ${mergedBranchInfo.currentBranch} -> ${mergedBranchInfo.targetBranch}`);
            return mergedBranchInfo;
          }
        }
      }
      
      // 允许在相同分支上计算统计
      console.log(`当前分支: ${currentBranch}, 目标分支: ${target}${currentBranch === target ? ' (相同分支)' : ''}`);
      
      // 获取当前分支最新提交
      const { stdout: latestShaOutput } = await execPromise('git rev-parse HEAD', {
        cwd: this.projectPath,
      });
      const latestSha = latestShaOutput.trim();
      
      // 获取与目标分支的共同祖先
      let baseSha;
      
      if (currentBranch === target) {
        // 同一分支情况下，还需要获取一个基准点
        // 默认使用当前分支的最新提交的父提交作为基准点
        try {
          // 尝试获取当前提交的父提交
          const { stdout: parentOutput } = await execPromise('git rev-parse HEAD^', {
            cwd: this.projectPath,
          });
          baseSha = parentOutput.trim();
          console.log(`同分支计算: 使用当前提交的父提交 ${baseSha} 作为基准点`);
        } catch (error) {
          // 如果无法获取父提交（如仅有一个提交）
          // 使用空提交作为基准点
          const { stdout: emptyTreeOutput } = await execPromise('git hash-object -t tree /dev/null', {
            cwd: this.projectPath,
          });
          baseSha = emptyTreeOutput.trim();
          console.log(`同分支计算: 使用空提交 ${baseSha} 作为基准点`);
        }
      } else {
        // 正常情况下获取共同祖先
        const targetRef = this.isPodMode ? this.resolveBranchForPod(target) : target;
        const currentRef = this.isPodMode ? this.resolveBranchForPod(currentBranch) : currentBranch;
        const { stdout: baseShaOutput } = await execPromise(`git merge-base ${currentRef} ${targetRef}`, {
          cwd: this.projectPath,
        });
        baseSha = baseShaOutput.trim();
      }
      
      // 检查是否已合并
      const isMerged = await this.isBranchMerged(currentBranch, target);
      
      // 如果已合并，获取合并基点
      let mergeBaseSha: string | undefined;
      if (isMerged) {
        try {
          // 尝试找到合并提交
          const { stdout: mergeCommitOutput } = await execPromise(
            `git log --grep="Merge branch '${currentBranch}'" ${target} -n 1 --format="%H"`,
            { cwd: this.projectPath }
          );
          mergeBaseSha = mergeCommitOutput.trim() || undefined;
        } catch (error) {
          console.warn(`无法找到分支 ${currentBranch} 的合并提交`);
        }
      }
      
      return {
        currentBranch,
        targetBranch: target,
        baseSha, // 移除固定的哈希值，使用实际计算的值
        latestSha,
        isMerged,
        mergeBaseSha
      };
    } catch (error) {
      console.error('获取分支信息失败:', error);
      throw new Error(`获取Git分支信息失败: ${error}`);
    }
  }

  /**
   * 检查分支是否已合并到目标分支
   * @param branch 分支名称
   * @param targetBranch 目标分支名称
   */
  public async isBranchMerged(branch: string, targetBranch: string): Promise<boolean> {
    try {
      // 根据模式决定分支引用
      const targetRef = this.isPodMode ? this.resolveBranchForPod(targetBranch) : targetBranch;
      const branchRef = this.isPodMode ? this.resolveBranchForPod(branch) : branch;
      
      // 在容器模式下，跳过fetch操作，因为远程分支应该已经可用
      if (!this.isPodMode) {
        // 确保目标分支存在并更新
        await execPromise(`git fetch origin ${targetBranch}:${targetBranch}`, {
          cwd: this.projectPath,
        });
      }
      
      // 检查分支是否已合并
      const { stdout } = await execPromise(
        `git branch --merged ${targetRef} | grep -E "\\s${branchRef}$"`,
        { cwd: this.projectPath }
      );
      
      return stdout.trim().length > 0;
    } catch (error) {
      // grep 没有找到匹配项会返回非零状态码，这种情况表示分支未合并
      return false;
    }
  }

  /**
   * 获取最近的合并提交信息
   * 主要用于在合并后的主分支上分析MR统计数据
   * @returns 合并提交信息，包含原始分支名称
   */
  public async getLatestMergeCommitInfo(): Promise<{mergeCommitHash: string, sourceBranchName: string} | null> {
    try {
      // 获取最新的合并提交
      const { stdout } = await execPromise(
        'git log -1 --merges --oneline',
        { cwd: this.projectPath }
      );

      if (!stdout.trim()) {
        console.log('未找到合并提交');
        return null;
      }

      // 解析合并提交信息
      // 格式通常为: "a1b2c3d Merge branch 'feature-branch' into 'master'"
      // 或者: "a1b2c3d Merge pull request #123 from org/feature-branch"
      const mergeCommitHash = stdout.split(' ')[0].trim();
      
      // 尝试多种格式匹配源分支名称
      let branchMatch = stdout.match(/Merge branch ['']([^'']*)['']/) ||  // 带引号的分支名
                       stdout.match(/Merge branch ([^\s]+) into/) ||      // 不带引号的分支名
                       stdout.match(/Merge pull request #\d+ from \S+\/([^\/\s]+)/);
                       
      console.log(`解析合并提交信息: ${stdout}`);
      console.log(`匹配结果: ${branchMatch?.[1] || '未匹配'}`);      
      if (!branchMatch || !branchMatch[1]) {
        console.log('无法从合并提交中提取源分支名称');
        return null;
      }

      const sourceBranchName = branchMatch[1].trim();
      console.log(`找到合并提交: ${mergeCommitHash}, 源分支: ${sourceBranchName}`);
      
      return {
        mergeCommitHash,
        sourceBranchName
      };
    } catch (error) {
      console.error('获取合并提交信息失败:', error);
      return null;
    }
  }
  
  /**
   * 获取合并提交的原始分支信息
   * @param mergeCommitHash 合并提交哈希
   * @param sourceBranchName 源分支名称
   * @returns 原始分支信息
   */
  public async getMergeCommitBranchInfo(mergeCommitHash: string, sourceBranchName: string): Promise<BranchInfo | null> {
    try {
      console.log(`🔍 分析合并提交: ${mergeCommitHash}, 源分支: ${sourceBranchName}`);
      
      // 1. 获取当前分支(应该是目标分支，如master)
      const { stdout: currentBranchOutput } = await execPromise('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
      });
      const currentBranch = currentBranchOutput.trim();
      console.log(`📌 当前分支(目标分支): ${currentBranch}`);
      
      // 2. 获取合并提交的父提交
      // 合并提交通常有两个父提交: 父提交1是目标分支(如master)，父提交2是源分支(如feature分支)
      const { stdout: parentCommitsOutput } = await execPromise(`git rev-parse ${mergeCommitHash}^1 ${mergeCommitHash}^2`, {
        cwd: this.projectPath,
      });
      
      const parents = parentCommitsOutput.trim().split('\n');
      if (parents.length < 2) {
        console.error('⚠️ 合并提交没有两个父提交，可能不是真正的合并提交');
        return null;
      }
      
      // 父提交1是目标分支的提交，父提交2是源分支的提交
      const targetBranchCommit = parents[0].trim();
      const sourceBranchCommit = parents[1].trim();
      console.log(`📄 目标分支提交: ${targetBranchCommit}`);
      console.log(`📄 源分支提交: ${sourceBranchCommit}`);
      
      // 3. 构建分支信息
      const branchInfo: BranchInfo = {
        currentBranch: sourceBranchName, // 使用提取的源分支名称
        targetBranch: currentBranch,    // 当前分支就是目标分支(通常是master)
        baseSha: targetBranchCommit,    // 目标分支的父提交作为基础SHA
        latestSha: sourceBranchCommit,  // 源分支的父提交作为最新SHA
        isMerged: true,                 // 已经合并
        mergeBaseSha: mergeCommitHash   // 合并提交哈希
      };
      
      console.log(`✅ 已构建合并提交的分支信息`);
      console.log(`📋 分支信息详情: ${branchInfo.currentBranch} -> ${branchInfo.targetBranch}`);
      console.log(`📊 baseSha: ${branchInfo.baseSha.substring(0, 8)}...`);
      console.log(`📊 latestSha: ${branchInfo.latestSha.substring(0, 8)}...`);
      
      return branchInfo;
    } catch (error) {
      console.error('获取合并提交的分支信息失败:', error);
      return null;
    }
  }

  /**
   * 获取分支的所有变更文件
   * @param baseSha 基础提交哈希
   * @param headSha 头部提交哈希
   */
  public async getBranchChangedFiles(baseSha: string, headSha: string): Promise<string[]> {
    try {
      // 获取两个提交之间的变更文件列表
      const { stdout } = await execPromise(`git diff --name-only ${baseSha}...${headSha}`, {
        cwd: this.projectPath,
      });
      console.log("🚀🚀🚀 ~ BranchInfoService ~ getBranchChangedFiles ~ `git diff --name-only ${baseSha}...${headSha}`=====>", `git diff --name-only ${baseSha}...${headSha}`)
      
      const files = stdout.trim().split('\n').filter(Boolean);
      console.log("🚀🚀🚀 ~ BranchInfoService ~ getBranchChangedFiles ~ files=====>", files)
      return files;
    } catch (error) {
      console.error('获取分支变更文件失败:', error);
      return [];
    }
  }

  /**
   * 获取分支的所有提交
   * @param baseSha 基础提交哈希
   * @param headSha 头部提交哈希
   */
  public async getBranchCommits(baseSha: string, headSha: string): Promise<Array<{hash: string, summary: string, timestamp: Date}>> {
    try {
      // 获取两个提交之间的所有提交
      const { stdout } = await execPromise(
        `git log --pretty=format:"%H|%s|%at" ${baseSha}..${headSha}`,
        { cwd: this.projectPath }
      );
      
      if (!stdout.trim()) {
        return [];
      }
      
      // 解析提交信息
      return stdout.trim().split('\n').map(line => {
        const [hash, summary, timestamp] = line.split('|');
        return {
          hash,
          summary,
          timestamp: new Date(parseInt(timestamp) * 1000) // 将Unix时间戳转换为Date对象
        };
      });
    } catch (error) {
      console.error('获取分支提交历史失败:', error);
      return [];
    }
  }

  /**
   * 从Git信息中解析应用名
   * 优先级：package.json name字段 > git remote origin URL > 项目目录名
   * @returns 应用名称，可能为空
   */
  public async parseAppName(): Promise<string | undefined> {
    try {
      // 方法1：尝试从package.json获取应用名
      try {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const packagePath = join(this.projectPath, 'package.json');
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
        if (packageJson.name) {
          console.log(`📦 从package.json解析到应用名: ${packageJson.name}`);
          return packageJson.name;
        }
      } catch (error) {
        // package.json不存在或解析失败，继续下一个方法
      }

      // 方法2：尝试从git remote origin URL解析
      try {
        const { stdout } = await execPromise('git remote get-url origin', {
          cwd: this.projectPath,
        });
        const remoteUrl = stdout.trim();
        if (remoteUrl) {
          // 从URL中提取仓库名
          // 支持格式：git@github.com:user/repo-name.git 或 https://github.com/user/repo-name.git
          const match = remoteUrl.match(/[/:]([\w-]+)(?:\.git)?$/);
          if (match && match[1]) {
            console.log(`🔗 从git remote URL解析到应用名: ${match[1]}`);
            return match[1];
          }
        }
      } catch (error) {
        // git remote失败，继续下一个方法
      }

      // 方法3：使用项目目录名作为fallback
      try {
        const { basename } = await import('path');
        const dirName = basename(this.projectPath);
        if (dirName && dirName !== '.' && dirName !== '/') {
          console.log(`📁 从项目目录名解析到应用名: ${dirName}`);
          return dirName;
        }
      } catch (error) {
        // 获取目录名失败
      }

      console.log('⚠️ 无法解析应用名，将使用空值');
      return undefined;
    } catch (error) {
      console.error('解析应用名失败:', error);
      return undefined;
    }
  }
}