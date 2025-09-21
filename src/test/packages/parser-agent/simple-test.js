const { extractAllEntities } = require('./dist/fileWalker');
const path = require('path');
const fs = require('fs');

async function simpleTest() {
  // 创建一个简单的测试
  const testDir = './test-simple';

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  const appContent = `
import React from 'react';

export default function App() {
  return <div>Hello</div>;
}
`;

  fs.writeFileSync(path.join(testDir, 'App.tsx'), appContent);

  try {
    const entities = await extractAllEntities(testDir);
    console.log('提取的实体:');
    entities.forEach(e => {
      console.log(`ID: ${e.id}, Type: ${e.type}, File: ${e.file}, RawName: ${e.rawName}`);
    });
  } catch (error) {
    console.error('错误:', error);
  } finally {
    // 清理
    fs.unlinkSync(path.join(testDir, 'App.tsx'));
    fs.rmdirSync(testDir);
  }
}

simpleTest(); 