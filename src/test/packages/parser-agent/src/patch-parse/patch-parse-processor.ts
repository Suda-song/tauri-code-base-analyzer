import { TaskQueueManager } from './task-queue-manager';
import { FileProcessor } from './file-processor';
import { EntityFileManager } from './entity-file-manager';
import { GitChangedFilesProvider } from './git-provider';
import { ProcessOptions, FileEntityMapping } from './types';
import { BaseEntity } from '../enrichment/interfaces';
import { extractAllEntities } from '../fileWalker';
import { extractReadmeSections } from '../readme-generator/index';
import path from 'path';
import fs from 'fs';

// 主处理器类
export class PatchParseProcessor {
  private taskManager: TaskQueueManager;
  private fileProcessor: FileProcessor;
  private entityManager: EntityFileManager;
  private gitProvider: GitChangedFilesProvider;
  private rootDir: string;
  private fileEntityMappings: Map<string, FileEntityMapping>; // 文件实体映射
  private options: ProcessOptions;
  private projectReadme: string = ''; // 缓存的README内容

  constructor(rootDir: string, options: ProcessOptions = {}, taskManager?: TaskQueueManager) {
    this.rootDir = rootDir;
    this.taskManager = taskManager || TaskQueueManager.getInstance();
    this.fileProcessor = new FileProcessor(rootDir, options);
    this.entityManager = new EntityFileManager(rootDir);
    this.gitProvider = new GitChangedFilesProvider(rootDir);
    this.fileEntityMappings = new Map<string, FileEntityMapping>();
    this.options = options;
    // 设置基础文件数量（只有在没有传入taskManager时才设置）
    if (!taskManager) {
      const baseFileCount = options.baseFileCount || this.entityManager.getExistingFileCount();
      this.taskManager.setBaseFileCount(baseFileCount);
    }
  }

