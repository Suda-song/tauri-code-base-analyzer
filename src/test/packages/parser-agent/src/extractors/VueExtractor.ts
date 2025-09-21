import fs from 'fs';
import path from 'path';
import { parse } from '@vue/compiler-sfc';
import { Project, SyntaxKind, Node, CallExpression } from 'ts-morph';
import ts from 'typescript';
import { calculateMd5 } from '../utils';

export class VueExtractor {
  static extract(filePath: string, rootDir: string): any[] {
    console.log(`分析Vue文件: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { descriptor } = parse(content);
    const scripts: string[] = [];
    
    if (descriptor.script) {
      console.log(`  - 找到普通script标签`);
      scripts.push(descriptor.script.content);
    }
    
    if (descriptor.scriptSetup) {
      console.log(`  - 找到script setup标签`);
      scripts.push(descriptor.scriptSetup.content);
      
      // script setup是组件的特殊情况，直接添加组件实体
      return [{
        id: `Component:${path.basename(filePath, '.vue')}`,
        type: 'component',
        file: path.relative(rootDir, filePath),
        loc: descriptor.scriptSetup.loc.start.line,
        rawName: 'setup',
        codeMd5: calculateMd5(content)
      }];
    }

    // 如果没有script setup，则按原来的方式处理
    if (scripts.length === 0) {
      console.log(`  - 未找到script标签`);
      return [];
    }
    
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('temp.ts', scripts.join('\n'));
    const entities: any[] = [];

    sf.forEachChild(node => {
      // 组件默认导出
      if (node.getKind() === SyntaxKind.ExportAssignment) {
        entities.push({
          id: `Component:${path.basename(filePath, '.vue')}`,
          type: 'component',
          file: path.relative(rootDir, filePath),
          loc: node.getStartLineNumber(),
          rawName: 'default',
          codeMd5: calculateMd5(content)
        });
      }
      // Vue.defineComponent 调用也视作组件
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node as CallExpression;
        const exprText = callExpr.getExpression().getText();
        if (exprText.includes('defineComponent')) {
          entities.push({
            id: `Component:${path.basename(filePath, '.vue')}`,
            type: 'component',
            file: path.relative(rootDir, filePath),
            loc: node.getStartLineNumber(),
            rawName: 'defineComponent',
            codeMd5: calculateMd5(content)
          });
        }
      }
      // 其它提取逻辑可以扩展到 pinia store、hooks 等
    });

    return entities;
  }
}
