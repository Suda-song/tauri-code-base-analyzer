import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadEntities, validateEntities } from './enrichment/loader';
import { StaticAnalyzer } from './enrichment/staticAnalyzer';
import { LLMLabeler } from './enrichment/llmLabeler';
import { saveEnrichedEntities } from './enrichment/persistence';
import { EnrichmentOrchestrator } from './enrichment/orchestrator';
import { extractAllEntities } from './fileWalker';
import { BaseEntity, EnrichedEntity } from './enrichment/interfaces';
import { createTools, createToolsMap } from './enrichment/tools';

/**
 * 获取项目根目录
 */
function getProjectRoot() {
  return path.resolve(__dirname, '../../../');
}

/**
 * 创建临时测试目录
 */
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `enrichment-test-${Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

describe('Enrichment功能测试', () => {
  const projectRoot = getProjectRoot();
  const fixtureDir = path.join(projectRoot, 'apps/after-sale-demo');
  // const fixtureDir = '/Users/bianlian/electronic'
  console.log('fixtureDir', fixtureDir);
  // 使用系统临时目录
  const tempDir = createTempDir();
  const tempEntitiesPath = path.join(tempDir, 'temp_entities.json');
  const enrichedEntitiesPath = path.join(tempDir, 'enriched_entities.json');

  let entities: BaseEntity[] = [];

  // 预先提取实体，以便后续测试使用
  beforeAll(async () => {
    console.log(`开始从 ${fixtureDir} 提取实体进行测试...`);

    // 检查目录是否存在
    const dirExists = fs.existsSync(fixtureDir);
    console.log(`Fixture 目录 ${fixtureDir} 存在: ${dirExists}`);

    if (!dirExists) {
      console.warn('测试目录不存在，测试可能失败');
      return;
    }

    // 提取实体
    entities = await extractAllEntities(fixtureDir);
    console.log(`提取了 ${entities.length} 个实体，用于后续测试`);

    // 保存到临时文件，供后续测试使用
    fs.writeFileSync(tempEntitiesPath, JSON.stringify(entities, null, 2));
    console.log(`实体已保存到临时文件: ${tempEntitiesPath}`);
  });

  // 测试工具定义
  describe('Tools模块', () => {
    it('应该能正确创建工具', () => {
      const tools = createTools(projectRoot);
      expect(tools.length).toBeGreaterThan(0);

      const readFileTool = tools.find(t => t.name === 'read_file');
      expect(readFileTool).toBeDefined();

      const toolsMap = createToolsMap(tools);
      expect(toolsMap.read_file).toBeDefined();
      expect(toolsMap.read_file.parameters).toBeDefined();
      console.log('成功创建工具定义，包含工具: ' + tools.map(t => t.name).join(', '));
    });

    it('应该能执行read_file工具', async () => {
      const tools = createTools(projectRoot);
      const readFileTool = tools.find(t => t.name === 'read_file')!;

      // 创建测试文件
      const testFilePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFilePath, 'Hello, World!');

      // 使用相对路径调用
      const relativeFilePath = path.relative(projectRoot, testFilePath);
      const result = await readFileTool.execute({file_path: relativeFilePath});

      // 验证结果
      expect(result).toBe('Hello, World!');
      console.log(`成功读取文件: ${relativeFilePath}`);

      // 测试读取不存在的文件
      const nonExistResult = await readFileTool.execute({file_path: 'non-exist.txt'});
      expect(nonExistResult).toContain('错误');
      console.log('正确处理不存在的文件');
    });
  });

  // 测试加载器
  describe('Loader模块', () => {
    it('应该能够加载和验证实体', async () => {
      // 使用上一步生成的临时文件
      const loadedEntities = await loadEntities(tempEntitiesPath);

      expect(Array.isArray(loadedEntities)).toBe(true);
      expect(loadedEntities.length).toBeGreaterThan(0);

      // 验证实体
      const validEntities = validateEntities(loadedEntities);
      expect(validEntities.length).toBeGreaterThanOrEqual(loadedEntities.length * 0.8); // 假设至少80%是有效的

      console.log(`成功加载和验证 ${validEntities.length} 个实体`);
    });
  });

  // 测试静态分析器
  describe('StaticAnalyzer模块', () => {
    it('应该能分析Vue/TS/TSX文件的静态信息', async () => {
      if (entities.length === 0) {
        console.warn('没有实体可供测试');
        return;
      }

      const analyzer = new StaticAnalyzer(fixtureDir, entities);
      const entity = entities.find(e => e.type === 'component'); // 尝试找一个组件

      if (!entity) {
        console.warn('未找到组件实体进行测试');
        return;
      }

      const analysisResult = await analyzer.analyzeEntity(entity);

      expect(analysisResult).toBeDefined();
      expect(Array.isArray(analysisResult.IMPORTS)).toBe(true);
      expect(Array.isArray(analysisResult.CALLS)).toBe(true);
      expect(Array.isArray(analysisResult.EMITS)).toBe(true);

      console.log(`成功分析实体 ${entity.id}，提取了静态信息:`, {
        IMPORTS: analysisResult.IMPORTS.length,
        CALLS: analysisResult.CALLS.length,
        EMITS: analysisResult.EMITS.length,
        TEMPLATE_COMPONENTS: analysisResult.TEMPLATE_COMPONENTS?.length
      });

      // 输出更详细的信息
      console.log('IMPORTS:', analysisResult.IMPORTS);
      console.log('CALLS:', analysisResult.CALLS);
      console.log('EMITS:', analysisResult.EMITS);
      console.log('TEMPLATE_COMPONENTS:', analysisResult.TEMPLATE_COMPONENTS);
    });

    it('应该以实体ID格式返回IMPORTS和CALLS', async () => {
      if (entities.length === 0) {
        console.warn('没有实体可供测试');
        return;
      }

      const analyzer = new StaticAnalyzer(fixtureDir, entities);

      // 寻找一个具有导入和调用的组件
      const entity = entities.find(e => e.type === 'component') || entities[0];

      const analysisResult = await analyzer.analyzeEntity(entity);

      // 验证IMPORTS格式
      if (analysisResult.IMPORTS.length > 0) {
        const firstImport = analysisResult.IMPORTS[0];
        expect(typeof firstImport).toBe('string');

        // 实体ID应该格式为 "Type:Name"
        expect(firstImport).toMatch(/^[A-Za-z]+:[A-Za-z0-9_]+$/);
        console.log('导入使用了正确的实体ID格式:', firstImport);
      }

      // 验证CALLS格式
      if (analysisResult.CALLS.length > 0) {
        const firstCall = analysisResult.CALLS[0];
        expect(typeof firstCall).toBe('string');

        // 调用可能是 "Type:Name" 或 "Type:Name.method"
        const callFormatMatch = firstCall.match(/^[A-Za-z]+:[A-Za-z0-9_]+(.[A-Za-z0-9_]+)?$/);
        expect(callFormatMatch).not.toBeNull();
        console.log('调用使用了正确的实体ID格式:', firstCall);
      }

      // 验证不再包含旧格式的字符串描述
      const allItems = [...analysisResult.IMPORTS, ...analysisResult.CALLS];
      const hasOldFormat = allItems.some(item =>
        item.includes('从') ||
        item.includes('导入') ||
        item.includes('路径')
      );

      expect(hasOldFormat).toBe(false);
      console.log('所有导入和调用都使用了新的实体ID格式');
    });
  });

  // 暂时跳过LLM相关测试，避免实际API调用
  describe.skip('LLMLabeler模块', () => {
    it('应该能调用LLM生成摘要和标签', async () => {
      if (entities.length === 0) {
        console.warn('没有实体可供测试');
        return;
      }

      const analyzer = new StaticAnalyzer(fixtureDir, entities);
      const labeler = new LLMLabeler(undefined, projectRoot);

      // 选择一个函数实体，这样可以测试读取文件的工具
      const entity = entities.find(e => e.type === 'function') || entities[0];
      const analysisResult = await analyzer.analyzeEntity(entity);

      // 创建测试文件，模拟源代码
      const mockFilePath = path.join(tempDir, 'mockFunction.ts');
      fs.writeFileSync(mockFilePath, `
