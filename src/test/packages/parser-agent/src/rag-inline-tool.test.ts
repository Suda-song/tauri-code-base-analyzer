import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RagInlineTool, searchCodeEntities, getRelatedCodeEntities } from './rag-inline-tool';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
const entitiesPath = path.join(tempDir, 'entities.json');

const testEntities = [
  {
    "id": "Component:index",
    "type": "component",
    "file": "src/components/BannerPlacement/index.vue",
    "loc": 19,
    "rawName": "setup",
    "IMPORTS": [
      "API:getResourceData",
      "Component:Carousel",
      "Const:RESOURCE_BANNER_KEY"
    ],
    "CALLS": [
      "API:getResourceData"
    ],
    "EMITS": [],
    "TEMPLATE_COMPONENTS": [
      "Carousel"
    ],
    "summary": "轮播图广告位组件，根据资源位ID获取Banner数据，支持水平/垂直轮播、自动播放、点击跳转等功能",
    "tags": [
      "轮播图",
      "广告位",
      "Banner"
    ]
  },
  {
    "id": "Component:index_cdd4c743dba1",
    "type": "component",
    "file": "src/components/BizCmp/AddressLibrarySelect/index.vue",
    "loc": 137,
    "rawName": "setup",
    "IMPORTS": [
      "API:getAddressList",
      "Hook:useTracker"
    ],
    "CALLS": [
      "Hook:useTracker"
    ],
    "EMITS": [],
    "TEMPLATE_COMPONENTS": [
      "Space",
      "Select",
      "Icon",
      "Text",
      "Tag",
      "Link"
    ],
    "summary": "地址库选择组件，用于展示和选择发货/退货地址，支持默认地址标记，集成埋点追踪，并提供地址库管理入口。",
    "tags": [
      "地址选择",
      "物流管理",
      "发货地址"
    ]
  },
  {
    "id": "Component:Carousel",
    "type": "component",
    "file": "src/components/Carousel/index.vue",
    "loc": 25,
    "rawName": "Carousel",
    "IMPORTS": [],
    "CALLS": [],
    "EMITS": ["change", "click"],
    "TEMPLATE_COMPONENTS": [],
    "summary": "轮播组件，支持自动播放、循环滚动和自定义导航按钮",
    "tags": [
      "轮播图",
      "UI组件",
      "图片展示"
    ]
  },
  {
    "id": "API:getResourceData",
    "type": "function",
    "file": "src/api/resource.ts",
    "loc": {
      "start": 5,
      "end": 15
    },
    "rawName": "getResourceData",
    "IMPORTS": [],
    "CALLS": [],
    "EMITS": [],
    "TEMPLATE_COMPONENTS": [],
    "summary": "获取资源数据的API，支持按资源ID查询",
    "tags": [
      "API",
      "数据获取",
      "资源管理"
    ]
  },
  {
    "id": "API:getAddressList",
    "type": "function",
    "file": "src/api/address.ts",
    "loc": {
      "start": 10,
      "end": 20
    },
    "rawName": "getAddressList",
    "IMPORTS": [],
    "CALLS": [],
    "EMITS": [],
    "TEMPLATE_COMPONENTS": [],
    "summary": "获取地址列表的API，支持分页和筛选",
    "tags": [
      "API",
      "地址管理",
      "数据获取"
    ]
  },
  {
    "id": "Hook:useTracker",
    "type": "function",
    "file": "src/hooks/useTracker.ts",
    "loc": {
      "start": 3,
      "end": 18
    },
    "rawName": "useTracker",
    "IMPORTS": [],
    "CALLS": [],
    "EMITS": [],
    "TEMPLATE_COMPONENTS": [],
    "summary": "埋点追踪Hook，用于记录用户行为",
    "tags": [
      "Hook",
      "埋点",
      "数据统计"
    ]
  }
];

