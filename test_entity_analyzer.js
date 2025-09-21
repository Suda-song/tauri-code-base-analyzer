const fs = require('fs');
const path = require('path');

class EntityAnalyzer {
    constructor() {
        this.functionRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
        this.classRegex = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
        this.interfaceRegex = /^\s*(?:export\s+)?interface\s+(\w+)/gm;
        this.variableRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)/gm;
        this.arrowFunctionRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/gm;
        this.vueExportRegex = /export\s+default\s+\{[\s\S]*?name\s*:\s*['"](\w+)['"]/g;
    }

    analyzeDirectory(dirPath) {
        const entities = [];

        const analyzeFile = (filePath, relativePath) => {
            if (!this.isSourceFile(filePath)) return;
            if (relativePath.includes('/dist/') || relativePath.includes('dist/')) return;

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const isWorkspace = !relativePath.includes('node_modules');
                const isDDD = relativePath.includes('domain') ||
                            relativePath.includes('entity') ||
                            relativePath.includes('aggregate') ||
                            relativePath.includes('repository');

                entities.push(...this.extractFunctions(content, relativePath, isWorkspace, isDDD));
                entities.push(...this.extractClasses(content, relativePath, isWorkspace, isDDD));
                entities.push(...this.extractInterfaces(content, relativePath, isWorkspace, isDDD));
                entities.push(...this.extractVariables(content, relativePath, isWorkspace, isDDD));

                if (path.extname(filePath) === '.vue') {
                    entities.push(...this.extractVueComponents(content, relativePath, isWorkspace, isDDD));
                }
            } catch (error) {
                console.error(`Error analyzing file ${filePath}:`, error.message);
            }
        };

        const walkDirectory = (currentPath, basePath) => {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                const fullPath = path.join(currentPath, item);
                const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

                if (fs.statSync(fullPath).isDirectory()) {
                    if (!item.startsWith('.') && item !== 'node_modules') {
                        walkDirectory(fullPath, basePath);
                    }
                } else {
                    analyzeFile(fullPath, relativePath);
                }
            }
        };

        walkDirectory(dirPath, dirPath);
        return entities;
    }

    isSourceFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'].includes(ext);
    }

    extractFunctions(content, filePath, isWorkspace, isDDD) {
        const entities = [];
        const lines = content.split('\n');

        let match;

        // Reset regex
        this.functionRegex.lastIndex = 0;
        while ((match = this.functionRegex.exec(content)) !== null) {
            const name = match[1];
            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Function:${name}`,
                type: 'function',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        // Arrow functions
        this.arrowFunctionRegex.lastIndex = 0;
        while ((match = this.arrowFunctionRegex.exec(content)) !== null) {
            const name = match[1];
            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Function:${name}`,
                type: 'function',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        return entities;
    }

    extractClasses(content, filePath, isWorkspace, isDDD) {
        const entities = [];
        let match;

        this.classRegex.lastIndex = 0;
        while ((match = this.classRegex.exec(content)) !== null) {
            const name = match[1];
            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Class:${name}`,
                type: 'class',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        return entities;
    }

    extractInterfaces(content, filePath, isWorkspace, isDDD) {
        const entities = [];
        let match;

        this.interfaceRegex.lastIndex = 0;
        while ((match = this.interfaceRegex.exec(content)) !== null) {
            const name = match[1];
            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Interface:${name}`,
                type: 'interface',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        return entities;
    }

    extractVariables(content, filePath, isWorkspace, isDDD) {
        const entities = [];
        let match;

        this.variableRegex.lastIndex = 0;
        while ((match = this.variableRegex.exec(content)) !== null) {
            const name = match[1];
            // Skip function and class matches
            if (match[0].includes('function') || match[0].includes('class')) continue;

            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Variable:${name}`,
                type: 'variable',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        return entities;
    }

    extractVueComponents(content, filePath, isWorkspace, isDDD) {
        const entities = [];
        let match;

        this.vueExportRegex.lastIndex = 0;
        while ((match = this.vueExportRegex.exec(content)) !== null) {
            const name = match[1];
            const loc = this.findLocation(content, match.index);

            entities.push({
                id: `Component:${name}`,
                type: 'component',
                file: filePath,
                loc,
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        // If no named component found, use filename
        if (entities.length === 0) {
            const name = path.basename(filePath, path.extname(filePath));
            entities.push({
                id: `Component:${name}`,
                type: 'component',
                file: filePath,
                loc: { start: 1, end: 10 },
                rawName: name,
                isWorkspace,
                isDDD
            });
        }

        return entities;
    }

    findLocation(content, bytePos) {
        const lines = content.slice(0, bytePos).split('\n');
        const startLine = lines.length;
        const endLine = Math.min(startLine + 10, content.split('\n').length);

        return {
            start: startLine,
            end: endLine
        };
    }
}

// Test the analyzer
function testAnalyzer() {
    const analyzer = new EntityAnalyzer();
    const demoPath = '/Users/billion_bian/codebase/tauri-code-base-analyzer/src/test/after-sale-demo';

    console.log('Analyzing after-sale-demo...');
    const entities = analyzer.analyzeDirectory(demoPath);

    console.log(`Found ${entities.length} entities:`);
    entities.slice(0, 10).forEach(entity => {
        console.log(`- ${entity.id} (${entity.type}) in ${entity.file}`);
    });

    // Save to file
    const outputPath = '/Users/billion_bian/codebase/tauri-code-base-analyzer/test_entities_js.json';
    fs.writeFileSync(outputPath, JSON.stringify(entities, null, 2));
    console.log(`\nSaved ${entities.length} entities to: ${outputPath}`);

    return entities;
}

if (require.main === module) {
    testAnalyzer();
}

module.exports = { EntityAnalyzer };