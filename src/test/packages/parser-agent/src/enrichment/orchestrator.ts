/**
 * Enrichment Agent 编排器
 * 协调实体加载、静态分析、LLM标注、结果持久化和注释写回
 */

import pLimit from 'p-limit';
import path from 'path';
import fs from 'fs';
import { BaseEntity, EnrichedEntity, EnrichmentConfig, StaticAnalysisResult } from './interfaces';
import { getEnrichmentConfig, getLLMConfig } from './config';
import { loadEntities, validateEntities } from './loader';
import { StaticAnalyzer } from './staticAnalyzer';
import { LLMLabeler } from './llmLabeler';
import { saveEnrichedEntities } from './persistence';
import { extractReadmeSections } from '../readme-generator/index';
import { calculateMd5, calculateAnnotationMd5 } from '../utils';
import { writeAnnotations } from './annotation';
import { clearFileCache, extractAllEntities } from '../fileWalker';
import { getEntitiesCommitHistory } from '../commit-generator';

export class EnrichmentOrchestrator {
  private config: EnrichmentConfig;
  private staticAnalyzer: StaticAnalyzer | null = null;
  private llmLabeler: LLMLabeler | null = null;
  private rootDir: string;
  private fullEntities: BaseEntity[] | null = null;
  private modifiedFiles: Set<string> = new Set(); // 记录需要写入注释的文件

  constructor(rootDir: string, config?: Partial<EnrichmentConfig>, fullEntities?: BaseEntity[]) {
    this.rootDir = rootDir;
    this.config = getEnrichmentConfig(config);
    this.fullEntities = fullEntities || null;
    
    // 如果启用了预初始化，则在构造时创建实例
    if (this.config.preInitialize) {
      this.initializeAnalyzers();
    }
  }

