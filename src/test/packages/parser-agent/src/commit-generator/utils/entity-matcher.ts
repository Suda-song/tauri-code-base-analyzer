/**
 * 实体匹配器 - 从实体文件中匹配与变更相关的实体
 */

import fs from "fs";
import path from "path";
import { GitUtils } from "./git-utils";
import { CommitEntity } from "../types";
import { WorkspaceManager, WorkspaceContext } from "./workspace-manager";

export interface ChangeRange {
  start: number;
  end: number;
  type: "added" | "deleted" | "modified";
}

export type ExtractMode = "staged" | "commitHash";

export interface ExtractOptions {
  mode: ExtractMode;
  commitHash?: string; // 当mode为commitHash时必须提供
}

export class EntityMatcher {
  private gitUtils: GitUtils;
  private workspaceManager: WorkspaceManager;
  private projectPath: string;

  constructor(workspaceManager: WorkspaceManager, projectPath?: string) {
    this.workspaceManager = workspaceManager;
    this.projectPath = projectPath || process.cwd();
    this.gitUtils = new GitUtils(this.projectPath);
  }

  /**
   * 检查是否有可用的实体文件
   */
  hasEntities(): boolean {
    const workspaceContexts =
      this.workspaceManager.getActiveWorkspacesWithEntities();
    return workspaceContexts.length > 0;
  }

  /**
   * 从变更文件中提取相关实体
   * @param options 提取选项，支持staged和commitHash两种模式
   */
  async extractEntitiesFromChangedFiles(
    options: ExtractOptions
  ): Promise<CommitEntity[]> {
    console.log(`🔍 开始提取变更文件的实体信息 (模式: ${options.mode})...`);

    if (!this.hasEntities()) {
      console.log("💡 未找到任何workspace的实体文件，跳过实体分析");
      return [];
    }

    try {
      let changedFiles: string[];
      let fileChangeRanges: Map<string, ChangeRange[]>;

      if (options.mode === "staged") {
        // 获取暂存区的文件变更
        const { files } = await this.gitUtils.getStagedInfo();
        changedFiles = files;
        fileChangeRanges = await this.gitUtils.getFileChangeRanges(true);
        console.log(`📁 检测到 ${changedFiles.length} 个暂存文件`);
      } else if (options.mode === "commitHash") {
        if (!options.commitHash) {
          throw new Error("commitHash模式下必须提供commitHash参数");
        }
        // 获取指定commit的文件变更
        const fullInfo = await this.gitUtils.getCommitFullInfo(
          options.commitHash
        );
        const { modifiedFiles, deletedFiles } = fullInfo.files;
        changedFiles = [...modifiedFiles, ...deletedFiles];
        fileChangeRanges = await this.gitUtils.getFileChangeRanges(
          true,
          options.commitHash
        );
        console.log(
          `📁 commit ${options.commitHash} 检测到 ${changedFiles.length} 个变更文件`
        );
      } else {
        throw new Error(`不支持的提取模式: ${options.mode}`);
      }

      console.log("changedFiles", changedFiles);

      // 过滤属于当前workspace的文件（如果是单实例模式）
      const filteredFiles = this.workspaceManager.getFilteredFiles
        ? this.workspaceManager.getFilteredFiles(changedFiles)
        : changedFiles;

      if (filteredFiles.length !== changedFiles.length) {
        console.log(
          `🔍 过滤后剩余 ${filteredFiles.length}/${changedFiles.length} 个文件属于当前workspace`
        );
      }

      return await this.extractEntitiesFromFiles(
        filteredFiles,
        fileChangeRanges
      );
    } catch (error) {
      console.warn(`提取实体失败:`, error);
      return [];
    }
  }

  /**
   * 从文件列表中提取实体
   */
  private async extractEntitiesFromFiles(
    changedFiles: string[],
    fileChangeRanges: Map<string, ChangeRange[]>
  ): Promise<CommitEntity[]> {
    if (!this.hasEntities()) {
      console.log("💡 未找到任何workspace的实体文件，跳过实体分析");
      return [];
    }

    const workspaceContexts =
      this.workspaceManager.getActiveWorkspacesWithEntities();
    console.log(
      `🔍 开始从 ${workspaceContexts.length} 个包含实体的workspace中提取实体...`
    );

    workspaceContexts.forEach((ws) => {
      console.log(
        `  📦 ${ws.name}: ${ws.entitiesFilePath} (存在: ${ws.hasEntities})`
      );
    });

    const allRelatedEntities: CommitEntity[] = [];
    const affectedWorkspaces =
      await this.workspaceManager.buildContextsForFiles(changedFiles);

    console.log(
      `🎯 变更文件涉及 ${affectedWorkspaces.length} 个workspace，开始提取实体...`
    );

    for (const workspace of affectedWorkspaces) {
      if (!workspace.hasEntities) {
        console.log(`📭 workspace ${workspace.name} 没有实体文件，跳过`);
        continue;
      }

      console.log(`🔍 正在从workspace ${workspace.name} 提取实体...`);
      console.log(`  实体文件路径: ${workspace.entitiesFilePath}`);

      const workspaceEntities = await this.extractEntitiesFromWorkspace(
        workspace,
        changedFiles,
        fileChangeRanges
      );

      allRelatedEntities.push(...workspaceEntities);
      console.log(
        `📦 从workspace ${workspace.name} 提取到 ${workspaceEntities.length} 个实体`
      );
    }

    console.log(
      `🔍 从 ${affectedWorkspaces.length} 个workspace中总共找到 ${allRelatedEntities.length} 个相关实体`
    );
    return allRelatedEntities;
  }

