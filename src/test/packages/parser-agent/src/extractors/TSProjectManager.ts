import fs from 'fs';
import { Project } from 'ts-morph';

/**
 * 通用 TypeScript 项目管理器
 * 提供单例模式的 ts-morph Project 实例和多层缓存机制
 * 适用于所有需要 TypeScript 解析的提取器
 */
export class TSProjectManager {
  private static instance: TSProjectManager;
  private project: Project;
  private sourceFileCache = new Map<string, { sourceFile: any; mtime: number }>();
  private extractionCache = new Map<string, any[]>();
  private maxCacheSize: number;

  private constructor(maxCacheSize: number = 100 * 1024 * 1024) { // 100MB默认限制
    this.maxCacheSize = maxCacheSize;
    this.project = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      compilerOptions: {
        allowJs: true,
        jsx: 1, // React JSX
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 2, // Node
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      }
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(maxCacheSize?: number): TSProjectManager {
    if (!TSProjectManager.instance) {
      TSProjectManager.instance = new TSProjectManager(maxCacheSize);
    }
    return TSProjectManager.instance;
  }

  /**
   * 获取 ts-morph Project 实例
   */
  getProject(): Project {
    return this.project;
  }

  /**
   * 获取带缓存的源文件
   * @param filePath 文件路径
   * @param content 文件内容（可选，如果不提供会自动读取）
   * @returns 源文件实例或null
   */
  getSourceFile(filePath: string, content?: string): any {
    // 检查文件是否需要更新
    const shouldUpdate = this.shouldUpdateSourceFile(filePath, content);
    
    if (shouldUpdate) {
      return this.createAndCacheSourceFile(filePath, content);
    }

    // 返回缓存的源文件
    const cached = this.sourceFileCache.get(filePath);
    return cached?.sourceFile;
  }

  /**
   * 检查提取缓存
   * @param filePath 文件路径
   * @param extractorType 提取器类型（用于区分不同提取器的缓存）
   */
  getCachedExtraction<T = any>(filePath: string, extractorType: string): T[] | null {
    const cacheKey = `${extractorType}:${filePath}`;
    
    if (!this.extractionCache.has(cacheKey)) {
      return null;
    }

    // 检查文件是否已变更
    if (this.isFileChanged(filePath)) {
      this.extractionCache.delete(cacheKey);
      return null;
    }

    return this.extractionCache.get(cacheKey) || null;
  }

  /**
   * 设置提取缓存
   * @param filePath 文件路径
   * @param extractorType 提取器类型
   * @param entities 提取的实体
   */
  setCachedExtraction<T = any>(filePath: string, extractorType: string, entities: T[]): void {
    const cacheKey = `${extractorType}:${filePath}`;
    
    // 检查缓存大小，必要时清理
    this.checkAndCleanCache();
    
    this.extractionCache.set(cacheKey, entities);
  }

  /**
   * 清理所有缓存
   */
  clearCache(): void {
    console.log('🧹 清理 TSProjectManager 缓存...');
    
    // 清理源文件缓存
    this.sourceFileCache.clear();
    
    // 清理提取缓存
    this.extractionCache.clear();
    
    // 清理项目中的所有源文件
    for (const sourceFile of this.project.getSourceFiles()) {
      this.project.removeSourceFile(sourceFile);
    }
    
    console.log('✅ TSProjectManager 缓存清理完成');
  }

  /**
   * 清理特定提取器的缓存
   */
  clearExtractorCache(extractorType: string): void {
    const keysToDelete = Array.from(this.extractionCache.keys())
      .filter(key => key.startsWith(`${extractorType}:`));
    
    keysToDelete.forEach(key => this.extractionCache.delete(key));
    
    console.log(`🧹 清理 ${extractorType} 提取器缓存: ${keysToDelete.length} 项`);
  }
  
  /**
   * 清理特定文件的所有提取器缓存
   * @param filePath 文件路径
   */
  clearFileExtractorCache(filePath: string): void {
    // 清理sourceFile缓存
    if (this.sourceFileCache.has(filePath)) {
      this.sourceFileCache.delete(filePath);
      console.log(`🧹 清理 sourceFileCache: ${filePath}`);
    }
    
    // 清理所有包含该文件路径的提取缓存
    const keysToDelete = Array.from(this.extractionCache.keys())
      .filter(key => key.includes(`:${filePath}`));
    
    keysToDelete.forEach(key => this.extractionCache.delete(key));
    
    // 从项目中移除源文件，强制下次重新解析
    const sourceFile = this.project.getSourceFile(filePath);
    if (sourceFile) {
      this.project.removeSourceFile(sourceFile);
      console.log(`🧹 从Project中移除源文件: ${filePath}`);
    }
    
    console.log(`🧹 清理文件相关缓存: ${filePath}, 共清理 ${keysToDelete.length} 项提取器缓存`);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    sourceFileCount: number;
    extractionCacheCount: number;
    estimatedMemoryUsage: string;
  } {
    // 估算内存使用
    let memoryUsage = 0;
    this.sourceFileCache.forEach(() => {
      memoryUsage += 50 * 1024; // 估算每个源文件约50KB
    });
    
    this.extractionCache.forEach(entities => {
      memoryUsage += entities.length * 1024; // 估算每个实体约1KB
    });

    return {
      sourceFileCount: this.sourceFileCache.size,
      extractionCacheCount: this.extractionCache.size,
      estimatedMemoryUsage: `${Math.round(memoryUsage / 1024 / 1024)}MB`
    };
  }

  // === 私有方法 ===

  /**
   * 检查源文件是否需要更新
   */
  private shouldUpdateSourceFile(filePath: string, content?: string): boolean {
    if (!this.sourceFileCache.has(filePath)) {
      return true;
    }

    if (!content) {
      // 如果没有提供内容，检查文件修改时间
      try {
        const stats = fs.statSync(filePath);
        const cached = this.sourceFileCache.get(filePath);
        return !cached || cached.mtime !== stats.mtime.getTime();
      } catch {
        return true;
      }
    }

    return false; // 有内容且已缓存，不需要更新
  }

  /**
   * 创建并缓存源文件
   */
  private createAndCacheSourceFile(filePath: string, content?: string): any {
    try {
      // 读取文件内容（如果未提供）
      const fileContent = content || fs.readFileSync(filePath, 'utf-8');
      
      // 移除旧的源文件
      const existingFile = this.project.getSourceFile(filePath);
      if (existingFile) {
        this.project.removeSourceFile(existingFile);
      }
      
      // 创建新的源文件
      const sourceFile = this.project.createSourceFile(filePath, fileContent, { overwrite: true });
      
      // 缓存文件信息
      const mtime = this.getFileModTime(filePath);
      this.sourceFileCache.set(filePath, {
        sourceFile,
        mtime
      });
      
      return sourceFile;
    } catch (error) {
      console.error(`创建源文件失败 ${filePath}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * 获取文件修改时间
   */
  private getFileModTime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtime.getTime();
    } catch {
      return Date.now();
    }
  }

  /**
   * 检查文件是否已变更
   */
  private isFileChanged(filePath: string): boolean {
    try {
      const currentMtime = this.getFileModTime(filePath);
      const cached = this.sourceFileCache.get(filePath);
      return !cached || cached.mtime !== currentMtime;
    } catch {
      return true;
    }
  }

  /**
   * 检查并清理缓存
   */
  private checkAndCleanCache(): void {
    const stats = this.getCacheStats();
    const estimatedBytes = parseInt(stats.estimatedMemoryUsage.replace('MB', '')) * 1024 * 1024;
    
    if (estimatedBytes > this.maxCacheSize) {
      console.log(`🧹 缓存大小超限 (${stats.estimatedMemoryUsage}), 开始清理...`);
      
      // 清理一半的提取缓存（保留最近使用的）
      const extractionKeys = Array.from(this.extractionCache.keys());
      const keysToDelete = extractionKeys.slice(0, Math.floor(extractionKeys.length / 2));
      
      keysToDelete.forEach(key => this.extractionCache.delete(key));
      
      console.log(`✅ 清理了 ${keysToDelete.length} 个提取缓存项`);
    }
  }
}

/**
 * 获取全局 TSProjectManager 实例的便捷函数
 */
export function getTSProjectManager(maxCacheSize?: number): TSProjectManager {
  return TSProjectManager.getInstance(maxCacheSize);
}

/**
 * 清理全局缓存的便捷函数
 */
export function clearTSCache(): void {
  TSProjectManager.getInstance().clearCache();
}

/**
 * 清理特定文件的所有ts-morph相关缓存的便捷函数
 * @param filePath 文件路径
 */
export function clearFileTSCache(filePath: string): void {
  TSProjectManager.getInstance().clearFileExtractorCache(filePath);
} 