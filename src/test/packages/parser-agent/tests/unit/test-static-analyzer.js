const fs = require('fs');
const path = require('path');
const { StaticAnalyzer } = require('./dist/enrichment/staticAnalyzer');
const { FunctionExtractor } = require('./dist/extractors/FunctionExtractor');
const { TSXExtractor } = require('./dist/extractors/TSXExtractor');

// 创建测试文件
const testFiles = {
  'test.ts': `
export default function MyComponent() {
  return new Element();
}

export function utilFunction() {
  return "工具函数";
}

export class DataProcessor {
  process() {}
}

export const API_URL = 'https://api.example.com';
export const ButtonComponent = () => new Element();

const CONFIG = { debug: true };
const localHelper = () => "local";

export { CONFIG, localHelper };
`,
  'test.tsx': `
import React from 'react';

export default function MyComponent() {
  return <div>主组件</div>;
}

export function HelperComponent() {
  return <span>辅助组件</span>;
}

export const API_URL = 'https://api.example.com';
export const ButtonComponent = () => <button>按钮</button>;

const CONFIG = { debug: true };
const localHelper = () => "local";

export { CONFIG, localHelper };
`
};

console.log('🧪 测试 StaticAnalyzer 的 generateEntityId 方法...\n');

async function runTest() {
  try {
    // 写入测试文件
    const testDir = __dirname;
    const filePaths = [];
    
    for (const [fileName, content] of Object.entries(testFiles)) {
      const filePath = path.join(testDir, fileName);
      fs.writeFileSync(filePath, content);
      filePaths.push(filePath);
    }

    // 使用提取器提取实体
    const allEntities = [];
    
    // 提取TS实体
    const tsEntities = FunctionExtractor.extract(path.join(testDir, 'test.ts'), testDir);
    allEntities.push(...tsEntities);
    
    // 提取TSX实体
    const tsxEntities = TSXExtractor.extract(path.join(testDir, 'test.tsx'), testDir);
    allEntities.push(...tsxEntities);
    
    console.log('📊 提取的实体：');
    allEntities.forEach(entity => {
      console.log(`  ${entity.id} (${entity.type}) - ${entity.rawName} in ${entity.file}`);
    });
    
    // 创建StaticAnalyzer实例
    const analyzer = new StaticAnalyzer(testDir, allEntities);
    
    // 测试generateEntityId方法（通过分析导入来间接测试）
    console.log('\n🔍 测试 generateEntityId 方法...');
    
    // 创建一个导入测试文件
    const importTestContent = `
import MyComponent from './test';
import { utilFunction, API_URL, ButtonComponent } from './test';
import MyTsxComponent from './test.tsx';
import { HelperComponent, CONFIG } from './test.tsx';

// 调用导入的函数
utilFunction();
HelperComponent();
`;
    
    const importTestPath = path.join(testDir, 'import-test.ts');
    fs.writeFileSync(importTestPath, importTestContent);
    
    // 手动测试generateEntityId方法
    console.log('\n🔧 手动测试 generateEntityId 逻辑：');
    
    // 测试默认导出
    console.log('测试 test.ts 默认导出:');
    console.log('  文件名:', 'test');
    console.log('  是否大写开头:', /^[A-Z][a-zA-Z0-9]*$/.test('test'));
    
    // 测试 test.tsx 默认导出
    console.log('测试 test.tsx 默认导出:');
    console.log('  文件名:', 'test');
    console.log('  是否大写开头:', /^[A-Z][a-zA-Z0-9]*$/.test('test'));
    
    // 分析导入测试文件
    const dummyEntity = {
      id: 'Function:import-test',
      type: 'function',
      file: 'import-test.ts',
      rawName: 'import-test',
      loc: { start: 1, end: 1 }
    };
    
    const result = await analyzer.analyzeEntity(dummyEntity);
    
    console.log('\n📋 分析结果：');
    console.log('IMPORTS:', result.IMPORTS);
    console.log('CALLS:', result.CALLS);
    
    // 验证生成的实体ID是否与提取器生成的ID匹配
    console.log('\n✅ 验证实体ID匹配：');
    const extractedIds = new Set(allEntities.map(e => e.id));
    
    let matchCount = 0;
    let totalCount = 0;
    
    for (const importId of result.IMPORTS) {
      totalCount++;
      if (extractedIds.has(importId)) {
        console.log(`  ✅ ${importId} - 匹配`);
        matchCount++;
      } else {
        console.log(`  ❌ ${importId} - 不匹配`);
        // 查找可能的匹配
        const possibleMatches = allEntities.filter(e => 
          importId.includes(e.rawName) || e.id.includes(importId.split(':')[1])
        );
        if (possibleMatches.length > 0) {
          console.log(`    可能的匹配: ${possibleMatches.map(e => e.id).join(', ')}`);
        }
      }
    }
    
    console.log(`\n📈 匹配统计: ${matchCount}/${totalCount} (${Math.round(matchCount/totalCount*100)}%)`);
    
    if (matchCount === totalCount) {
      console.log('🎉 所有实体ID都匹配！StaticAnalyzer与提取器规则一致。');
    } else {
      console.log('⚠️  存在不匹配的实体ID，需要进一步调整。');
    }
    
  } catch (error) {
    console.error('❌ 测试失败：', error.message);
    console.error(error.stack);
  } finally {
    // 清理测试文件
    const filesToClean = ['test.ts', 'test.tsx', 'import-test.ts'];
    filesToClean.forEach(fileName => {
      const filePath = path.join(__dirname, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

runTest(); 