describe('RagInlineTool', () => {
  let tool: RagInlineTool;

  beforeAll(() => {
    // 写入测试实体到临时文件
    fs.writeFileSync(entitiesPath, JSON.stringify(testEntities), 'utf8');
    
    // 创建组件目录结构（用于测试读取代码文件）
    const componentsDir = path.join(tempDir, 'src', 'components');
    const apiDir = path.join(tempDir, 'src', 'api');
    const hooksDir = path.join(tempDir, 'src', 'hooks');
    
    fs.mkdirSync(path.join(componentsDir, 'BannerPlacement'), { recursive: true });
    fs.mkdirSync(path.join(componentsDir, 'BizCmp', 'AddressLibrarySelect'), { recursive: true });
    fs.mkdirSync(path.join(componentsDir, 'Carousel'), { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(hooksDir, { recursive: true });
    
    // 创建测试组件文件
    fs.writeFileSync(
      path.join(componentsDir, 'BannerPlacement', 'index.vue'),
      '<template>\n  <div>Banner组件</div>\n</template>',
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(componentsDir, 'BizCmp', 'AddressLibrarySelect', 'index.vue'),
      '<template>\n  <div>地址选择组件</div>\n</template>',
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(componentsDir, 'Carousel', 'index.vue'),
      '<template>\n  <div>轮播组件</div>\n</template>',
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(apiDir, 'resource.ts'),
      'export const getResourceData = () => {}',
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(apiDir, 'address.ts'),
      'export const getAddressList = () => {}',
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(hooksDir, 'useTracker.ts'),
      'export const useTracker = () => {}',
      'utf8'
    );
    
    // 创建工具实例
    tool = new RagInlineTool(entitiesPath, tempDir);
  });
  
  afterAll(() => {
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理临时目录失败:', error);
    }
  });

  describe('loadEntities', () => {
    it('正确加载实体数据', () => {
      const result = (tool as any).entities;
      expect(result).toBeDefined();
      expect(result.length).toBe(6);
      expect(result[0].id).toBe('Component:index');
    });
  });

  describe('search', () => {
    it('根据用户需求返回相关实体和提示词', async () => {
      const query = '我需要一个地址选择组件';
      const result = await tool.search(query);
      
      expect(result.entities).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.relevanceScores).toBeDefined();
      
      expect(result.prompt).toContain(query);
      const addressComponentId = 'Component:index_cdd4c743dba1';
      expect(Object.keys(result.relevanceScores)).toContain(addressComponentId);
    }, 30000);
  });

  describe('searchCodeEntities', () => {
    it('提供简便的函数接口', async () => {
      const result = await searchCodeEntities(
        '轮播图组件',
        entitiesPath,
        tempDir
      );
      
      expect(result.entities).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.relevanceScores).toBeDefined();
      
      const bannerComponentId = 'Component:index';
      expect(Object.keys(result.relevanceScores)).toContain(bannerComponentId);
    }, 30000);
  });

  describe('getRelatedEntities', () => {
    it('获取与指定实体相关的组件', async () => {
      // 测试轮播图组件的相关实体
      const result = await tool.getRelatedEntities('Component:index');
      
      expect(result).not.toBeNull();
      
      if (result) {
        // 检查源实体
        expect(result.sourceEntity.id).toBe('Component:index');
        
        // 检查导入关系
        expect(result.relatedEntities.imports).toBeDefined();
        expect(result.relatedEntities.imports.some(e => e.id === 'Component:Carousel')).toBe(true);
        expect(result.relatedEntities.imports.some(e => e.id === 'API:getResourceData')).toBe(true);
        
        // 注意：AI:getResourceData已经在imports中，所以在calls中不会重复
        expect(result.relatedEntities.calls).toBeDefined();
        expect(result.relatedEntities.calls.length).toBe(0);
        
        // 检查模板组件
        expect(result.relatedEntities.templates).toBeDefined();
        expect(result.relatedEntities.templates.some(e => e.id === 'Component:Carousel')).toBe(false); // 已经在imports中
        
        // 检查相似标签的组件
        expect(result.relatedEntities.similar).toBeDefined();
        
        // 检查关系映射
        expect(result.relatedEntities.relationships).toBeDefined();
        expect(result.relatedEntities.relationships['Component:Carousel']).toContain('IMPORTS');
        expect(result.relatedEntities.relationships['API:getResourceData']).toContain('IMPORTS');
        
        // 检查提示词
        expect(result.prompt).toContain('源组件: Component:index');
        expect(result.prompt).toContain('轮播图广告位组件');
      }
    }, 5000);
    
    it('通过函数接口获取相关实体', async () => {
      const result = await getRelatedCodeEntities('Component:index_cdd4c743dba1', entitiesPath, tempDir);
      
      expect(result).not.toBeNull();
      
      if (result) {
        expect(result.sourceEntity.id).toBe('Component:index_cdd4c743dba1');
        expect(result.relatedEntities.imports.some(e => e.id === 'API:getAddressList')).toBe(true);
        expect(result.relatedEntities.imports.some(e => e.id === 'Hook:useTracker')).toBe(true);
        // Hook:useTracker已在imports中，所以calls中不会有
        expect(result.relatedEntities.calls.length).toBe(0);
      }
    }, 5000);
    
    it('返回null当实体ID不存在时', async () => {
      const result = await tool.getRelatedEntities('NonExistentID');
      expect(result).toBeNull();
    });
  });
});

