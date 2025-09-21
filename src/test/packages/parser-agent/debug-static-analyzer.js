const fs = require('fs');
const path = require('path');

// 检查StaticAnalyzer文件
const staticAnalyzerPath = path.join(__dirname, 'src/enrichment/staticAnalyzer.ts');
console.log('🔍 检查 StaticAnalyzer.ts 文件...');

if (fs.existsSync(staticAnalyzerPath)) {
  const content = fs.readFileSync(staticAnalyzerPath, 'utf-8');
  const lines = content.split('\n');
  
  console.log('\n📄 查找 generateEntityId 方法中的问题...\n');
  
  // 查找generateEntityId方法
  let inGenerateEntityId = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('generateEntityId(') && line.includes('private')) {
      inGenerateEntityId = true;
      console.log(`📍 找到 generateEntityId 方法开始 (第 ${i + 1} 行)`);
      braceCount = 0;
    }
    
    if (inGenerateEntityId) {
      // 计算大括号
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += (openBraces - closeBraces);
      
      // 查找可能的问题行
      if (line.includes('return') && (line.includes('relativePath') || line.includes('filePath'))) {
        console.log(`⚠️  可能的问题 (第 ${i + 1} 行): ${line.trim()}`);
        
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
      
      // 方法结束
      if (braceCount === 0 && line.includes('}')) {
        console.log(`📍 generateEntityId 方法结束 (第 ${i + 1} 行)`);
        break;
      }
    }
  }
  
  // 还要检查是否有其他地方直接使用了相对路径作为ID
  console.log('\n🔍 查找可能使用 relativePath 或文件路径作为ID的地方...\n');
  
  const suspiciousLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.includes('id:') || line.includes('id =')) && 
        (line.includes('relativePath') || line.includes('filePath'))) {
      suspiciousLines.push({line: i + 1, content: line.trim()});
    }
  }
  
  if (suspiciousLines.length > 0) {
    console.log('⚠️  发现可疑的ID生成:');
    suspiciousLines.forEach(item => {
      console.log(`  第 ${item.line} 行: ${item.content}`);
    });
  } else {
    console.log('✅ 没有发现可疑的ID生成');
  }
  
} else {
  console.error('❌ StaticAnalyzer.ts 文件不存在');
} 