  /**
   * 初始化分析器实例（预初始化模式）
   */
  private initializeAnalyzers(): void {
    const entitiesToUse = this.fullEntities || [];
    this.staticAnalyzer = new StaticAnalyzer(this.rootDir, entitiesToUse);
    // 将EnrichmentConfig的concurrency传递给LLMLabeler
    const llmConfig = {
      ...getLLMConfig(),
      maxConcurrency: this.config.concurrency
    };
    this.llmLabeler = new LLMLabeler(llmConfig, this.rootDir, entitiesToUse);
    console.log('🔧 预初始化了 StaticAnalyzer 和 LLMLabeler 实例');
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
      console.log(`📖 成功读取项目README内容，长度: ${content.length} 字符`);
      return content;
    } catch (error) {
      console.warn(`读取项目README失败: ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * 更新分析器的实体上下文
   * @param fullEntities 完整的实体列表
   */
  private async updateAnalyzersEntities(fullEntities: BaseEntity[]): Promise<void> {
    if (this.staticAnalyzer) {
      this.staticAnalyzer.setEntities(fullEntities);
    }
    if (this.llmLabeler) {
      this.llmLabeler.setEntities(fullEntities);
    }
  }

  /**
   * 直接处理实体数组（无需文件I/O）
   * @param entitiesToEnrich 要富化的实体列表
   * @param fullEntities 完整的实体列表（用于上下文）
   * @param projectReadme 项目README内容
   * @param writeAnnotation 是否写入注释到源文件，默认为true
   * @returns 富化后的实体列表
   */
  async enrichEntitiesDirectly(
    entitiesToEnrich: BaseEntity[], 
    fullEntities: BaseEntity[],
    projectReadme: string,
    writeAnnotation: boolean = true
  ): Promise<EnrichedEntity[]> {
    if (entitiesToEnrich.length === 0) {
      console.warn('没有实体需要富化');
      return [];
    }

    console.log(`🚀 开始直接富化 ${entitiesToEnrich.length} 个实体，上下文包含 ${fullEntities.length} 个实体`);

    // 确保分析器实例存在
    if (!this.staticAnalyzer || !this.llmLabeler) {
      this.staticAnalyzer = new StaticAnalyzer(this.rootDir, fullEntities);
      // 将EnrichmentConfig的concurrency传递给LLMLabeler
      const llmConfig = {
        ...getLLMConfig(),
        maxConcurrency: this.config.concurrency
      };
      this.llmLabeler = new LLMLabeler(llmConfig, this.rootDir, fullEntities);
      console.log('🔧 动态创建了 StaticAnalyzer 和 LLMLabeler 实例');
    } else {
      // 更新实体上下文
      await this.updateAnalyzersEntities(fullEntities);
      console.log('🔄 更新了分析器的实体上下文');
    }

    // 执行富化处理
    const enrichedEntities = await this.enrichEntities(entitiesToEnrich, projectReadme, writeAnnotation);
    
    console.log(`✅ 直接富化完成，处理了 ${enrichedEntities.length} 个实体`);
    return enrichedEntities;
  }

  /**
   * 运行完整的丰富化流程
   */
  async run(customInputPath?: string, customOutputPath?: string): Promise<string> {
    console.log('开始实体丰富化流程...');
    
    // 步骤1: 加载实体
    const inputPath = customInputPath || this.config.inputPath;
    const entities = await this.loadAndValidateEntities(inputPath);
    
    if (entities.length === 0) {
      console.warn('没有有效实体可处理，流程终止');
      return '';
    }

    // 创建StaticAnalyzer和LLMLabeler实例，传入完整的entities（如果有）
    const entitiesToUse = this.fullEntities || entities;
    this.staticAnalyzer = new StaticAnalyzer(this.rootDir, entitiesToUse);
    // 将EnrichmentConfig的concurrency传递给LLMLabeler
    const llmConfig = {
      ...getLLMConfig(),
      maxConcurrency: this.config.concurrency
    };
    this.llmLabeler = new LLMLabeler(llmConfig, this.rootDir, entitiesToUse);
    
    // 步骤2: 获取项目README内容
    const projectReadme = await this.getProjectReadme();
    
    // 步骤3: 为每个实体执行丰富化
    const enrichedEntities = await this.enrichEntities(entities, projectReadme);
    
    // 步骤4: 保存结果
    const outputPath = customOutputPath || this.config.outputPath;
    return await saveEnrichedEntities(enrichedEntities, outputPath, this.rootDir);
  }

  /**
   * 运行静态分析更新流程（保留原有的summary和tags）
   */
  async runStaticAnalysisUpdate(customInputPath?: string, customOutputPath?: string, enrichedInputPath?: string): Promise<string> {
    console.log('开始静态分析更新流程...');
    
    // 步骤1: 加载基础实体
    const inputPath = customInputPath || this.config.inputPath;
    const entities = await this.loadAndValidateEntities(inputPath);
    
    if (entities.length === 0) {
      console.warn('没有有效实体可处理，流程终止');
      return '';
    }

    // 步骤2: 加载已有的enriched实体（如果存在）
    const existingEnrichedPath = enrichedInputPath || this.config.outputPath;
    const existingEnrichedEntities = await this.loadExistingEnrichedEntities(existingEnrichedPath);
    
    // 创建StaticAnalyzer实例
    const entitiesToUse = this.fullEntities || entities;
    this.staticAnalyzer = new StaticAnalyzer(this.rootDir, entitiesToUse);
    
    // 步骤3: 为每个实体执行静态分析更新
    const updatedEntities = await this.updateStaticAnalysis(entities, existingEnrichedEntities);
    
    // 步骤4: 保存结果
    const outputPath = customOutputPath || this.config.outputPath;
    return await saveEnrichedEntities(updatedEntities, outputPath, this.rootDir);
  }

  /**
   * 加载已有的enriched实体
   */
  private async loadExistingEnrichedEntities(enrichedPath: string): Promise<Map<string, EnrichedEntity>> {
    const enrichedMap = new Map<string, EnrichedEntity>();
    
    try {
      const fullPath = path.isAbsolute(enrichedPath) ? enrichedPath : path.join(this.rootDir, enrichedPath);
      
      if (fs.existsSync(fullPath)) {
        console.log(`加载已有的enriched实体: ${fullPath}`);
        const enrichedData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        
        if (Array.isArray(enrichedData)) {
          for (const entity of enrichedData) {
            if (entity.id) {
              enrichedMap.set(entity.id, entity);
            }
          }
          console.log(`成功加载 ${enrichedMap.size} 个已有的enriched实体`);
        }
      } else {
        console.log(`enriched文件不存在: ${fullPath}，将创建新的enriched实体`);
      }
    } catch (error) {
      console.warn(`加载enriched实体失败: ${(error as Error).message}`);
    }
    
    return enrichedMap;
  }

  /**
   * 批量更新静态分析结果
   */
  private async updateStaticAnalysis(entities: BaseEntity[], existingEnrichedEntities: Map<string, EnrichedEntity>): Promise<EnrichedEntity[]> {
    console.log(`开始更新 ${entities.length} 个实体的静态分析结果...`);
    
    // 创建并发限制器
    const limit = pLimit(this.config.concurrency);
    
    // 并发执行静态分析更新
    const tasks = entities.map(entity => 
      limit(() => this.updateEntityStaticAnalysis(entity, existingEnrichedEntities.get(entity.id)))
    );
    
    const results = await Promise.all(tasks);
    console.log(`完成 ${results.length} 个实体的静态分析更新`);
    
    return results;
  }

  /**
   * 更新单个实体的静态分析结果
   */
  private async updateEntityStaticAnalysis(entity: BaseEntity, existingEnrichedEntity?: EnrichedEntity): Promise<EnrichedEntity> {
    console.log(`更新实体静态分析: ${entity.id}`);
    
    try {
      // 执行静态分析
      const analysisResult = await this.staticAnalyzer!.analyzeEntity(entity);
      
      // 如果有已存在的enriched实体，保留其summary、tags和projectDesc
      if (existingEnrichedEntity) {
        console.log(`保留实体 ${entity.id} 的已有summary、tags和projectDesc`);
        return {
          ...entity,
          ...analysisResult,
          summary: existingEnrichedEntity.summary,
          tags: existingEnrichedEntity.tags,
          projectDesc: existingEnrichedEntity.projectDesc,
          publishTag: existingEnrichedEntity.publishTag
        };
      } else {
        // 如果没有已存在的enriched实体，创建新的但不包含summary、tags和projectDesc
        console.log(`实体 ${entity.id} 没有已有的enriched数据，创建新的静态分析结果`);
        return {
          ...entity,
          ...analysisResult,
          summary: '',
          tags: [],
          projectDesc: '',
          publishTag: ''
        };
      }
    } catch (error) {
      console.error(`处理实体 ${entity.id} 的静态分析失败: ${(error as Error).message}`);
      
      // 如果有已存在的enriched实体，至少保留其summary、tags和projectDesc
      if (existingEnrichedEntity) {
        return {
          ...entity,
          IMPORTS: existingEnrichedEntity.IMPORTS || [],
          CALLS: existingEnrichedEntity.CALLS || [],
          EMITS: existingEnrichedEntity.EMITS || [],
          TEMPLATE_COMPONENTS: existingEnrichedEntity.TEMPLATE_COMPONENTS,
          ANNOTATION: existingEnrichedEntity.ANNOTATION,
          summary: existingEnrichedEntity.summary,
          tags: existingEnrichedEntity.tags,
          projectDesc: existingEnrichedEntity.projectDesc,
          publishTag: existingEnrichedEntity.publishTag
        };
      } else {
        // 返回带有错误信息的基础实体
        return {
          ...entity,
          IMPORTS: [],
          CALLS: [],
          EMITS: [],
          summary: `静态分析失败: ${(error as Error).message}`,
          tags: ['静态分析失败'],
          projectDesc: '',
          publishTag: ''
        };
      }
    }
  }

  /**
   * 加载并验证实体
   */
  private async loadAndValidateEntities(inputPath: string): Promise<BaseEntity[]> {
    try {
      const entities = await loadEntities(inputPath, this.rootDir);
      return validateEntities(entities);
    } catch (error) {
      console.error(`加载实体失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 批量丰富实体，支持并发限制和重试
   * @param writeAnnotation 是否写入注释到源文件，默认为false
   */
  private async enrichEntities(entities: BaseEntity[], projectReadme: string, writeAnnotation: boolean = false): Promise<EnrichedEntity[]> {
    console.log(`开始处理 ${entities.length} 个实体${!writeAnnotation ? ' (不写入注释)' : ''}...`);
    // 清空需要写入注释的文件
    this.modifiedFiles.clear();
    
    // 一次性加载已有的enriched实体，避免重复文件I/O
    const existingEnrichedPath = this.config.outputPath;
    const existingEnrichedEntities = await this.loadExistingEnrichedEntities(existingEnrichedPath);
    console.log(`加载了 ${existingEnrichedEntities.size} 个已有的enriched实体`);
    
    // 🆕 批量获取所有实体的commit历史
    let allCommitHistories: Record<string, any[]> = {};
    try {
      console.log(`📊 开始批量获取 ${entities.length} 个实体的commit历史...`);
      const entityIds = entities.map(e => e.id);
      allCommitHistories = await getEntitiesCommitHistory(
        entityIds,
        "entity_id", // 按实体分组
        "commitAt", // 按时间排序
        "DESC"  // 最新的在前
      );
      
      const entitiesWithCommits = Object.keys(allCommitHistories).filter(
        id => allCommitHistories[id] && allCommitHistories[id].length > 0
      );
      console.log(`📊 完成commit历史获取: ${entitiesWithCommits.length}/${entities.length} 个实体有提交记录`);
    } catch (error) {
      console.warn(`📊 获取commit历史失败: ${(error as Error).message}，将跳过publishTag生成`);
      allCommitHistories = {};
    }
    
    // 创建并发限制器
    const limit = pLimit(this.config.concurrency);
    
    // 并发执行丰富化，传递existingEnrichedEntities和commitHistory
    const tasks = entities.map(entity => 
      limit(() => this.enrichEntityWithRetry(
        entity, 
        this.config.maxRetries, 
        projectReadme, 
        writeAnnotation, 
        existingEnrichedEntities,
        allCommitHistories[entity.id] || [] // 🆕 传递commit历史
      ))
    );
    
    const results = await Promise.all(tasks);
    console.log(`完成 ${results.length} 个实体的丰富化`);
    
    // 注释更新的文件重新走一遍 extract，将entities.json和entities.enriched.json中的loc更新到最新值
    if (this.modifiedFiles.size > 0) {
      console.log(`需要重新处理被更新注释的 ${this.modifiedFiles.size} 个文件，确保位置信息最新...`);
      
      // 生成相对路径，用于查找实体
      const modifiedRelativePaths = Array.from(this.modifiedFiles).map(filePath => 
        path.relative(this.rootDir, filePath)
      );
      
      // 从修改过的文件中重新提取实体
      console.log(`重新提取修改过注释的文件: ${modifiedRelativePaths.join(', ')}`);
      try {
        const modifiedAbsolutePaths = Array.from(this.modifiedFiles);
        const reExtractedEntities = await extractAllEntities(this.rootDir, modifiedAbsolutePaths);
        console.log(`重新提取了 ${reExtractedEntities.length} 个实体`);
        
        if (reExtractedEntities.length > 0) {
          // 更新BaseEntity的loc属性
          entities.forEach((entity: BaseEntity) => {
            const reExtractedEntity = reExtractedEntities.find((e: BaseEntity) => e.id === entity.id);
            if (reExtractedEntity) {
              entity.loc = reExtractedEntity.loc;
            }
          });
          // 重新写入BaseEntity
          fs.writeFileSync(this.config.inputPath, JSON.stringify(entities, null, 2), 'utf-8');
          
          // 在results中更新所有reExtractedEntities实体的loc属性
          results.forEach((enrichedEntity: EnrichedEntity) => {
            const reExtractedEntity = reExtractedEntities.find((e: BaseEntity) => e.id === enrichedEntity.id);
            if (reExtractedEntity) {
              enrichedEntity.loc = reExtractedEntity.loc;
            }
          });

          // 清空需要写入注释的文件
          this.modifiedFiles.clear();

          return results;
        }
      } catch (error) {
        console.error(`重新处理被修改文件的实体失败: ${(error as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 丰富单个实体，支持重试
   * @param writeAnnotation 是否写入注释到源文件
   * @param commitHistory 实体的commit历史记录
   */
  private async enrichEntityWithRetry(entity: BaseEntity, retriesLeft: number, projectReadme: string, writeAnnotation: boolean = false, existingEnrichedEntities: Map<string, EnrichedEntity>, commitHistory: any[] = []): Promise<EnrichedEntity> {
    try {
      return await this.enrichEntity(entity, projectReadme, writeAnnotation, existingEnrichedEntities, commitHistory);
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(`处理实体 ${entity.id} 失败，剩余重试次数: ${retriesLeft}`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.enrichEntityWithRetry(entity, retriesLeft - 1, projectReadme, writeAnnotation, existingEnrichedEntities, commitHistory);
      } else {
        console.error(`处理实体 ${entity.id} 最终失败: ${(error as Error).message}`);
        // 返回带有错误信息的部分丰富化实体
        return {
          ...entity,
          IMPORTS: [],
          CALLS: [],
          EMITS: [],
          summary: `处理失败: ${(error as Error).message}`,
          tags: ['处理失败'],
          projectDesc: '',
          publishTag: '',
          ANNOTATION: `/**\n * @description 处理失败: ${(error as Error).message}\n */`
        };
      }
    }
  }

  /**
   * 调用llm生成信息
   * @param commitHistory 实体的commit历史记录
   */
  private async generateNewLabels(entity: BaseEntity, analysisResult: StaticAnalysisResult, projectReadme: string, writeAnnotation: boolean = false, commitHistory: any[] = []): Promise<EnrichedEntity> {
    let summary = '';
    let tags: string[] = [];
    let annotation = analysisResult.ORI_ANNOTATION || '';
    
    // 调用LLM生成摘要、标签和注释
    const llmResult = await this.llmLabeler!.generateLabels(entity, analysisResult, projectReadme, !writeAnnotation, commitHistory);
    ({ summary, tags, annotation } = llmResult);
    const projectDesc = llmResult.projectDesc;
    const publishTag = llmResult.publishTag; // 🆕 获取publishTag
    
    // 计算注释MD5
    const annotationString = (writeAnnotation ? annotation : analysisResult.ORI_ANNOTATION) || '';
    const annotationMd5 = calculateAnnotationMd5(annotationString);

    const enrichedEntity: EnrichedEntity = {
      ...entity,
      ...analysisResult,
      summary,
      tags,
      projectDesc,
      publishTag, // 🆕 添加publishTag字段
      ANNOTATION: annotationString,
      annotationMd5,
      codeMd5: entity.codeMd5
    }

    // 注释有更新且启用了写入注释，则写入文件
    if (writeAnnotation && annotation !== analysisResult.ORI_ANNOTATION) {
      const filePath = path.join(this.rootDir, entity.file);

      // 写入注释
      const isModified = await writeAnnotations(enrichedEntity, {
        filePath,
        oldAnnotation: analysisResult.ANNOTATION || '',
        insertMode: 'before',
        overwriteExisting: true,
      });
      
      // 如果文件被修改，记录需要重新处理的文件
      if (isModified) {
        console.log(`文件注释已更新，标记为需要重新处理: ${filePath}`);
        this.modifiedFiles.add(filePath);
        
        // 清除文件缓存，确保后续操作能读取到最新的文件内容
        clearFileCache(filePath);
      }
    }

    return enrichedEntity;
  }

  /**
   * 丰富单个实体
   * @param writeAnnotation 是否写入注释到源文件
   * @param commitHistory 实体的commit历史记录
   */
  private async enrichEntity(entity: BaseEntity, projectReadme: string, writeAnnotation: boolean = false, existingEnrichedEntities: Map<string, EnrichedEntity>, commitHistory: any[] = []): Promise<EnrichedEntity> {
    console.log(`处理实体: ${entity.id}${!writeAnnotation ? ' (不写入注释)' : ''}${commitHistory.length > 0 ? ` (${commitHistory.length}个commit记录)` : ''}`);
    
    // 步骤1: 执行静态分析
    const analysisResult = await this.staticAnalyzer!.analyzeEntity(entity);
    console.log('analysisResult.ORI_ANNOTATION', analysisResult.ORI_ANNOTATION);
    
    // 步骤2: 调用LLM生成摘要、标签和项目描述
    // 加载已有的enriched实体（如果存在）
    const existingEnrichedEntity = existingEnrichedEntities.get(entity.id);
    // 对比code/annotation md5
    if (existingEnrichedEntity) {
      const existingCodeMd5 = existingEnrichedEntity?.codeMd5 || '';
      const currentCodeMd5 = entity.codeMd5;
      const existingAnnotationMd5 = existingEnrichedEntity?.annotationMd5 || '';
      const currentAnnotationMd5 = calculateAnnotationMd5(analysisResult.ORI_ANNOTATION || '');

      const codeChange = existingCodeMd5 !== currentCodeMd5;
      const annotationChange = existingAnnotationMd5 !== currentAnnotationMd5;
      if (codeChange) {
        console.log(`AUTO-ANNOTATION:代码有变化，重新调用llm生成`);
        return this.generateNewLabels(entity, analysisResult, projectReadme, writeAnnotation, commitHistory);
      } else if (annotationChange) {
        console.log(`AUTO-ANNOTATION:仅注释有变化，直接更新`);
        return {
          ...existingEnrichedEntity,
          ANNOTATION: analysisResult.ORI_ANNOTATION || '',
          annotationMd5: currentAnnotationMd5,
        }
      } else {
        console.log(`AUTO-ANNOTATION:代码和注释都没有变化，直接返回`);
        return existingEnrichedEntity;
      }
    }
    console.log(`AUTO-ANNOTATION:没有existingEnrichedEntities，直接调用llm生成`);
    // 返回丰富化后的实体
    return this.generateNewLabels(entity, analysisResult, projectReadme, writeAnnotation, commitHistory);
  }
} 