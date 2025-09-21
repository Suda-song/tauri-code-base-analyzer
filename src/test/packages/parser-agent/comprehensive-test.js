const fs = require('fs');
const path = require('path');
const { StaticAnalyzer } = require('./dist/enrichment/staticAnalyzer');
const { FunctionExtractor } = require('./dist/extractors/FunctionExtractor');
const { TSXExtractor } = require('./dist/extractors/TSXExtractor');
const { VueExtractor } = require('./dist/extractors/VueExtractor');

// 创建全面的测试文件
const testFiles = {
  // TS文件 - 测试各种导出方式
  'components/Button.ts': `
/**
 * 按钮组件
 */
export default function Button() {
  return new Element();
}

export function HelperFunction() {
  return "helper";
}

export class ButtonController {
  control() {}
}

export const API_BASE_URL = 'https://api.example.com';
export const SmallButton = () => new Element();

const CONFIG_OPTIONS = { theme: 'dark' };
const utilHelper = () => "util";

export { CONFIG_OPTIONS, utilHelper };
`,

  // TSX文件 - 测试React组件
  'components/Modal.tsx': `
import React from 'react';

/**
 * 模态框组件
 */
export default function Modal() {
  return <div className="modal">模态框</div>;
}

export function CloseButton() {
  return <button>关闭</button>;
}

export class ModalManager {
  show() {}
}

export const MODAL_TYPES = ['info', 'warning', 'error'];
export const IconButton = () => <button>图标</button>;

const modalConfig = { zIndex: 1000 };
const modalHelper = () => "helper";

export { modalConfig, modalHelper };
`,

  // Vue文件 - 测试Vue组件
  'components/Card.vue': `
<template>
  <div class="card">
    <h3>{{ title }}</h3>
    <p>{{ content }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

/**
 * 卡片组件
 */
const title = ref('卡片标题');
const content = ref('卡片内容');

const handleClick = () => {
  console.log('卡片被点击');
};

export { handleClick };
</script>
`,

  // 工具函数文件
  'utils/helpers.ts': `
export function formatDate(date) {
  return date.toISOString();
}

export function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export class Logger {
  log(message) {
    console.log(message);
  }
}

export const DEFAULT_TIMEOUT = 5000;
export const createValidator = () => ({});

const internalConfig = { debug: false };
const internalHelper = () => "internal";

export { internalConfig, internalHelper };
`,

  // 常量文件
  'constants/api.ts': `
export const API_ENDPOINTS = {
  users: '/api/users',
  posts: '/api/posts'
};

export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404
};

export default function getBaseUrl() {
  return 'https://api.example.com';
}

export class ApiClient {
  constructor() {}
}

const INTERNAL_CONFIG = { version: '1.0' };
export { INTERNAL_CONFIG };
`,

  // 类文件
  'services/UserService.ts': `
export default class UserService {
  getUser(id) {
    return fetch(\`/api/users/\${id}\`);
  }
}

export class AuthService {
  login(credentials) {}
}

export function createUserService() {
  return new UserService();
}

export const USER_ROLES = ['admin', 'user'];

const serviceConfig = { retries: 3 };
export { serviceConfig };
`
};

// 创建全面的导入测试文件
const importTestFiles = {
  'test-imports.ts': `
// 测试各种导入方式
import Button from './components/Button';
import { HelperFunction, ButtonController, API_BASE_URL, SmallButton, CONFIG_OPTIONS } from './components/Button';

import Modal from './components/Modal.tsx';
import { CloseButton, ModalManager, MODAL_TYPES, IconButton, modalConfig } from './components/Modal.tsx';

import Card from './components/Card.vue';

import { formatDate, validateEmail, Logger, DEFAULT_TIMEOUT, createValidator, internalConfig } from './utils/helpers';

import getBaseUrl from './constants/api';
import { API_ENDPOINTS, HTTP_STATUS, ApiClient, INTERNAL_CONFIG } from './constants/api';

import UserService from './services/UserService';
import { AuthService, createUserService, USER_ROLES, serviceConfig } from './services/UserService';

// 调用函数测试
HelperFunction();
formatDate(new Date());
validateEmail('test@example.com');
createValidator();
createUserService();
`,

  'test-calls.tsx': `
import React from 'react';
import Button from './components/Button';
import { HelperFunction } from './components/Button';
import Modal from './components/Modal.tsx';
import { CloseButton } from './components/Modal.tsx';

export default function App() {
  const handleClick = () => {
    HelperFunction();
    // 其他调用
  };

  return (
    <div>
      <Modal />
      <CloseButton />
    </div>
  );
}
`
};

console.log('🧪 全面测试 StaticAnalyzer 的 generateEntityId 方法...\n');