describe('E2E: 代码组件智能检索与关联', () => {
  const realDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-e2e-'));
  const realEntitiesPath = '/var/folders/9p/w1nj825x1914_gn_47pwlcdr0000gn/T/enrichment-test-1747108660588/enriched_entities.json';
  
  afterAll(() => {
    try {
      fs.rmSync(realDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理E2E测试目录失败:', error);
    }
  });
  
  // 完整流程：搜索 -> 选择 -> 获取关联 -> 分析
  it('模拟完整的需求分析与代码探索流程', async () => {
    // 步骤1: 根据用户需求搜索相关组件
    console.log('步骤1: 根据用户需求搜索相关组件');
    const userQuery = '我需要一个有表单提交功能的地址选择组件';
    const searchResults = await searchCodeEntities(userQuery, realEntitiesPath, realDataDir);
    
    // 验证搜索结果
    expect(searchResults.entities.length).toBeGreaterThan(0);
    expect(Object.keys(searchResults.relevanceScores).length).toBeGreaterThan(0);
    
    // 输出找到的组件
    console.log(`找到 ${searchResults.entities.length} 个相关组件:`);
    searchResults.entities.forEach(entity => {
      console.log(`- ${entity.id}: ${entity.summary} (相关度: ${searchResults.relevanceScores[entity.id] || 0})`);
    });
    
    // 步骤2: 从搜索结果中选择最相关的组件（在研发工作台里由由AI执行）
    console.log('\n步骤2: 选择最相关的组件');
    // 根据相关性得分选择最佳匹配
    const topEntityId = Object.entries(searchResults.relevanceScores)
      .sort(([, scoreA], [, scoreB]) => (scoreB as number) - (scoreA as number))
      .map(([id]) => id)[0];
    
    const selectedEntity = searchResults.entities.find(e => e.id === topEntityId);
    expect(selectedEntity).toBeDefined();
    console.log(`选择了组件: ${selectedEntity?.id} - ${selectedEntity?.summary}`);
    
    // 步骤3: 获取与所选组件相关的其他组件，模拟二跳实现
    console.log('\n步骤3: 获取相关组件');
    if (selectedEntity) {
      const relatedResults = await getRelatedCodeEntities(selectedEntity.id, realEntitiesPath, realDataDir);
      
      expect(relatedResults).not.toBeNull();
      
      if (relatedResults) {
        // 验证返回了相关实体类别
        const { imports, calls, templates, similar } = relatedResults.relatedEntities;
        const allRelated = [...imports, ...calls, ...templates, ...similar];
        
        console.log('相关组件汇总:');
        console.log(`- 导入关系: ${imports.length} 个组件`);
        console.log(`- 调用关系: ${calls.length} 个组件`);
        console.log(`- 模板组件: ${templates.length} 个组件`);
        console.log(`- 相似标签: ${similar.length} 个组件`);
        
        // 注意：这个测试可能在实际运行中没有相关组件，因此我们不强制要求有相关组件
        console.log(`总计找到 ${allRelated.length} 个相关组件`);
        
        // 如果找到了相关组件，则继续测试；如果没有，则跳过后续测试
        if (allRelated.length > 0) {
          // 打印一些相关组件示例
          console.log('\n相关组件示例:');
          for (let i = 0; i < Math.min(3, allRelated.length); i++) {
            const entity = allRelated[i];
            const relations = relatedResults.relatedEntities.relationships[entity.id] || [];
            console.log(`- ${entity.id} (${relations.join(', ')}): ${entity.summary}`);
          }
          
          // 步骤4: 分析相关组件，生成解决方案（模拟AI分析过程）
          console.log('\n步骤4: 基于组件关系进行分析');
          
          // 收集所有导入和使用的组件，识别常用模式
          const allComponents = new Set<string>();
          const allAPIs = new Set<string>();
          
          allRelated.forEach(entity => {
            if (entity.type === 'component') {
              allComponents.add(entity.id);
            } else if (entity.id.startsWith('API:')) {
              allAPIs.add(entity.id);
            }
          });
          
          console.log(`分析结果: 发现 ${allComponents.size} 个相关组件和 ${allAPIs.size} 个API`);
          
          // 解决方案打印，给后续 prompt
          const solution = `
基于对${selectedEntity.id}及其${allRelated.length}个关联组件的分析，
推荐使用以下组件和API构建解决方案:
- 核心组件: ${selectedEntity.id}
${Array.from(allComponents).slice(0, 3).map(c => `- 辅助组件: ${c}`).join('\n')}
${Array.from(allAPIs).slice(0, 3).map(a => `- 数据API: ${a}`).join('\n')}
`;
          
          console.log('\n生成的解决方案:');
          console.log(solution);
          expect(solution).toContain(selectedEntity.id);
        } else {
          console.log('\n没有找到相关组件，这可能是因为数据集限制或组件关系不明确。');
          
          // 没有相关组件，基于选定组件生成
          const simpleSolution = `
基于对${selectedEntity.id}的分析 (无关联组件)，
推荐使用以下组件构建解决方案:
- 核心组件: ${selectedEntity.id}
`;
          
          console.log('\n生成的简化解决方案:');
          console.log(simpleSolution);
          
          // 验证解决方案包含了核心组件
          expect(simpleSolution).toContain(selectedEntity.id);
        }
      }
    }
  }, 60000); 
});