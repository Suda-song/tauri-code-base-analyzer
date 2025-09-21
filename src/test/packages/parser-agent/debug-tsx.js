const fs = require('fs');
const path = require('path');

// 直接检查TSXExtractor文件内容
const tsxExtractorPath = path.join(__dirname, 'src/extractors/TSXExtractor.ts');
console.log('🔍 检查 TSXExtractor.ts 文件...');

if (fs.existsSync(tsxExtractorPath)) {
  const content = fs.readFileSync(tsxExtractorPath, 'utf-8');
  
  // 查找默认导出函数的ID生成部分
  const lines = content.split('\n');
  console.log('\n📄 查找 ID 生成相关代码...\n');
  
  let foundIdGeneration = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('id:') && (line.includes('Component:') || line.includes('Function:'))) {
      console.log(`第 ${i + 1} 行: ${line.trim()}`);
      foundIdGeneration = true;
      
      // 显示上下文
      const start = Math.max(0, i - 3);
      const end = Math.min(lines.length - 1, i + 3);
      console.log('\n📍 上下文:');
      for (let j = start; j <= end; j++) {
        const marker = j === i ? '>>> ' : '    ';
        console.log(`${marker}${j + 1}: ${lines[j]}`);
      }
      console.log('');
    }
  }
  
  if (!foundIdGeneration) {
    console.log('❓ 没有找到ID生成代码');
  }
  
  // 检查是否有使用 relativePath 的地方
  console.log('\n🔍 查找 relativePath 的使用...\n');
  const relativePathUsages = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('relativePath') && line.includes('id:')) {
      relativePathUsages.push({line: i + 1, content: line.trim()});
    }
  }
  
  if (relativePathUsages.length > 0) {
    console.log('⚠️  发现使用 relativePath 的ID生成:');
    relativePathUsages.forEach(usage => {
      console.log(`  第 ${usage.line} 行: ${usage.content}`);
    });
  } else {
    console.log('✅ 没有发现使用 relativePath 的ID生成');
  }
  
} else {
  console.error('❌ TSXExtractor.ts 文件不存在');
} 