async function runComprehensiveTest() {
  const testDir = __dirname;
  const createdFiles = [];
  
  try {
    // 创建目录结构
    const dirs = ['components', 'utils', 'constants', 'services'];
    for (const dir of dirs) {
      const dirPath = path.join(testDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // 写入所有测试文件
    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = path.join(testDir, filePath);
      fs.writeFileSync(fullPath, content);
      createdFiles.push(fullPath);
    }
    
    for (const [filePath, content] of Object.entries(importTestFiles)) {
      const fullPath = path.join(testDir, filePath);
      fs.writeFileSync(fullPath, content);
      createdFiles.push(fullPath);
    }

    // 提取所有实体
    const allEntities = [];
    const fileStats = {
      ts: 0,
      tsx: 0,
      vue: 0,
      entities: 0
    };
    
    console.log('📊 提取实体中...\n');
    
    for (const [filePath] of Object.entries(testFiles)) {
      const fullPath = path.join(testDir, filePath);
      let entities = [];
      
      if (filePath.endsWith('.ts')) {
        entities = FunctionExtractor.extract(fullPath, testDir);
        fileStats.ts++;
      } else if (filePath.endsWith('.tsx')) {
        entities = TSXExtractor.extract(fullPath, testDir);
        fileStats.tsx++;
      } else if (filePath.endsWith('.vue')) {
        entities = VueExtractor.extract(fullPath, testDir);
        fileStats.vue++;
      }
      
      allEntities.push(...entities);
      fileStats.entities += entities.length;
      
      console.log(`📁 ${filePath}:`);
      entities.forEach(entity => {
        console.log(`  ├── ${entity.id} (${entity.type}) - ${entity.rawName}`);
      });
      console.log('');
    }
    
    console.log(`📈 提取统计: ${fileStats.ts} TS文件, ${fileStats.tsx} TSX文件, ${fileStats.vue} Vue文件`);
    console.log(`📦 总计: ${fileStats.entities} 个实体\n`);

    // 创建StaticAnalyzer实例
    const analyzer = new StaticAnalyzer(testDir, allEntities);
    
    // 测试所有导入场景
    console.log('🔍 测试 generateEntityId 方法...\n');
    
    const testResults = [];
    
    for (const [fileName] of Object.entries(importTestFiles)) {
      console.log(`📄 分析 ${fileName}:`);
      
      const dummyEntity = {
        id: `Function:${path.basename(fileName, path.extname(fileName))}`,
        type: 'function',
        file: fileName,
        rawName: path.basename(fileName, path.extname(fileName)),
        loc: { start: 1, end: 1 }
      };
      
      const result = await analyzer.analyzeEntity(dummyEntity);
      
      console.log(`  IMPORTS (${result.IMPORTS.length}):`, result.IMPORTS);
      console.log(`  CALLS (${result.CALLS.length}):`, result.CALLS);
      console.log('');
      
      testResults.push({
        file: fileName,
        imports: result.IMPORTS,
        calls: result.CALLS
      });
    }
    
    // 验证所有实体ID匹配
    console.log('✅ 验证实体ID匹配:\n');
    
    const extractedIds = new Set(allEntities.map(e => e.id));
    let totalImports = 0;
    let matchedImports = 0;
    let totalCalls = 0;
    let matchedCalls = 0;
    
    for (const result of testResults) {
      console.log(`📄 ${result.file}:`);
      
      // 验证导入
      console.log('  导入验证:');
      for (const importId of result.imports) {
        totalImports++;
        if (extractedIds.has(importId)) {
          console.log(`    ✅ ${importId}`);
          matchedImports++;
        } else {
          console.log(`    ❌ ${importId}`);
          // 查找可能的匹配
          const possibleMatches = allEntities.filter(e => 
            importId.includes(e.rawName) || e.id.includes(importId.split(':')[1]) ||
            importId.split(':')[1] === e.rawName
          );
          if (possibleMatches.length > 0) {
            console.log(`      💡 可能匹配: ${possibleMatches.map(e => e.id).join(', ')}`);
          }
        }
      }
      
      // 验证调用
      if (result.calls.length > 0) {
        console.log('  调用验证:');
        for (const callId of result.calls) {
          totalCalls++;
          if (extractedIds.has(callId)) {
            console.log(`    ✅ ${callId}`);
            matchedCalls++;
          } else {
            console.log(`    ❌ ${callId}`);
          }
        }
      }
      console.log('');
    }
    
    // 统计结果
    console.log('📊 最终统计:');
    console.log(`  导入匹配: ${matchedImports}/${totalImports} (${totalImports > 0 ? Math.round(matchedImports/totalImports*100) : 0}%)`);
    console.log(`  调用匹配: ${matchedCalls}/${totalCalls} (${totalCalls > 0 ? Math.round(matchedCalls/totalCalls*100) : 0}%)`);
    
    const totalMatched = matchedImports + matchedCalls;
    const totalTests = totalImports + totalCalls;
    console.log(`  总体匹配: ${totalMatched}/${totalTests} (${totalTests > 0 ? Math.round(totalMatched/totalTests*100) : 0}%)`);
    
    if (totalMatched === totalTests && totalTests > 0) {
      console.log('\n🎉 完美！所有场景都能正确匹配实体ID！');
    } else if (totalMatched / totalTests > 0.9) {
      console.log('\n✅ 优秀！绝大多数场景都能正确匹配！');
    } else {
      console.log('\n⚠️  存在一些不匹配的场景，需要进一步优化。');
    }
    
    // 分析未匹配的原因
    if (totalMatched < totalTests) {
      console.log('\n🔍 未匹配分析:');
      const unmatchedTypes = new Set();
      
      for (const result of testResults) {
        for (const importId of result.imports) {
          if (!extractedIds.has(importId)) {
            const [type, name] = importId.split(':');
            unmatchedTypes.add(`${type} 类型`);
          }
        }
      }
      
      console.log('  主要问题:', [...unmatchedTypes].join(', '));
    }
    
  } catch (error) {
    console.error('❌ 测试失败：', error.message);
    console.error(error.stack);
  } finally {
    // 清理测试文件和目录
    console.log('\n🧹 清理测试文件...');
    
    for (const filePath of createdFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // 清理目录（如果为空）
    const dirs = ['components', 'utils', 'constants', 'services'];
    for (const dir of dirs) {
      const dirPath = path.join(testDir, dir);
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmdirSync(dirPath);
        }
      } catch (error) {
        // 目录不为空，忽略错误
      }
    }
    
    console.log('✅ 清理完成');
  }
}

runComprehensiveTest(); 