// 这是一个模拟的函数定义
export function ${entity.rawName}() {
  // 这个函数的功能是格式化日期
  const date = new Date();
  return date.toLocaleDateString();
}
      `);

      // 修复原始实体文件路径，指向测试文件
      const testEntity = {
        ...entity,
        file: path.relative(projectRoot, mockFilePath)
      };

      console.log(`开始为实体 ${testEntity.id} 生成摘要和标签...`);
      console.log(`测试实体文件: ${testEntity.file}`);

      // 调用LLM生成标签和摘要
      const llmResponse = await labeler.generateLabels(testEntity, analysisResult, 'Test project description');

      expect(llmResponse).toBeDefined();
      expect(typeof llmResponse.summary).toBe('string');
      expect(Array.isArray(llmResponse.tags)).toBe(true);

      console.log(`成功为实体 ${testEntity.id} 生成摘要和标签:`, {
        summary: llmResponse.summary,
        tags: llmResponse.tags
      });
    }, 60000); // 增加超时时间为60秒，因为LLM调用可能耗时
  });

  // 测试持久化模块
  describe('Persistence模块', () => {
    it('应该将丰富化后的实体保存到文件', async () => {
      if (entities.length === 0) {
        console.warn('没有实体可供测试');
        return;
      }

      // 创建一些示例丰富化实体
      const enrichedEntities: EnrichedEntity[] = entities.slice(0, 2).map(entity => ({
        ...entity,
        IMPORTS: ['Component:Button', 'Util:formatDate'],
        CALLS: ['API:fetchData', 'Util:formatDate.format'],
        EMITS: ['submit', 'cancel'],
        TEMPLATE_COMPONENTS: ['Button', 'Input'],
        summary: '这是一个测试实体摘要',
        tags: ['测试', '标签']
      }));

      // 保存到测试文件
      const testOutputPath = path.join(tempDir, 'test_enriched.json');
      const outputPath = await saveEnrichedEntities(enrichedEntities, testOutputPath);

      // 验证文件已创建
      expect(fs.existsSync(outputPath)).toBe(true);

      // 读取并验证内容
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBe(enrichedEntities.length);

      console.log(`成功将 ${enrichedEntities.length} 个丰富化实体保存到 ${outputPath}`);
    });
  });

  // 端到端测试
  describe('e2e', () => {
    it('应该完成从提取到丰富化的完整流程', async () => {
      // 检查目录是否存在
      const dirExists = fs.existsSync(fixtureDir);
      if (!dirExists) {
        console.warn('测试目录不存在，跳过端到端测试');
        return;
      }

      console.log('开始端到端测试，从项目根目录提取并丰富化实体...');

      // 1. 提取实体，但为了加快测试，只取前10个
      let extractedEntities = await extractAllEntities(fixtureDir);
      console.log(`提取了 ${extractedEntities.length} 个实体`);
      extractedEntities = extractedEntities.slice(0, 10);
      console.log(`使用其中 ${extractedEntities.length} 个进行测试`);

      // 保存提取的实体
      fs.writeFileSync(tempEntitiesPath, JSON.stringify(extractedEntities, null, 2));
      console.log(`提取的实体已保存到临时文件: ${tempEntitiesPath}`);

      // 2. 使用Enrichment Orchestrator进行丰富化
      const orchestrator = new EnrichmentOrchestrator(fixtureDir, {
        concurrency: 1, // 降低并发，避免API限制
        maxRetries: 1,
        retryDelay: 1000,
        inputPath: tempEntitiesPath,
        outputPath: enrichedEntitiesPath
      });

      // 运行丰富化流程
      const resultPath = await orchestrator.run();

      // 3. 验证结果
      expect(fs.existsSync(resultPath)).toBe(true);

      const enrichedEntities = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      expect(Array.isArray(enrichedEntities)).toBe(true);
      expect(enrichedEntities.length).toBe(extractedEntities.length);

      // 验证丰富化字段存在
      const firstEntity = enrichedEntities[0];
      expect(Array.isArray(firstEntity.IMPORTS)).toBe(true);
      expect(Array.isArray(firstEntity.CALLS)).toBe(true);
      expect(Array.isArray(firstEntity.EMITS)).toBe(true);
      expect(typeof firstEntity.summary).toBe('string');
      expect(Array.isArray(firstEntity.tags)).toBe(true);

      // 验证IMPORTS和CALLS使用新格式
      if (firstEntity.IMPORTS.length > 0) {
        expect(firstEntity.IMPORTS[0]).toMatch(/^[A-Za-z]+:[A-Za-z0-9_]+/);
      }

      if (firstEntity.CALLS.length > 0) {
        expect(firstEntity.CALLS[0]).toMatch(/^[A-Za-z]+:[A-Za-z0-9_]+/);
      }

      console.log('端到端测试完成，成功生成丰富化实体:', {
        输入实体数: extractedEntities.length,
        输出实体数: enrichedEntities.length,
        第一个实体: {
          id: firstEntity.id,
          type: firstEntity.type,
          summary: firstEntity.summary,
          tags: firstEntity.tags,
          IMPORTS: firstEntity.IMPORTS.slice(0, 2),
          CALLS: firstEntity.CALLS.slice(0, 2)
        }
      });
    }, 0); // 增加超时时间为120秒，因为端到端测试可能耗时
  }, {
    timeout: 0
  });
});
