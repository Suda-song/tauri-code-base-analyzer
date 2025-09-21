const fs = require('fs');
const path = require('path');
const { StaticAnalyzer } = require('./dist/enrichment/staticAnalyzer');
const { FunctionExtractor } = require('./dist/extractors/FunctionExtractor');
const { TSXExtractor } = require('./dist/extractors/TSXExtractor');
const { VueExtractor } = require('./dist/extractors/VueExtractor');

// 创建包含注释的测试文件
const testFiles = {
  // TS文件 - 各种注释格式
  'ts-comments.ts': `
/**
 * 这是一个默认导出的组件
 * 支持多行注释
 */
export default function MainComponent() {
  return new Element();
}

// 单行注释的函数
export function helperFunction() {
  return "helper";
}

/**
 * 类的多行注释
 * @class ButtonController
 */
export class ButtonController {
  control() {}
}

// 常量的单行注释
export const API_URL = 'https://api.example.com';

/**
 * 箭头函数组件注释
 */
export const ArrowComponent = () => new Element();

// 内部函数注释
function internalFunction() {
  return "internal";
}

/**
 * 内部常量注释
 */
const INTERNAL_CONFIG = { debug: true };

// 导出的内部实体
export { internalFunction, INTERNAL_CONFIG };
`,

  // TSX文件 - React组件注释
  'tsx-comments.tsx': `
import React from 'react';

/**
 * 主要的React组件
 * @component
 */
export default function ReactComponent() {
  return <div>React组件</div>;
}

// React函数组件
export function ButtonComponent() {
  return <button>按钮</button>;
}

/**
 * React类组件
 * @extends React.Component
 */
export class ClassComponent extends React.Component {
  render() {
    return <div>类组件</div>;
  }
}

// 常量定义
export const BUTTON_TYPES = ['primary', 'secondary'];

/**
 * 高阶组件
 */
export const HighOrderComponent = (WrappedComponent) => {
  return <WrappedComponent />;
};

// 内部组件
function InternalComponent() {
  return <span>内部组件</span>;
}

/**
 * 内部工具
 */
const internalUtil = () => "util";

// 批量导出
export { InternalComponent, internalUtil };
`,

  // Vue文件 - Vue组件注释
  'vue-comments.vue': `
<template>
  <!-- Vue组件模板 -->
  <div class="vue-component">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

/**
 * Vue 3 Composition API 组件
 * 使用 script setup 语法
 */
const title = ref('Vue组件标题');
const description = ref('Vue组件描述');

// 组件方法
const handleClick = () => {
  console.log('点击事件');
};

// 导出方法
export { handleClick };
</script>

<style scoped>
.vue-component {
  padding: 20px;
}
</style>
`,

  // 混合注释格式
  'mixed-comments.ts': `
/* 文件头部注释 */

/**
 * 默认导出函数
 * 使用JSDoc格式
 * @returns {string} 返回值说明
 */
export default function mixedFunction() {
  return "mixed";
}

// 普通单行注释
export const CONSTANT_VALUE = 100;

/* 
 * 多行块注释
 * 不是JSDoc格式
 */
export class MixedClass {
  process() {}
}

// TODO: 待办事项注释
export function todoFunction() {
  return "todo";
}

/**
 * @deprecated 已废弃的函数
 */
export function deprecatedFunction() {
  return "deprecated";
}
`
};

console.log('🧪 测试 StaticAnalyzer 注释提取功能...\n');

