/**
 * extractReadmeSections测试函数
 * 
 * 此文件提供了一个简单的测试函数，用于测试extractReadmeSections的功能
 * 
 * 快速测试命令：
 * 
 * # 测试提取特定README文件的路由和架构部分
 * npx tsx src/readme-generator/test-extract.ts /Users/fangqiji/dev/modular-code-analysis-util/packages/parser-agent/src/readme-generator/readme-20250807173023.md route,architecture
 * 
 * # 测试使用工作空间参数在特定目录搜索README并提取目录结构部分
 * npx tsx src/readme-generator/test-extract.ts '' structure /Users/fangqiji/Downloads
 * 
 * # 测试在默认目录自动查找最新README文件并提取全部内容
 * npx tsx src/readme-generator/test-extract.ts
 * 
 * # 测试提取目录分析部分，并指定工作空间目录
 * npx tsx src/readme-generator/test-extract.ts '' directory /Users/fangqiji/dev
 */

import { extractReadmeSections, ReadmeSection } from './index';
import fs from 'fs';
import path from 'path';

/**
 * 测试extractReadmeSections函数
 * 
 * @param readmePath 可选的README文件路径
 * @param sections 要提取的部分
 * @param workspace 工作空间目录
 */
export async function testExtractReadmeSections(
  readmePath?: string,
  sections?: ReadmeSection[],
  workspace?: string
): Promise<void> {
  console.log('🧪 测试extractReadmeSections函数...');
  console.log(`📄 README路径: ${readmePath || '自动查找'}`);
  console.log(`🔍 提取部分: ${sections ? sections.join(', ') : '全部'}`);
  console.log(`💼 工作空间: ${workspace || '未指定'}`);
  
  try {
    // 调用extractReadmeSections函数
    const result = await extractReadmeSections({
      readmePath,
      sections,
      workspace
    });
    
    // 输出结果
    console.log('\n✅ 提取结果:');
    Object.keys(result).forEach(key => {
      fs.writeFileSync(path.join(__dirname, `${key}.md`), result[key as ReadmeSection]);
    })
    for (const [section, content] of Object.entries(result)) {
      console.log(`\n📋 部分: ${section}`);
      
      // 输出内容摘要
      if (content) {
        // 获取前3行和总行数
        const lines = content.split('\n');
        const preview = lines.slice(0, 3).join('\n');
        console.log(`📝 内容预览 (${lines.length}行):\n${preview}...\n`);
        console.log(`📊 内容大小: ${content.length}字符`);
      } else {
        console.log('⚠️ 无内容');
      }
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 可以直接通过命令行调用
if (require.main === module) {
  // 从命令行参数获取路径、部分和工作空间
  const args = process.argv.slice(2);
  const readmePath = args[0] || undefined;
  const sections = args[1] ? args[1].split(',') as ReadmeSection[] : undefined;
  const workspace = args[2] || undefined;
  
  console.log('✅ 命令行参数:');
  console.log(`  - readmePath: ${readmePath || '未指定 (将自动查找)'}`);
  console.log(`  - sections: ${sections ? sections.join(', ') : '未指定 (将提取全部)'}`);
  console.log(`  - workspace: ${workspace || '未指定 (将使用默认目录)'}`);
  console.log('');
  
  testExtractReadmeSections(readmePath, sections, workspace)
    .then(() => console.log('🏁 测试完成'))
    .catch(err => console.error('💥 执行出错:', err));
}
