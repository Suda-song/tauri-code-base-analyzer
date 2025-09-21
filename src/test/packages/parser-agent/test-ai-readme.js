/**
 * 测试AI README生成器
 */
const { generateReadmeToFile } = require('./dist/readme-generator/index');

async function testAIReadme() {
    try {
        const targetPath = process.argv[2] || '../../apps/after-sale-demo';
        const outputPath = process.argv[3] || 'README-optimized.md';
        
        console.log('🔥 开始测试优化后的AI README生成器...');
        console.log('📁 目标项目:', targetPath);
        console.log('📄 输出文件:', outputPath);
        
        await generateReadmeToFile(targetPath, outputPath);
        
        console.log('✅ 测试完成!');
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testAIReadme(); 