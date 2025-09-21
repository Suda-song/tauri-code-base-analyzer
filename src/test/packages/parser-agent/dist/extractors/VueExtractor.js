"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VueExtractor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const compiler_sfc_1 = require("@vue/compiler-sfc");
const ts_morph_1 = require("ts-morph");
class VueExtractor {
    static extract(filePath, rootDir) {
        console.log(`分析Vue文件: ${filePath}`);
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const { descriptor } = (0, compiler_sfc_1.parse)(content);
        const scripts = [];
        if (descriptor.script) {
            console.log(`  - 找到普通script标签`);
            scripts.push(descriptor.script.content);
        }
        if (descriptor.scriptSetup) {
            console.log(`  - 找到script setup标签`);
            scripts.push(descriptor.scriptSetup.content);
            // script setup是组件的特殊情况，直接添加组件实体
            return [{
                    id: `Component:${path_1.default.basename(filePath, '.vue')}`,
                    type: 'component',
                    file: path_1.default.relative(rootDir, filePath),
                    loc: descriptor.scriptSetup.loc.start.line,
                    rawName: 'setup'
                }];
        }
        // 如果没有script setup，则按原来的方式处理
        if (scripts.length === 0) {
            console.log(`  - 未找到script标签`);
            return [];
        }
        const project = new ts_morph_1.Project({ useInMemoryFileSystem: true });
        const sf = project.createSourceFile('temp.ts', scripts.join('\n'));
        const entities = [];
        sf.forEachChild(node => {
            // 组件默认导出
            if (node.getKind() === ts_morph_1.SyntaxKind.ExportAssignment) {
                entities.push({
                    id: `Component:${path_1.default.basename(filePath, '.vue')}`,
                    type: 'component',
                    file: path_1.default.relative(rootDir, filePath),
                    loc: node.getStartLineNumber(),
                    rawName: 'default'
                });
            }
            // Vue.defineComponent 调用也视作组件
            if (node.getKind() === ts_morph_1.SyntaxKind.CallExpression) {
                const callExpr = node;
                const exprText = callExpr.getExpression().getText();
                if (exprText.includes('defineComponent')) {
                    entities.push({
                        id: `Component:${path_1.default.basename(filePath, '.vue')}`,
                        type: 'component',
                        file: path_1.default.relative(rootDir, filePath),
                        loc: node.getStartLineNumber(),
                        rawName: 'defineComponent'
                    });
                }
            }
            // 其它提取逻辑可以扩展到 pinia store、hooks 等
        });
        return entities;
    }
}
exports.VueExtractor = VueExtractor;