  /**
   * 从单个workspace中提取实体
   */
  private async extractEntitiesFromWorkspace(
    workspace: WorkspaceContext,
    changedFiles: string[],
    fileChangeRanges: Map<string, ChangeRange[]>
  ): Promise<CommitEntity[]> {
    try {
      // 读取实体文件并创建索引
      const entitiesContent = fs.readFileSync(
        workspace.entitiesFilePath,
        "utf-8"
      );
      const allEntities = JSON.parse(entitiesContent);
      const fileEntityMap = this.createEntityIndex(allEntities);

      // 过滤属于当前workspace的变更文件
      const workspaceChangedFiles = changedFiles.filter((file) =>
        WorkspaceManager.isFileInWorkspace(file, workspace)
      );

      if (workspaceChangedFiles.length === 0) {
        return [];
      }

      const relatedEntities: CommitEntity[] = [];

      // 处理每个变更文件
      for (const changedFile of workspaceChangedFiles) {
        // 规范化文件路径 - 转换为相对于workspace根目录的路径
        let normalizedFile = this.normalizeFilePathForWorkspace(
          changedFile,
          workspace
        );

        console.log(
          `🔍 查找文件: ${changedFile} -> ${normalizedFile} (workspace: ${workspace.name})`
        );

        // 查找文件对应的实体
        const fileEntities = this.findEntitiesForFile(
          fileEntityMap,
          normalizedFile
        );
        const changeRanges = fileChangeRanges.get(changedFile) || [];

        // 过滤实体
        for (const entity of fileEntities) {
          if (
            changeRanges.length === 0 ||
            this.isEntityInChangedRange(entity, changeRanges)
          ) {
            relatedEntities.push(this.convertToCommitEntity(entity, workspace));
          }
        }
      }

      return relatedEntities;
    } catch (error) {
      console.warn(`读取workspace ${workspace.name} 实体文件失败:`, error);
      return [];
    }
  }

