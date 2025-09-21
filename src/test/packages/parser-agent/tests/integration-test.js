const fs = require('fs');
const path = require('path');
const { extractAllEntities } = require('../dist/fileWalker');
const { StaticAnalyzer } = require('../dist/enrichment/staticAnalyzer');

console.log('🧪 全链路集成测试 - TS/TSX/Vue提取 + Workspace + 依赖分析\n');

async function runIntegrationTest() {
  const testDir = path.join(__dirname, 'integration-test-workspace');
  
  try {
    // === 1. 创建Workspace测试结构 ===
    console.log('📁 创建Workspace测试结构...');
    
    const testStructure = {
      // 根配置文件
      'package.json': {
        "name": "integration-test",
        "workspaces": ["packages/*", "apps/*"],
        "dependencies": {
          "@test/utils": "workspace:*",
          "@test/components": "workspace:*",
          "@test/web-app": "workspace:*",
          "@test/vue-components": "workspace:*"
        }
      },
      'pnpm-workspace.yaml': `packages:
  - packages/*
  - apps/*`,
      
      // === 工具包 (TS) ===
      'packages/utils/package.json': {
        "name": "@test/utils",
        "version": "1.0.0",
        "main": "index.ts"
      },
      'packages/utils/index.ts': `
/**
 * 工具函数库
 * 提供各种实用工具
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

export default function createLogger(name: string) {
  return {
    info: (msg: string) => console.log(\`[\${name}] \${msg}\`),
    error: (msg: string) => console.error(\`[\${name}] \${msg}\`)
  };
}

export const API_CONFIG = {
  baseUrl: 'https://api.test.com',
  timeout: 5000
};

export class DataValidator {
  validate(data: any): boolean {
    return data != null;
  }
}

// 内部函数
function internalHelper() {
  return 'helper';
}

const CONSTANTS = {
  MAX_RETRY: 3,
  DEFAULT_LANG: 'zh-CN'
};

export { CONSTANTS };
`,
      'packages/utils/math.ts': `
/**
 * 数学工具函数
 */
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export class Calculator {
  calculate(op: string, a: number, b: number): number {
    switch(op) {
      case 'add': return add(a, b);
      case 'multiply': return multiply(a, b);
      default: return 0;
    }
  }
}
`,
      
      // === 组件包 (TSX) ===
      'packages/components/package.json': {
        "name": "@test/components",
        "version": "1.0.0",
        "main": "index.tsx"
      },
      'packages/components/index.tsx': `
import React from 'react';
import { formatDate } from '@test/utils';

/**
 * 按钮组件
 */
export default function Button({ children, onClick }: any) {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
}

/**
 * 卡片组件
 */
export function Card({ title, content }: any) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{content}</p>
      <span>Created: {formatDate(new Date())}</span>
    </div>
  );
}

export function Modal({ isOpen, children }: any) {
  if (!isOpen) return null;
  return <div className="modal">{children}</div>;
}

export const IconButton = ({ icon, ...props }: any) => (
  <button {...props}>
    <span className="icon">{icon}</span>
  </button>
);

// 工具函数
export function createComponent(type: string) {
  return React.createElement(type);
}

export class ComponentRegistry {
  private components = new Map();
  
  register(name: string, component: any) {
    this.components.set(name, component);
  }
}

const THEME_CONFIG = {
  primary: '#007bff',
  secondary: '#6c757d'
};

export { THEME_CONFIG };
`,
      
      // === Vue组件包 ===
      'packages/vue-components/package.json': {
        "name": "@test/vue-components",
        "version": "1.0.0"
      },
      'packages/vue-components/Button.vue': `
<template>
  <button @click="handleClick" :class="buttonClass">
    <slot>{{ text }}</slot>
  </button>
</template>

<script setup>
import { ref, computed } from 'vue';
import { formatDate } from '@test/utils';

/**
 * Vue按钮组件
 * 提供可定制的按钮功能
 */
const props = defineProps({
  text: String,
  type: {
    type: String,
    default: 'primary'
  }
});

const emit = defineEmits(['click']);

const isLoading = ref(false);

const buttonClass = computed(() => {
  return \`btn btn-\${props.type} \${isLoading.value ? 'loading' : ''}\`;
});

const handleClick = () => {
  emit('click');
};

// 格式化显示时间
const formattedTime = computed(() => {
  return formatDate(new Date());
});
</script>

<style scoped>
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
`,
      
      // === 应用 (TSX，使用其他包) ===
      'apps/web/package.json': {
        "name": "@test/web-app",
        "version": "1.0.0",
        "dependencies": {
          "@test/utils": "workspace:*",
          "@test/components": "workspace:*",
          "@test/vue-components": "workspace:*"
        }
      },
      'apps/web/App.tsx': `
import React, { useEffect } from 'react';
import createLogger, { formatDate, calculateAge, API_CONFIG } from '@test/utils';
import { add, Calculator } from '@test/utils/math';
import Button, { Card, Modal, IconButton } from '@test/components';

/**
 * 主应用组件
 * 整合所有workspace包的功能
 */
export default function App() {
  const logger = createLogger('App');
  const calc = new Calculator();
  
  useEffect(() => {
    // 使用工具函数
    const today = formatDate(new Date());
    const age = calculateAge(1990);
    const result = add(1, 2);
    const calcResult = calc.calculate('multiply', 5, 3);
    
    logger.info(\`Today: \${today}\`);
    logger.info(\`Age: \${age}\`);
    logger.info(\`Add result: \${result}\`);
    logger.info(\`Calc result: \${calcResult}\`);
    logger.info(\`API URL: \${API_CONFIG.baseUrl}\`);
  }, []);

  return (
    <div className="app">
      <h1>Integration Test App</h1>
      <Button onClick={() => logger.info('Button clicked')}>
        Click Me
      </Button>
      <Card 
        title="Test Card"
        content="This is a test card component"
      />
      <Modal isOpen={true}>
        <p>Modal content</p>
      </Modal>
      <IconButton icon="★" onClick={() => {}} />
    </div>
  );
}

/**
 * 用户管理组件
 */
export function UserManager() {
  const logger = createLogger('UserManager');
  
  const handleCreateUser = () => {
    logger.info('Creating user...');
  };
  
  return (
    <div>
      <h2>User Management</h2>
      <Button onClick={handleCreateUser}>Create User</Button>
    </div>
  );
}

// 导出工具函数供其他地方使用
export { formatDate } from '@test/utils';
export { Calculator } from '@test/utils/math';
`,
      
      // === 服务层 (TS，使用其他包) ===
      'apps/web/services/api.ts': `
import { API_CONFIG, DataValidator } from '@test/utils';
import { formatDate } from '@test/utils';

/**
 * API服务类
 * 处理所有HTTP请求
 */
export class ApiService {
  private baseUrl = API_CONFIG.baseUrl;
  private validator = new DataValidator();
  
  async fetchUser(id: string) {
    const url = \`\${this.baseUrl}/users/\${id}\`;
    console.log(\`Fetching user from: \${url}\`);
    
    // 模拟API调用
    const userData = { id, name: 'Test User', createdAt: formatDate(new Date()) };
    
    if (this.validator.validate(userData)) {
      return userData;
    }
    
    throw new Error('Invalid user data');
  }
  
  async createUser(userData: any) {
    const validatedData = this.validator.validate(userData);
    if (!validatedData) {
      throw new Error('Invalid user data');
    }
    
    console.log('Creating user:', userData);
    return { ...userData, id: Math.random().toString(36), createdAt: formatDate(new Date()) };
  }
}

export function createApiService(): ApiService {
  return new ApiService();
}

export const apiInstance = new ApiService();
`,
    };

    // 创建文件结构
    const createdFiles = [];
    for (const [filePath, content] of Object.entries(testStructure)) {
      const fullPath = path.join(testDir, filePath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      if (typeof content === 'object') {
        fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
      } else {
        fs.writeFileSync(fullPath, content);
      }
      
      createdFiles.push(fullPath);
    }
    
    console.log(`✅ 创建了 ${createdFiles.length} 个文件\n`);

    // === 2. 测试实体提取 ===
    console.log('📊 测试实体提取...');
    const entities = await extractAllEntities(testDir);
    
    console.log(`✅ 提取成功！共 ${entities.length} 个实体\n`);
    
    // 按类型统计
    const typeStats = {};
    const fileStats = {};
    
    entities.forEach(entity => {
      typeStats[entity.type] = (typeStats[entity.type] || 0) + 1;
      const ext = path.extname(entity.file);
      fileStats[ext] = (fileStats[ext] || 0) + 1;
    });
    
    console.log('📈 类型统计:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}个`);
    });
    
    console.log('\n📁 文件类型统计:');
    Object.entries(fileStats).forEach(([ext, count]) => {
      console.log(`  ${ext || '无扩展名'}: ${count}个`);
    });
    
    // 显示部分实体
    console.log('\n📄 部分实体示例:');
    entities.slice(0, 10).forEach(entity => {
      console.log(`  ${entity.id} (${entity.type}) - ${entity.rawName} in ${entity.file}`);
    });
    
    if (entities.length > 10) {
      console.log(`  ... 还有 ${entities.length - 10} 个实体`);
    }

    // === 3. 测试依赖分析 ===
    console.log('\n🔍 测试依赖分析...');
    const analyzer = new StaticAnalyzer(testDir, entities);
    
    // 选择几个关键文件进行依赖分析
    const testTargets = [
      { name: 'App.tsx', entity: entities.find(e => e.rawName === 'App' && e.file.includes('App.tsx')) },
      { name: 'api.ts', entity: entities.find(e => e.rawName === 'ApiService' && e.file.includes('api.ts')) },
      { name: 'Button.vue', entity: entities.find(e => e.file.includes('Button.vue')) }
    ];
    
    const analysisResults = [];
    
    for (const target of testTargets) {
      if (target.entity) {
        console.log(`\n📋 分析 ${target.name} (${target.entity.id}):`);
        
        try {
          const result = await analyzer.analyzeEntity(target.entity);
          
          console.log(`  📥 导入 (${result.IMPORTS?.length || 0}):`, result.IMPORTS || []);
          console.log(`  📞 调用 (${result.CALLS?.length || 0}):`, result.CALLS || []);
          console.log(`  📡 事件 (${result.EMITS?.length || 0}):`, result.EMITS || []);
          if (result.TEMPLATE_COMPONENTS?.length > 0) {
            console.log(`  🎨 模板组件 (${result.TEMPLATE_COMPONENTS.length}):`, result.TEMPLATE_COMPONENTS);
          }
          console.log(`  💬 注释:`, result.ANNOTATION ? result.ANNOTATION.substring(0, 50) + '...' : '无');
          
          analysisResults.push({
            file: target.name,
            entity: target.entity.id,
            imports: result.IMPORTS || [],
            calls: result.CALLS || [],
            emits: result.EMITS || [],
            hasAnnotation: !!result.ANNOTATION
          });
          
        } catch (error) {
          console.log(`  ⚠️  分析失败: ${error.message}`);
          analysisResults.push({
            file: target.name,
            entity: target.entity.id,
            error: error.message
          });
        }
      } else {
        console.log(`\n❌ 未找到 ${target.name} 对应的实体`);
      }
    }

    // === 4. 验证ID匹配性 ===
    console.log('\n✅ 验证实体ID一致性...');
    const extractedIds = new Set(entities.map(e => e.id));
    
    let totalImports = 0;
    let matchedImports = 0;
    let totalCalls = 0;
    let matchedCalls = 0;
    
    for (const result of analysisResults.filter(r => !r.error)) {
      // 验证导入ID
      for (const importId of result.imports) {
        totalImports++;
        if (extractedIds.has(importId)) {
          matchedImports++;
          console.log(`  ✅ 导入匹配: ${importId}`);
        } else {
          console.log(`  ❌ 导入不匹配: ${importId}`);
          // 查找可能的匹配
          const similarIds = entities.filter(e => 
            importId.includes(e.rawName) || e.rawName.includes(importId.split(':')[1])
          );
          if (similarIds.length > 0) {
            console.log(`    可能匹配: ${similarIds.map(e => e.id).join(', ')}`);
          }
        }
      }
      
      // 验证调用ID
      for (const callId of result.calls) {
        totalCalls++;
        if (extractedIds.has(callId) || extractedIds.has(callId.split('.')[0])) {
          matchedCalls++;
          console.log(`  ✅ 调用匹配: ${callId}`);
        } else {
          console.log(`  ❌ 调用不匹配: ${callId}`);
        }
      }
    }

    // === 5. 最终统计 ===
    console.log('\n📊 最终测试统计:');
    console.log(`📁 文件创建: ${createdFiles.length} 个`);
    console.log(`🔍 实体提取: ${entities.length} 个`);
    console.log(`📋 依赖分析: ${analysisResults.filter(r => !r.error).length}/${analysisResults.length} 成功`);
    
    const importMatchRate = totalImports > 0 ? Math.round((matchedImports / totalImports) * 100) : 100;
    const callMatchRate = totalCalls > 0 ? Math.round((matchedCalls / totalCalls) * 100) : 100;
    
    console.log(`🔗 导入ID匹配: ${matchedImports}/${totalImports} (${importMatchRate}%)`);
    console.log(`📞 调用ID匹配: ${matchedCalls}/${totalCalls} (${callMatchRate}%)`);
    
    const overallScore = Math.round((
      (entities.length > 0 ? 100 : 0) * 0.4 +  // 实体提取权重40%
      (analysisResults.filter(r => !r.error).length / analysisResults.length * 100) * 0.3 +  // 依赖分析权重30%
      importMatchRate * 0.2 +  // 导入匹配权重20%
      callMatchRate * 0.1   // 调用匹配权重10%
    ));
    
    console.log(`\n🎯 总体得分: ${overallScore}%`);
    
    if (overallScore >= 90) {
      console.log('🎉 全链路测试完美通过！');
    } else if (overallScore >= 75) {
      console.log('✅ 全链路测试基本通过，有轻微问题。');
    } else {
      console.log('⚠️  全链路测试需要进一步优化。');
    }
    
  } catch (error) {
    console.error('❌ 集成测试失败：', error.message);
    console.error(error.stack);
  } finally {
    // 清理测试文件
    console.log('\n🧹 清理测试文件...');
    
    function deleteRecursive(dirPath) {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    }
    
    try {
      deleteRecursive(testDir);
      console.log('✅ 清理完成');
    } catch (error) {
      console.log('⚠️  清理时出现错误:', error.message);
    }
  }
}

runIntegrationTest(); 