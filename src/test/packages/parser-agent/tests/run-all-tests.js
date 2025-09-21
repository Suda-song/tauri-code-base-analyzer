#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 代码分析工具测试套件\n');

// 测试配置
const tests = {
  integration: {
    name: '🚀 全链路集成测试',
    file: 'tests/integration-test.js',
    description: '完整workspace + TS/TSX/Vue提取 + 依赖分析'
  },
  ts: {
    name: '📄 TS文件提取测试', 
    file: 'tests/unit/test-ts-extraction.js',
    description: 'TypeScript文件实体提取功能'
  },
  tsx: {
    name: '⚛️ TSX文件提取测试',
    file: 'tests/unit/test-tsx-extraction.js', 
    description: 'React TSX文件组件提取功能'
  },
  analyzer: {
    name: '🔍 依赖分析测试',
    file: 'tests/unit/test-static-analyzer.js',
    description: 'StaticAnalyzer依赖关系分析功能'
  }
};

async function runTest(testKey) {
  const test = tests[testKey];
  if (!test) {
    console.error(`❌ 测试 "${testKey}" 不存在`);
    return false;
  }

  const testFile = path.resolve(__dirname, '..', test.file);
  if (!fs.existsSync(testFile)) {
    console.error(`❌ 测试文件不存在: ${test.file}`);
    return false;
  }

  console.log(`\n${test.name}`);
  console.log(`📝 ${test.description}`);
  console.log(`🎯 运行: ${test.file}\n`);
  console.log('─'.repeat(60));

  return new Promise((resolve) => {
    const child = spawn('node', [testFile], {
      stdio: 'inherit',
      cwd: path.dirname(testFile)
    });

    child.on('close', (code) => {
      console.log('─'.repeat(60));
      if (code === 0) {
        console.log(`✅ ${test.name} 通过\n`);
        resolve(true);
      } else {
        console.log(`❌ ${test.name} 失败 (退出码: ${code})\n`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`❌ 运行测试时出错: ${error.message}`);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('🔄 运行所有测试...\n');
  
  const results = {};
  let totalPassed = 0;
  let totalTests = 0;

  for (const [key, test] of Object.entries(tests)) {
    totalTests++;
    const passed = await runTest(key);
    results[key] = passed;
    if (passed) totalPassed++;
  }

  // 最终报告
  console.log('═'.repeat(60));
  console.log('📊 测试总结');
  console.log('═'.repeat(60));
  
  for (const [key, test] of Object.entries(tests)) {
    const status = results[key] ? '✅ 通过' : '❌ 失败';
    console.log(`${status} ${test.name}`);
  }
  
  const passRate = Math.round((totalPassed / totalTests) * 100);
  console.log(`\n🎯 总体通过率: ${totalPassed}/${totalTests} (${passRate}%)`);
  
  if (passRate === 100) {
    console.log('🎉 所有测试都通过了！系统完全正常。');
  } else if (passRate >= 75) {
    console.log('✅ 大部分测试通过，系统基本可用。');
  } else {
    console.log('⚠️  多个测试失败，需要修复问题。');
  }
  
  return passRate;
}

function showHelp() {
  console.log('使用方法:');
  console.log('  node tests/run-all-tests.js [test-name]');
  console.log('');
  console.log('可用的测试:');
  console.log('  all          运行所有测试 (默认)');
  
  for (const [key, test] of Object.entries(tests)) {
    console.log(`  ${key.padEnd(12)} ${test.description}`);
  }
  
  console.log('');
  console.log('示例:');
  console.log('  node tests/run-all-tests.js integration  # 只运行集成测试');
  console.log('  node tests/run-all-tests.js ts           # 只运行TS提取测试');
  console.log('  node tests/run-all-tests.js              # 运行所有测试');
}

async function main() {
  const args = process.argv.slice(2);
  const testName = args[0];

  if (testName === 'help' || testName === '--help' || testName === '-h') {
    showHelp();
    return;
  }

  if (!testName || testName === 'all') {
    const passRate = await runAllTests();
    process.exit(passRate === 100 ? 0 : 1);
  } else if (tests[testName]) {
    const passed = await runTest(testName);
    process.exit(passed ? 0 : 1);
  } else {
    console.error(`❌ 未知的测试: "${testName}"`);
    console.log('');
    showHelp();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ 运行测试时发生错误:', error);
  process.exit(1);
}); 