async function runCommentTest() {
  const testDir = __dirname;
  const createdFiles = [];
  
  try {
    // 写入测试文件
    for (const [fileName, content] of Object.entries(testFiles)) {
      const filePath = path.join(testDir, fileName);
      fs.writeFileSync(filePath, content);
      createdFiles.push(filePath);
    }

    // 提取所有实体
    console.log('📊 提取实体和注释...\n');
    
    const allResults = [];
    
    for (const [fileName, content] of Object.entries(testFiles)) {
      const filePath = path.join(testDir, fileName);
      let entities = [];
      
      console.log(`📁 ${fileName}:`);
      
      // 提取实体
      if (fileName.endsWith('.ts')) {
        entities = FunctionExtractor.extract(filePath, testDir);
      } else if (fileName.endsWith('.tsx')) {
        entities = TSXExtractor.extract(filePath, testDir);
      } else if (fileName.endsWith('.vue')) {
        entities = VueExtractor.extract(filePath, testDir);
      }
      
      // 创建StaticAnalyzer实例来提取注释
      const analyzer = new StaticAnalyzer(testDir, entities);
      
      // 测试每个实体的注释提取
      for (const entity of entities) {
        console.log(`  └── ${entity.id} (${entity.type}) - ${entity.rawName}`);
        
        try {
          const result = await analyzer.analyzeEntity(entity);
          const annotation = result.ANNOTATION;
          
          if (annotation) {
            console.log(`      💬 注释: "${annotation}"`);
          } else {
            console.log(`      ❌ 未找到注释`);
          }
          
          allResults.push({
            file: fileName,
            entity: entity,
            annotation: annotation,
            hasComment: !!annotation
          });
        } catch (error) {
          console.log(`      ⚠️  提取失败: ${error.message}`);
          allResults.push({
            file: fileName,
            entity: entity,
            annotation: null,
            hasComment: false,
            error: error.message
          });
        }
      }
      console.log('');
    }
    
    // 统计结果
    console.log('📊 注释提取统计:\n');
    
    const fileStats = {};
    
    for (const result of allResults) {
      if (!fileStats[result.file]) {
        fileStats[result.file] = {
          total: 0,
          withComments: 0,
          withoutComments: 0,
          errors: 0
        };
      }
      
      fileStats[result.file].total++;
      if (result.error) {
        fileStats[result.file].errors++;
      } else if (result.hasComment) {
        fileStats[result.file].withComments++;
      } else {
        fileStats[result.file].withoutComments++;
      }
    }
    
    let totalEntities = 0;
    let totalWithComments = 0;
    let totalErrors = 0;
    
    for (const [fileName, stats] of Object.entries(fileStats)) {
      const rate = Math.round((stats.withComments / stats.total) * 100);
      console.log(`📄 ${fileName}:`);
      console.log(`  总实体: ${stats.total}`);
      console.log(`  有注释: ${stats.withComments} (${rate}%)`);
      console.log(`  无注释: ${stats.withoutComments}`);
      if (stats.errors > 0) {
        console.log(`  错误: ${stats.errors}`);
      }
      console.log('');
      
      totalEntities += stats.total;
      totalWithComments += stats.withComments;
      totalErrors += stats.errors;
    }
    
    const overallRate = Math.round((totalWithComments / totalEntities) * 100);
    console.log(`🎯 总体统计:`);
    console.log(`  总实体数: ${totalEntities}`);
    console.log(`  成功提取注释: ${totalWithComments} (${overallRate}%)`);
    console.log(`  未找到注释: ${totalEntities - totalWithComments - totalErrors}`);
    if (totalErrors > 0) {
      console.log(`  提取错误: ${totalErrors}`);
    }
    
    // 分析问题
    console.log('\n🔍 问题分析:');
    
    const noCommentEntities = allResults.filter(r => !r.hasComment && !r.error);
    const errorEntities = allResults.filter(r => r.error);
    
    if (noCommentEntities.length > 0) {
      console.log('\n❌ 未找到注释的实体:');
      for (const result of noCommentEntities) {
        console.log(`  - ${result.entity.id} in ${result.file}`);
        
        // 检查原文件中是否真的有注释
        const fileContent = testFiles[result.file];
        const entityName = result.entity.rawName;
        
        // 简单检查：在实体名称前后查找注释
        const escapedEntityName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(\\/\\*\\*[\\s\\S]*?\\*\\/|\\/\\/.*?)\\s*.*?${escapedEntityName}`, 'i');
        const match = fileContent.match(regex);
        
        if (match) {
          console.log(`    💡 原文件中发现注释: "${match[1].trim()}"`);
        }
      }
    }
    
    if (errorEntities.length > 0) {
      console.log('\n⚠️  提取错误的实体:');
      for (const result of errorEntities) {
        console.log(`  - ${result.entity.id}: ${result.error}`);
      }
    }
    
    // 建议
    if (overallRate < 80) {
      console.log('\n💡 建议优化:');
      console.log('  1. 检查默认导出的注释匹配逻辑');
      console.log('  2. 优化TSX文件的注释提取');
      console.log('  3. 增强Vue文件的注释支持');
      console.log('  4. 改进AST节点匹配算法');
    } else {
      console.log('\n✅ 注释提取功能整体表现良好！');
    }
    
  } catch (error) {
    console.error('❌ 测试失败：', error.message);
    console.error(error.stack);
  } finally {
    // 清理测试文件
    console.log('\n🧹 清理测试文件...');
    for (const filePath of createdFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    console.log('✅ 清理完成');
  }
}

runCommentTest(); 