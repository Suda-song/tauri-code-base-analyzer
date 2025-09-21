const fs = require('fs');
const path = require('path');
const { FunctionExtractor } = require('./dist/extractors/FunctionExtractor');

// 创建测试 TS 文件
const testTsContent = `
// 测试 TS 文件
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

// 顶层声明
function helperFunction() {
  return "helper";
}

class LocalClass {
  method() {}
}

const CONFIG = { debug: true };
let counter = 0;
var globalVar = "test";

const localHelper = () => "local";
const ComponentVar = () => new Element();

// 重新导出
export { helperFunction, CONFIG };
`;

// 写入测试文件
const testFilePath = path.join(__dirname, 'test.ts');
fs.writeFileSync(testFilePath, testTsContent);

console.log('🧪 测试 FunctionExtractor 变量提取功能...\n');

try {
  // 提取实体 - 使用正确的方法名
  const entities = FunctionExtractor.extract(testFilePath, __dirname);
  
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
    'MyComponent', 'utilFunction', 'DataProcessor', 'API_URL', 
    'ButtonComponent', 'helperFunction', 'LocalClass', 'CONFIG',
    'counter', 'globalVar', 'localHelper', 'ComponentVar'
  ];
  
  const extracted = entities.map(e => e.rawName);
  const missing = expected.filter(name => !extracted.includes(name));
  
  if (missing.length === 0) {
    console.log('\n✅ 所有期望的实体都已提取！');
  } else {
    console.log('\n❌ 缺少的实体：', missing);
  }
  
} catch (error) {
  console.error('❌ 提取失败：', error.message);
  console.error(error.stack);
} finally {
  // 清理测试文件
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
} 