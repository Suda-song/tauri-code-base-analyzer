const fs = require('fs');
const path = require('path');
const { extractAllEntities } = require('./dist/fileWalker');
const { StaticAnalyzer } = require('./dist/enrichment/staticAnalyzer');

// 创建复杂的 workspace 测试结构
const testWorkspaceStructure = {
  // === 配置文件 ===
  // TypeScript 配置
  'tsconfig.json': {
    "compilerOptions": {
      "target": "ES2020",
      "module": "ESNext",
      "moduleResolution": "node",
      "jsx": "react-jsx",
      "allowJs": true,
      "declaration": false,
      "sourceMap": false,
      "experimentalDecorators": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "strict": false
    },
    "include": ["**/*"],
    "exclude": ["node_modules", "dist"]
  },
  
  // pnpm workspace 配置
  'pnpm-workspace.yaml': `packages:
  - 'packages/*'
  - 'apps/*'
  - 'libs/**'
  - 'tools/shared'
`,
  
  // 根目录 package.json（多种依赖格式）
  'package.json': {
    "name": "test-monorepo-root",
    "private": true,
    "workspaces": [
      "packages/*",
      "apps/*"
    ],
    "dependencies": {
      "@test/shared": "workspace:*",
      "@test/utils": "workspace:^1.0.0",
      "@test/vue-components": "workspace:*",
      "@test/web-app": "workspace:*",
      "local-lib": "workspace:~"
    },
    "devDependencies": {
      "@test/build-tools": "workspace:*"
    }
  },
  
  // === Workspace 包：普通包 ===
  'packages/shared/package.json': {
    "name": "@test/shared",
    "version": "1.0.0",
    "main": "index.ts",
    "dependencies": {
      "@test/utils": "workspace:*"
    }
  },
  'packages/shared/index.ts': `
/**
 * 共享工具模块
 * 提供通用的工具函数
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  return today.getFullYear() - birthDate.getFullYear();
}

// 常量导出
export const APP_VERSION = '1.0.0';
export const DEFAULT_CONFIG = {
  theme: 'light',
  language: 'zh-CN'
};

// 默认导出
export default function createLogger(name: string) {
  return {
    info: (msg: string) => console.log(\`[\${name}] \${msg}\`),
    error: (msg: string) => console.error(\`[\${name}] \${msg}\`)
  };
}
`,
  'packages/shared/types.ts': `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

export class UserService {
  findById(id: string): User | null {
    return null; // 示例实现
  }
  
  create(userData: Omit<User, 'id' | 'createdAt'>): User {
    return {
      id: Math.random().toString(36),
      createdAt: new Date(),
      ...userData
    };
  }
}
`,

  // === Workspace 包：工具包 ===
  'packages/utils/package.json': {
    "name": "@test/utils",
    "version": "1.0.0"
  },
  'packages/utils/helpers.ts': `
import { formatDate } from '@test/shared';

/**
 * 字符串工具函数
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

// 使用其他workspace包
export function getFormattedToday(): string {
  return formatDate(new Date());
}

export const STRING_CONSTANTS = {
  EMPTY: '',
  SPACE: ' ',
  NEWLINE: '\n'
};
`,
  'packages/utils/math.ts': `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export class Calculator {
  private history: number[] = [];
  
  calculate(operation: 'add' | 'multiply', a: number, b: number): number {
    const result = operation === 'add' ? add(a, b) : multiply(a, b);
    this.history.push(result);
    return result;
  }
  
  getHistory(): number[] {
    return [...this.history];
  }
}
`,

  // === Workspace 包：本地库 ===
  'libs/database/orm/package.json': {
    "name": "local-lib",
    "version": "1.0.0"
  },
  'libs/database/orm/index.ts': `
/**
 * 简单的ORM实现
 */
export abstract class BaseEntity {
  abstract id: string;
  createdAt: Date = new Date();
  updatedAt: Date = new Date();
}

export class Repository<T extends BaseEntity> {
  private entities: T[] = [];
  
  save(entity: T): T {
    entity.updatedAt = new Date();
    this.entities.push(entity);
    return entity;
  }
  
  findAll(): T[] {
    return [...this.entities];
  }
}

export const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'test'
};
`,

  // === Workspace 包：构建工具 ===
  'tools/shared/package.json': {
    "name": "@test/build-tools",
    "version": "1.0.0"
  },
  'tools/shared/build.ts': `
import { slugify } from '@test/utils/helpers';

/**
 * 构建工具函数
 */
export function buildProject(projectName: string): void {
  const slug = slugify(projectName);
  console.log(\`Building project: \${slug}\`);
}

export function optimizeAssets(): void {
  console.log('Optimizing assets...');
}

export const BUILD_CONFIG = {
  outputDir: 'dist',
  sourceMap: true,
  minify: true
};
`,

  // === 应用程序 ===
  'apps/web/package.json': {
    "name": "@test/web-app",
    "version": "1.0.0",
    "dependencies": {
      "@test/shared": "workspace:*",
      "@test/utils": "workspace:*",
      "local-lib": "workspace:*"
    }
  },
  'apps/web/src/App.tsx': `
import React from 'react';
import createLogger, { formatDate, APP_VERSION } from '@test/shared';
import { capitalize, getFormattedToday } from '@test/utils/helpers';
import { Calculator } from '@test/utils/math';
import { Repository, BaseEntity } from 'local-lib';

/**
 * 主应用组件
 * 展示workspace包的集成使用
 */
export default function App() {
  const logger = createLogger('App');
  const calc = new Calculator();
  
  React.useEffect(() => {
    logger.info(\`App version: \${APP_VERSION}\`);
    logger.info(\`Today: \${getFormattedToday()}\`);
    
    const result = calc.calculate('add', 1, 2);
    logger.info(\`Calculation result: \${result}\`);
  }, []);

  return (
    <div className="app">
      <h1>{capitalize('welcome to our app')}</h1>
      <p>Version: {APP_VERSION}</p>
      <p>Today: {getFormattedToday()}</p>
    </div>
  );
}

/**
 * 用户管理页面组件
 */
export function UserManagement() {
  return <div>User Management</div>;
}

// 导出一些工具函数
export { formatDate } from '@test/shared';
export { Calculator } from '@test/utils/math';
`,
  'apps/web/src/services/userService.ts': `
import { UserService, User } from '@test/shared/types';
import { Repository } from 'local-lib';

/**
 * 扩展的用户服务
 */
export class ExtendedUserService extends UserService {
  private repository = new Repository<User>();
  
  saveUser(user: User): User {
    return this.repository.save(user);
  }
  
  getAllUsers(): User[] {
    return this.repository.findAll();
  }
}

export function createUserService(): ExtendedUserService {
  return new ExtendedUserService();
}
`,

  // === 非workspace文件（应该被跳过）===
  'node_modules/lodash/index.js': `
module.exports = {
  isString: function(value) {
    return typeof value === 'string';
  }
};
`,
  'external-lib/package.json': {
    "name": "external-lib",
    "version": "1.0.0"
  },
  'external-lib/index.ts': `
export function externalFunction() {
  return 'external';
}
`,

  // === Vue 文件测试 ===
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
import { capitalize } from '@test/utils/helpers';

/**
 * 通用按钮组件
 * 支持多种样式和事件
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
  return \`btn btn-\${props.type}\`;
});

const handleClick = () => {
  emit('click');
};

// 使用workspace包的函数
const formattedText = computed(() => {
  return props.text ? capitalize(props.text) : '';
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
`
};

console.log('🧪 测试 Workspace 全场景功能...\n');

async function runComprehensiveWorkspaceTest() {
  const testDir = path.join(__dirname, 'test-workspace-comprehensive');
  const createdFiles = [];
  
  try {
    // === 1. 创建测试结构 ===
    console.log('📁 创建复杂的 workspace 测试结构...');
    
    for (const [filePath, content] of Object.entries(testWorkspaceStructure)) {
      const fullPath = path.join(testDir, filePath);
      const dir = path.dirname(fullPath);
      
      // 创建目录
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 写入文件
      if (typeof content === 'object') {
        fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
      } else {
        fs.writeFileSync(fullPath, content);
      }
      
      createdFiles.push(fullPath);
    }
    console.log(`✅ 创建了 ${createdFiles.length} 个文件\n`);

    // === 2. 测试文件扫描 ===
    console.log('📊 测试文件扫描功能...\n');
    
    const entities = await extractAllEntities(testDir);
    
    console.log(`📈 扫描结果: 找到 ${entities.length} 个实体\n`);
    
    // 按文件分组显示结果
    const entitiesByFile = {};
    const entitiesByPackage = {};
    
    for (const entity of entities) {
      const relativePath = path.relative(testDir, path.join(testDir, entity.file));
      if (!entitiesByFile[relativePath]) {
        entitiesByFile[relativePath] = [];
      }
      entitiesByFile[relativePath].push(entity);
      
      // 按包分组
      let packageName = 'root';
      if (relativePath.startsWith('packages/')) {
        packageName = relativePath.split('/')[1];
      } else if (relativePath.startsWith('apps/')) {
        packageName = `apps/${relativePath.split('/')[1]}`;
      } else if (relativePath.startsWith('libs/')) {
        packageName = 'libs/database/orm';
      } else if (relativePath.startsWith('tools/')) {
        packageName = 'tools/shared';
      }
      
      if (!entitiesByPackage[packageName]) {
        entitiesByPackage[packageName] = [];
      }
      entitiesByPackage[packageName].push(entity);
    }
    
    console.log('📄 按 Workspace 包分组的实体:');
    for (const [packageName, packageEntities] of Object.entries(entitiesByPackage)) {
      console.log(`\n📦 ${packageName} (${packageEntities.length} 个实体):`);
      for (const entity of packageEntities) {
        console.log(`  ├── ${entity.id} (${entity.type}) - ${entity.rawName}`);
      }
    }

    // === 3. 验证文件扫描正确性 ===
    console.log('\n✅ 验证文件扫描正确性:');
    
    const expectedPackages = [
      'packages/shared', 'packages/utils', 'packages/vue-components',
      'libs/database/orm', 'tools/shared', 'apps/web'
    ];
    
    const unexpectedPaths = [
      'node_modules', 'external-lib'
    ];
    
    let scanPassCount = 0;
    let scanTotalTests = expectedPackages.length + unexpectedPaths.length;
    
    // 检查应该包含的包
    for (const expectedPkg of expectedPackages) {
      const found = Object.keys(entitiesByFile).some(file => file.includes(expectedPkg));
      if (found) {
        console.log(`  ✅ 正确扫描: ${expectedPkg}`);
        scanPassCount++;
      } else {
        console.log(`  ❌ 缺失包: ${expectedPkg}`);
      }
    }
    
    // 检查不应该包含的路径
    for (const unexpectedPath of unexpectedPaths) {
      const found = Object.keys(entitiesByFile).some(file => file.includes(unexpectedPath));
      if (!found) {
        console.log(`  ✅ 正确跳过: ${unexpectedPath}`);
        scanPassCount++;
      } else {
        console.log(`  ❌ 意外包含: ${unexpectedPath}`);
      }
    }

    // === 4. 测试依赖分析 ===
    console.log('\n🔍 测试依赖分析功能...\n');
    
    const analyzer = new StaticAnalyzer(testDir, entities);
    const dependencyTests = [];
    
    // 测试几个关键文件的依赖分析
    const testFiles = [
      { name: 'App.tsx', entity: entities.find(e => e.rawName === 'App' && e.file.includes('App.tsx')) },
      { name: 'helpers.ts', entity: entities.find(e => e.rawName === 'getFormattedToday' && e.file.includes('helpers.ts')) },
      { name: 'userService.ts', entity: entities.find(e => e.rawName === 'ExtendedUserService' && e.file.includes('userService.ts')) }
    ];
    
    for (const testFile of testFiles) {
      if (testFile.entity) {
        console.log(`📋 分析 ${testFile.name} (${testFile.entity.id}):`);
        
        try {
          const result = await analyzer.analyzeEntity(testFile.entity);
          
          console.log(`  📥 导入 (${result.IMPORTS?.length || 0}):`, result.IMPORTS || []);
          console.log(`  📞 调用 (${result.CALLS?.length || 0}):`, result.CALLS || []);
          console.log(`  📡 事件 (${result.EMITS?.length || 0}):`, result.EMITS || []);
          console.log(`  💬 注释:`, result.ANNOTATION || '无');
          
          dependencyTests.push({
            file: testFile.name,
            entity: testFile.entity.id,
            hasImports: (result.IMPORTS?.length || 0) > 0,
            hasCalls: (result.CALLS?.length || 0) > 0,
            hasAnnotation: !!result.ANNOTATION,
            imports: result.IMPORTS || [],
            calls: result.CALLS || []
          });
          
        } catch (error) {
          console.log(`  ⚠️  分析失败: ${error.message}`);
          dependencyTests.push({
            file: testFile.name,
            entity: testFile.entity.id,
            error: error.message
          });
        }
        console.log('');
      }
    }

    // === 5. 验证依赖分析正确性 ===
    console.log('✅ 验证依赖分析正确性:');
    
    let depPassCount = 0;
    let depTotalTests = 0;
    
    // 验证App.tsx应该有workspace依赖
    const appTest = dependencyTests.find(t => t.file === 'App.tsx');
    if (appTest && !appTest.error) {
      depTotalTests += 3;
      
      // 应该有从@test/shared的导入
      const hasSharedImport = appTest.imports.some(imp => imp.includes('shared'));
      if (hasSharedImport) {
        console.log('  ✅ App.tsx 正确导入 @test/shared');
        depPassCount++;
      } else {
        console.log('  ❌ App.tsx 缺少 @test/shared 导入');
      }
      
      // 应该有从@test/utils的导入
      const hasUtilsImport = appTest.imports.some(imp => imp.includes('utils'));
      if (hasUtilsImport) {
        console.log('  ✅ App.tsx 正确导入 @test/utils');
        depPassCount++;
      } else {
        console.log('  ❌ App.tsx 缺少 @test/utils 导入');
      }
      
      // 应该有函数调用
      if (appTest.hasCalls) {
        console.log('  ✅ App.tsx 检测到函数调用');
        depPassCount++;
      } else {
        console.log('  ❌ App.tsx 未检测到函数调用');
      }
    }
    
    // 验证helpers.ts应该有workspace依赖
    const helpersTest = dependencyTests.find(t => t.file === 'helpers.ts');
    if (helpersTest && !helpersTest.error) {
      depTotalTests += 1;
      
      const hasSharedImport = helpersTest.imports.some(imp => imp.includes('shared'));
      if (hasSharedImport) {
        console.log('  ✅ helpers.ts 正确导入 @test/shared');
        depPassCount++;
      } else {
        console.log('  ❌ helpers.ts 缺少 @test/shared 导入');
      }
    }

    // === 6. 综合统计 ===
    console.log('\n📊 综合测试统计:');
    
    const scanPassRate = Math.round((scanPassCount / scanTotalTests) * 100);
    console.log(`📁 文件扫描: ${scanPassCount}/${scanTotalTests} (${scanPassRate}%)`);
    
    const depPassRate = depTotalTests > 0 ? Math.round((depPassCount / depTotalTests) * 100) : 0;
    console.log(`🔍 依赖分析: ${depPassCount}/${depTotalTests} (${depPassRate}%)`);
    
    // 实体类型统计
    const typeStats = {};
    for (const entity of entities) {
      typeStats[entity.type] = (typeStats[entity.type] || 0) + 1;
    }
    
    console.log('\n📊 实体类型分布:');
    for (const [type, count] of Object.entries(typeStats)) {
      console.log(`  ${type}: ${count}个`);
    }
    
    // 工作区包统计
    console.log('\n📦 Workspace 包统计:');
    for (const [packageName, packageEntities] of Object.entries(entitiesByPackage)) {
      console.log(`  ${packageName}: ${packageEntities.length}个实体`);
    }
    
    const overallPassRate = Math.round(((scanPassCount + depPassCount) / (scanTotalTests + depTotalTests)) * 100);
    console.log(`\n🎯 总体通过率: ${overallPassRate}%`);
    
    if (overallPassRate >= 90) {
      console.log('🎉 Workspace 功能完全正常！');
    } else if (overallPassRate >= 70) {
      console.log('✅ Workspace 功能基本正常，有少量问题。');
    } else {
      console.log('⚠️  Workspace 功能存在问题，需要进一步优化。');
    }
    
    // === 7. 详细问题分析 ===
    if (overallPassRate < 100) {
      console.log('\n🔍 问题分析:');
      
      // 分析扫描问题
      if (scanPassRate < 100) {
        console.log('📁 文件扫描问题:');
        console.log('  - 检查workspace配置解析是否正确');
        console.log('  - 验证glob模式匹配逻辑');
        console.log('  - 确认真实路径解析');
      }
      
      // 分析依赖问题
      if (depPassRate < 100) {
        console.log('🔍 依赖分析问题:');
        console.log('  - 检查模块路径解析');
        console.log('  - 验证workspace包名匹配');
        console.log('  - 确认导入语句解析');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败：', error.message);
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

runComprehensiveWorkspaceTest(); 