  /**
   * 规范化文件路径为相对于workspace根目录的路径
   */
  private normalizeFilePathForWorkspace(
    filePath: string,
    workspace: WorkspaceContext
  ): string {
    // 统一路径分隔符
    let normalizedPath = filePath.replace(/\\/g, "/");

    // 检查文件路径是否已经包含workspace的路径前缀
    const workspaceRelativePath = path
      .relative(this.projectPath, workspace.rootPath)
      .replace(/\\/g, "/");

    // console.log(`🔧 路径规范化调试:`);
    // console.log(`  原始路径: ${filePath}`);
    // console.log(`  workspace根路径: ${workspace.rootPath}`);
    // console.log(`  workspace相对路径: ${workspaceRelativePath}`);

    // 如果文件路径以workspace的相对路径开头，去掉这个前缀
    if (normalizedPath.startsWith(workspaceRelativePath + "/")) {
      normalizedPath = normalizedPath.substring(
        workspaceRelativePath.length + 1
      );
    } else if (
      normalizedPath.startsWith(workspace.rootPath.replace(/\\/g, "/") + "/")
    ) {
      // 如果文件路径以workspace的绝对路径开头，去掉这个前缀
      normalizedPath = normalizedPath.substring(
        workspace.rootPath.replace(/\\/g, "/").length + 1
      );
    } else {
      // 尝试使用原有逻辑
      try {
        normalizedPath = path
          .relative(workspace.rootPath, path.resolve(filePath))
          .replace(/\\/g, "/");
      } catch (error) {
        // 如果出错，直接使用原路径
        console.warn(`路径规范化失败: ${filePath}`, error);
      }
    }

    // 清理路径前缀
    normalizedPath = normalizedPath.replace(/^\.\//, "");
    console.log(`  4规范化后路径: ${normalizedPath}`);
    return normalizedPath;
  }

  /**
   * 创建文件到实体的映射索引
   */
  private createEntityIndex(allEntities: any[]): Map<string, any[]> {
    const fileEntityMap = new Map<string, any[]>();

    for (const entity of allEntities) {
      let normalizedFile = entity.file.replace(/\\/g, "/").replace(/^\.\//, "");

      if (!fileEntityMap.has(normalizedFile)) {
        fileEntityMap.set(normalizedFile, []);
      }
      fileEntityMap.get(normalizedFile)!.push(entity);
    }

    console.log(`📊 创建文件索引完成，共 ${fileEntityMap.size} 个文件`);
    return fileEntityMap;
  }

  /**
   * 查找文件对应的实体
   */
  private findEntitiesForFile(
    fileEntityMap: Map<string, any[]>,
    targetFile: string
  ): any[] {
    const entities: any[] = [];
    console.log(`🔍 在文件索引中查找: ${targetFile}`);

    // 精确匹配
    if (fileEntityMap.has(targetFile)) {
      const exactEntities = fileEntityMap.get(targetFile)!;
      entities.push(...exactEntities);
      console.log(`✅ 精确匹配找到 ${exactEntities.length} 个实体`);
    }

    // 模糊匹配
    let fuzzyMatches = 0;
    for (const [filePath, fileEntities] of fileEntityMap) {
      if (filePath !== targetFile && this.isSameFile(filePath, targetFile)) {
        entities.push(...fileEntities);
        fuzzyMatches += fileEntities.length;
        console.log(
          `🔄 模糊匹配: ${filePath} -> ${fileEntities.length} 个实体`
        );
      }
    }

    if (fuzzyMatches > 0) {
      console.log(`🔄 模糊匹配总共找到 ${fuzzyMatches} 个实体`);
    }

    console.log(`📊 总共找到 ${entities.length} 个实体`);
    return entities;
  }

  /**
   * 判断两个路径是否指向同一个文件
   * 基于路径结构的相似度来判断，而不是仅仅依赖文件名
   */
  private isSameFile(path1: string, path2: string): boolean {
    // 标准化路径
    const normalized1 = path1.replace(/\\/g, "/").replace(/^\.\//, "");
    const normalized2 = path2.replace(/\\/g, "/").replace(/^\.\//, "");

    // 完全相同的路径
    if (normalized1 === normalized2) {
      return true;
    }

    // 检查是否是路径表示差异（相对路径 vs 绝对路径等）
    if (this.isPathVariation(normalized1, normalized2)) {
      return true;
    }

    return false;
  }

  /**
   * 检查是否是同一文件的不同路径表示方式
   */
  private isPathVariation(path1: string, path2: string): boolean {
    // 移除可能的路径前缀差异
    const cleanPath1 = this.cleanPathPrefix(path1);
    const cleanPath2 = this.cleanPathPrefix(path2);

    if (cleanPath1 === cleanPath2) {
      return true;
    }

    // 检查一个路径是否是另一个路径的后缀
    // 这处理了相对路径 vs 绝对路径的情况
    if (path1.endsWith(path2) || path2.endsWith(path1)) {
      // 检查前缀差异是否合理（只包含路径分隔符和 . 字符）
      const longer = path1.length > path2.length ? path1 : path2;
      const shorter = path1.length <= path2.length ? path1 : path2;
      const prefix = longer.substring(0, longer.length - shorter.length);

      // 前缀应该只包含路径相关字符
      return /^[\.\/\\]*$/.test(prefix);
    }

    return false;
  }

  /**
   * 清理路径前缀，移除常见的相对路径标识符
   */
  private cleanPathPrefix(filePath: string): string {
    return filePath
      .replace(/^(\.\.\/)+/, "") // 移除 ../
      .replace(/^\.\//, "") // 移除 ./
      .replace(/^\/+/, ""); // 移除开头的 /
  }

  /**
   * 判断实体是否在变更行号范围内
   */
  private isEntityInChangedRange(
    entity: any,
    changeRanges: ChangeRange[]
  ): boolean {
    return EntityMatcher.checkEntityInChangedRange(entity, changeRanges);
  }

  /**
   * 转换为CommitEntity格式
   */
  private convertToCommitEntity(
    entity: any,
    workspace: WorkspaceContext
  ): CommitEntity {
    return {
      id: entity.id,
      type: entity.type,
      file: entity.file,
      loc: entity.loc || null,
      rawName: entity.rawName,
      isWorkspace: true,
      isDDD: entity.isDDD || false,
      IMPORTS: entity.IMPORTS || [],
      CALLS: entity.CALLS || [],
      EMITS: entity.EMITS || [],
      TEMPLATE_COMPONENTS: entity.TEMPLATE_COMPONENTS || [],
      summary:
        entity.summary ||
        `实体: ${entity.rawName} (workspace: ${workspace.name})`,
      tags: entity.tags || [],
      ANNOTATION: entity.ANNOTATION || undefined,
    };
  }

  /**
   * 判断实体是否在变更行号范围内
   */
  static checkEntityInChangedRange(
    entity: any,
    changeRanges: ChangeRange[]
  ): boolean {
    if (!entity.loc) {
      return true; // 无位置信息，认为相关
    }

    let entityStart: number;
    let entityEnd: number;

    // 解析位置信息
    if (typeof entity.loc === "object") {
      if (entity.loc.start && entity.loc.end) {
        entityStart = entity.loc.start;
        entityEnd = entity.loc.end;
      } else if (entity.loc.start && entity.loc.start.line) {
        entityStart = entity.loc.start.line;
        entityEnd = entity.loc.end?.line || entityStart;
      } else {
        return true;
      }
    } else if (typeof entity.loc === "number") {
      entityStart = entity.loc;
      entityEnd = Number.MAX_SAFE_INTEGER;
    } else {
      return true;
    }

    // 检查范围重叠
    for (const range of changeRanges) {
      if (
        EntityMatcher.isRangeOverlap(
          entityStart,
          entityEnd,
          range.start,
          range.end
        )
      ) {
        return true;
      }
    }

    // 对于组件/函数，扩大匹配范围
    if (entity.type === "component" || entity.type === "function") {
      const minDistance = Math.min(
        ...changeRanges.map((range) =>
          Math.min(
            Math.abs(entityStart - range.start),
            Math.abs(entityEnd - range.end),
            Math.abs(entityStart - range.end),
            Math.abs(entityEnd - range.start)
          )
        )
      );
      return minDistance <= 50; // 50行内认为相关
    }

    return false;
  }

  /**
   * 判断两个行号范围是否重叠
   */
  static isRangeOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): boolean {
    return !(end1 < start2 || start1 > end2);
  }

  /**
   * 从diff内容中解析变更行号范围
   */
  static parseDiffToChangeRanges(diffContent: string): ChangeRange[] {
    const ranges: ChangeRange[] = [];
    const lines = diffContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          const newStart = parseInt(match[3]);
          const newCount = parseInt(match[4] || "1");
          const oldStart = parseInt(match[1]);
          const oldCount = parseInt(match[2] || "1");

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
        }
      }
    }

    return ranges;
  }

  /**
   * 提取与实体相关的diff片段
   */
  static extractEntityRelatedDiffSegments(
    entity: any,
    diffContent: string
  ): string {
    if (!entity.loc) {
      return diffContent; // 无位置信息，返回整个diff
    }

    let entityStart: number;
    let entityEnd: number;

    // 解析实体位置信息
    if (typeof entity.loc === "object") {
      if (entity.loc.start && entity.loc.end) {
        entityStart = entity.loc.start;
        entityEnd = entity.loc.end;
      } else if (entity.loc.start && entity.loc.start.line) {
        entityStart = entity.loc.start.line;
        entityEnd = entity.loc.end?.line || entityStart;
      } else {
        return diffContent;
      }
    } else if (typeof entity.loc === "number") {
      entityStart = entity.loc;
      entityEnd = entityStart + 50; // 默认范围
    } else {
      return diffContent;
    }

    // 对于组件/函数，扩大提取范围
    if (entity.type === "component" || entity.type === "function") {
      entityStart = Math.max(1, entityStart - 10);
      entityEnd = entityEnd + 10;
    }

    const lines = diffContent.split("\n");
    const relatedLines: string[] = [];
    let currentHunkStart = 0;
    let currentHunkNewStart = 0;
    let currentHunkOldStart = 0;
    let insideRelevantHunk = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测新的hunk开始
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          currentHunkNewStart = parseInt(match[3]);
          currentHunkOldStart = parseInt(match[1]);
          currentHunkStart = i;

          // 判断这个hunk是否与实体相关
          const hunkNewEnd =
            currentHunkNewStart + parseInt(match[4] || "1") - 1;
          const hunkOldEnd =
            currentHunkOldStart + parseInt(match[2] || "1") - 1;

          insideRelevantHunk =
            EntityMatcher.isRangeOverlap(
              entityStart,
              entityEnd,
              currentHunkNewStart,
              hunkNewEnd
            ) ||
            EntityMatcher.isRangeOverlap(
              entityStart,
              entityEnd,
              currentHunkOldStart,
              hunkOldEnd
            );

          if (insideRelevantHunk) {
            relatedLines.push(line);
          }
        }
        continue;
      }

      // 如果在相关的hunk内，添加diff行
      if (insideRelevantHunk) {
        relatedLines.push(line);
      }
    }

    return relatedLines.length > 0 ? relatedLines.join("\n") : "";
  }
}
