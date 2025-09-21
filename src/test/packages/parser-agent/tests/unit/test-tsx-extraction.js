const fs = require('fs');
const path = require('path');
const { TSXExtractor } = require('./dist/extractors/TSXExtractor');

// 创建测试 TSX 文件
const testTsxContent = `
// 测试 TSX 文件
import React from 'react';
import { VueComp } from './VueComp.vue';

export default function MyComponent() {
  return <div>主组件</div>;
}

export function HelperComponent() {
  return <span>辅助组件</span>;
}

export function utilFunction() {
  return "工具函数";
}

export class ReactComponent extends React.Component {
  render() {
    return <div>React类组件</div>;
  }
}

export class UtilClass {
  method() {}
}

export const API_URL = 'https://api.example.com';

export const ButtonComponent = () => <button>按钮</button>;

export const helper = () => "辅助函数";

// 顶层声明
function TopFunction() {
  return <div>顶层函数</div>;
}

class TopClass {
  method() {}
}

const CONFIG = { debug: true };
let counter = 0;
var globalVar = "test";

const localHelper = () => "local";
const LocalComponent = () => <div>本地组件</div>;

// 重新导出
export { TopFunction, CONFIG, LocalComponent };
`;

// 写入测试文件
const testFilePath = path.join(__dirname, 'test.tsx');
fs.writeFileSync(testFilePath, testTsxContent);

console.log('🧪 测试 TSXExtractor 功能...\n');

try {
  // 提取实体
  const entities = TSXExtractor.extract(testFilePath, __dirname);
  
  console.log('✅ 提取成功！');
  console.log('📊 提取结果：');
  console.log(JSON.stringify(entities, null, 2));
  
  // 统计各类型数量
  const stats = entities.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 类型统计：');
  Object.entries(stats).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // 验证期望的实体
  const expected = [
    'MyComponent', 'HelperComponent', 'utilFunction', 'ReactComponent',
    'UtilClass', 'API_URL', 'ButtonComponent', 'helper', 'TopFunction', 
    'TopClass', 'CONFIG', 'counter', 'globalVar', 'localHelper', 
    'LocalComponent', 'VueComp'
  ];
  
  const extracted = entities.map(e => e.rawName);
  const missing = expected.filter(name => !extracted.includes(name));
  
  if (missing.length === 0) {
    console.log('\n✅ 所有期望的实体都已提取！');
  } else {
    console.log('\n❌ 缺少的实体：', missing);
  }
  
  // 验证组件识别正确性
  const components = entities.filter(e => e.type === 'component');
  const expectedComponents = ['MyComponent', 'HelperComponent', 'ReactComponent', 'ButtonComponent', 'TopFunction', 'LocalComponent'];
  console.log(`\n🎯 组件识别检查：`);
  console.log(`  期望组件: ${expectedComponents.join(', ')}`);
  console.log(`  识别组件: ${components.map(c => c.rawName).join(', ')}`);
  
} catch (error) {
  console.error('❌ 提取失败：', error.message);
  console.error(error.stack);
} finally {
  // 清理测试文件
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
} 