  /**
   * 获取项目README内容
   * @returns README内容字符串，失败时返回空字符串
   */
  private async getProjectReadme(): Promise<string> {
    try {
      const readmeData = await extractReadmeSections({
        workspace: this.rootDir,
        sections: ['structure', 'architecture']
      });
      
      const content = readmeData.structure + readmeData.architecture || '';
      console.log(`📖 PatchParseProcessor 成功读取项目README内容，长度: ${content.length} 字符`);
      return content;
    } catch (error) {
      console.warn(`PatchParseProcessor 读取项目README失败: ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * 先解析更新 entities.json，然后添加到队列进行富化
   * @param files 要处理的文件列表
   * @param deletedFiles 要删除的文件列表
   * @param options 处理选项
   * @returns 文件实体映射列表
   */
  async parseAndEnrichFiles(files: string[], deletedFiles: string[] = [], options: ProcessOptions = {}): Promise<FileEntityMapping[]> {
    if (files.length === 0 && deletedFiles.length === 0) {
      console.log('📭 没有文件需要处理');
      return [];
    }

    console.log(`🚀 开始处理: ${files.length} 个文件, ${deletedFiles.length} 个删除文件`);

    try {
      // 1. 处理删除文件：从队列、映射、entities.json、entities.enriched.json 中移除
      if (deletedFiles.length > 0) {
        await this.handleDeletedFiles(deletedFiles);
      }

      // 2. 解析新文件并更新 entities.json
      let fileEntityMappings: FileEntityMapping[] = [];
      if (files.length > 0) {
        fileEntityMappings = await this.entityManager.parseFilesAndUpdateEntities(files, []);
        
        // 3. 更新文件实体映射
        fileEntityMappings.forEach(mapping => {
          this.fileEntityMappings.set(mapping.file, mapping);
        });

        // 4. 添加文件到任务队列进行富化
        this.taskManager.addFiles(files);
        
        console.log(`📋 已解析 ${files.length} 个文件并添加到富化队列`);
      }

      console.log('✅ 解析和队列添加完成');
      return fileEntityMappings;

    } catch (error) {
      console.error(`❌ 处理失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 处理删除文件：从所有相关位置移除
   * @param deletedFiles 删除的文件列表
   */
  private async handleDeletedFiles(deletedFiles: string[]): Promise<void> {
    console.log(`🗑️ 处理 ${deletedFiles.length} 个删除文件`);

    // 1. 从任务队列中移除删除的文件
    this.taskManager.removeFiles(deletedFiles);

    // 2. 从文件实体映射中移除
    deletedFiles.forEach(file => {
      this.fileEntityMappings.delete(file);
    });

    // 3. 从 entities.json 和 entities.enriched.json 中移除相关实体
    await this.entityManager.parseFilesAndUpdateEntities([], deletedFiles);
    this.entityManager.batchUpdateEnrichedEntities([], deletedFiles);

    console.log(`🗑️ 已从所有位置清理删除文件的数据`);
  }



  /**
   * 启动任务处理队列（文件维度并行批处理）
   */
  async startProcessingQueue(options: ProcessOptions = {}): Promise<void> {
    // 获取项目README内容（每次队列启动时获取最新的）
    this.projectReadme = await this.getProjectReadme();
    
    // 如果已经在处理中，直接返回
    if (this.taskManager.isProcessingState()) {
      console.log('📋 任务队列已在处理中，跳过重复启动');
      return;
    }

    // 设置处理状态
    this.taskManager.setProcessing(true);
    console.log('🚀 启动任务处理队列');

    try {
      while (this.taskManager.hasWork()) {
        // 检查是否暂停
        if (this.taskManager.isPausedState()) {
          console.log('⏸️ 任务队列已暂停，等待恢复...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const batch = this.taskManager.getNextBatch(this.options.batchSize || 2);
        
        if (batch.length === 0) {
          // 如果没有任务，等待一小会儿
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        console.log(`📊 处理批次: ${batch.length} 个文件`);

        // 批次处理：并行处理每个文件，每个文件处理完立即标记完成
        const batchEnrichedEntities: BaseEntity[] = [];
        
        // 并行处理批次中的所有文件
        const filePromises = batch.map(async (file) => {
          try {
            // 获取文件的实体映射
            const mapping = this.fileEntityMappings.get(file);
            if (!mapping) {
              console.warn(`⚠️ 文件 ${file} 未找到实体映射，跳过处理`);
              return [];
            }

            if (mapping.entities.length === 0) {
              console.log(`📭 文件 ${file} 没有实体需要富化`);
              return [];
            }

            // 读取完整实体列表作为富化上下文
            const fullEntities = await this.getFullEntities();
            
            // 处理单个文件的实体映射
            const enrichedEntities = await this.fileProcessor.processBatchFileEntityMappings(
              [mapping], 
              fullEntities,
              this.projectReadme
            );

            console.log(`✅ 文件 ${file} 处理完成，富化了 ${enrichedEntities.length} 个实体`);
            return enrichedEntities;
            
          } catch (error) {
            console.error(`❌ 处理文件 ${file} 失败: ${(error as Error).message}`);
            return [];
          } finally {
            // 立即标记文件完成，更新进度
            this.taskManager.markFileCompleted(file);
          }
        });

        // 等待批次中所有文件处理完成
        const results = await Promise.all(filePromises);
        
        // 收集所有富化实体
        results.forEach(enrichedEntities => {
          batchEnrichedEntities.push(...enrichedEntities);
        });

        // 批次处理完成后，统一批量更新富化实体文件
        if (batchEnrichedEntities.length > 0) {
          this.entityManager.batchUpdateEnrichedEntities(batchEnrichedEntities);
          console.log(`📝 批次富化实体更新完成: ${batchEnrichedEntities.length} 个实体`);
        }

        console.log(`✅ 批次处理完成`);
      }

      console.log('🎯 所有任务处理完成');
    } finally {
      // 重置处理状态
      this.taskManager.setProcessing(false);
      console.log('📋 任务处理队列已停止');
    }
  }

  /**
   * 获取完整实体列表
   */
  private async getFullEntities(): Promise<BaseEntity[]> {
    const fullEntitiesPath = path.join(this.rootDir, 'data/entities.json');
    if (fs.existsSync(fullEntitiesPath)) {
      const fullEntitiesContent = fs.readFileSync(fullEntitiesPath, 'utf-8');
      return JSON.parse(fullEntitiesContent);
    }
    return [];
  }

  /**
   * 获取文件实体映射状态（用于调试）
   */
  getFileEntityMappings(): Map<string, FileEntityMapping> {
    return new Map(this.fileEntityMappings);
  }

  /**
   * 清理文件实体映射状态
   */
  clearFileEntityMappings(): void {
    this.fileEntityMappings.clear();
  }

  notifyProgress(): void {
    this.taskManager.notifyProgress();
  }
} 