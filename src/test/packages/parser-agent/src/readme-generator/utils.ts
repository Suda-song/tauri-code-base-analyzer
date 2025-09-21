/**
 * README 生成器工具函数
 */

import fs from 'fs';
import path from 'path';

/**
 * 文件和目录分析工具类
 */
export class FileAnalysisUtils {
    /**
     * 判断是否为关键文件
     */
    static isKeyFile(filename: string): boolean {
        const keyFiles = [
            'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
            'vue.config.js', 'nuxt.config.js', 'next.config.js', 'tailwind.config.js',
            'babel.config.js', 'jest.config.js', 'cypress.config.js', 'playwright.config.js',
            'eslint.config.js', '.eslintrc.js', 'prettier.config.js', '.prettierrc.js',
            'docker-compose.yml', 'Dockerfile', 'README.md', 'CHANGELOG.md',
            'index.html', 'main.js', 'main.ts', 'app.js', 'app.ts', 'App.vue', 'App.tsx'
        ];

        return keyFiles.some(key => filename.toLowerCase().includes(key.toLowerCase())) ||
            filename.match(/\.(config|rc)\.(js|ts|json)$/i) !== null;
    }

    /**
     * 获取文件类型
     */
    static getFileType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const typeMap: { [key: string]: string } = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.vue': 'Vue组件',
            '.jsx': 'React组件',
            '.tsx': 'React组件(TS)',
            '.json': '配置文件',
            '.md': '文档',
            '.yml': '配置文件',
            '.yaml': '配置文件',
            '.css': '样式文件',
            '.scss': '样式文件',
            '.less': '样式文件'
        };
        return typeMap[ext] || '其他';
    }

    /**
     * 获取文件用途
     */
    static getFilePurpose(filename: string): string {
        const purposeMap: { [key: string]: string } = {
            'package.json': '项目配置和依赖管理',
            'tsconfig.json': 'TypeScript编译配置',
            'webpack.config.js': 'Webpack构建配置',
            'vite.config.js': 'Vite构建配置',
            'vue.config.js': 'Vue CLI配置',
            'tailwind.config.js': 'Tailwind CSS配置',
            'README.md': '项目说明文档',
            'index.html': '应用入口页面',
            'main.js': '应用主入口',
            'main.ts': '应用主入口',
            'App.vue': '根组件',
            'App.tsx': '根组件'
        };

        return purposeMap[filename] || this.inferFilePurpose(filename);
    }

    /**
     * 推断文件用途
     */
    static inferFilePurpose(filename: string): string {
        if (filename.includes('test') || filename.includes('spec')) return '测试文件';
        if (filename.includes('config')) return '配置文件';
        if (filename.includes('util') || filename.includes('helper')) return '工具函数';
        if (filename.includes('component')) return '组件文件';
        if (filename.includes('service') || filename.includes('api')) return 'API服务';
        if (filename.includes('store') || filename.includes('state')) return '状态管理';
        if (filename.includes('router') || filename.includes('route')) return '路由配置';
        if (filename.includes('style') || filename.includes('css')) return '样式文件';
        return '源代码文件';
    }

    /**
     * 获取目录用途
     */
    static getDirectoryPurpose(dirPath: string, mainFileTypes: string[]): string {
        const dirName = path.basename(dirPath);

        const purposeMap: { [key: string]: string } = {
            'src': '源代码目录',
            'components': '组件目录',
            'pages': '页面目录',
            'views': '视图目录',
            'utils': '工具函数目录',
            'services': 'API服务目录',
            'store': '状态管理目录',
            'router': '路由配置目录',
            'styles': '样式文件目录',
            'assets': '静态资源目录',
            'public': '公共资源目录',
            'dist': '构建输出目录',
            'build': '构建配置目录',
            'config': '配置文件目录',
            'tests': '测试文件目录',
            'test': '测试文件目录',
            'docs': '文档目录',
            'node_modules': '依赖包目录',
            '.git': 'Git版本控制目录'
        };

        if (purposeMap[dirName]) {
            return purposeMap[dirName];
        }

        // 基于文件类型推断
        if (mainFileTypes.includes('.vue')) return 'Vue组件目录';
        if (mainFileTypes.includes('.tsx') || mainFileTypes.includes('.jsx')) return 'React组件目录';
        if (mainFileTypes.includes('.test.js') || mainFileTypes.includes('.spec.js')) return '测试目录';
        if (mainFileTypes.includes('.css') || mainFileTypes.includes('.scss')) return '样式目录';
        if (mainFileTypes.includes('.md')) return '文档目录';

        return '项目目录';
    }

    /**
     * 计算目录重要性
     */
    static calculateDirectoryImportance(dirPath: string, fileCount: number): number {
        let importance = fileCount; // 基础重要性基于文件数量

        const highImportanceDirs = ['src', 'components', 'pages', 'views', 'services'];
        const mediumImportanceDirs = ['utils', 'store', 'router', 'styles', 'config'];
        const lowImportanceDirs = ['tests', 'docs', 'build', 'dist'];

        const dirName = path.basename(dirPath);

        if (highImportanceDirs.includes(dirName)) importance += 20;
        else if (mediumImportanceDirs.includes(dirName)) importance += 10;
        else if (lowImportanceDirs.includes(dirName)) importance += 5;

        // 根目录的重要文件增加权重
        if (dirPath === '.' || dirPath === '') importance += 15;

        return importance;
    }

    /**
     * 计算文件重要性
     */
    static calculateFileImportance(filename: string): number {
        const highImportanceFiles = ['package.json', 'README.md', 'index.html', 'main.js', 'main.ts', 'App.vue'];
        const mediumImportanceFiles = ['tsconfig.json', 'webpack.config.js', 'vite.config.js'];

        if (highImportanceFiles.includes(filename)) return 10;
        if (mediumImportanceFiles.includes(filename)) return 7;
        if (filename.includes('config')) return 5;
        if (filename.includes('index')) return 4;
        return 3;
    }

    /**
     * 判断是否为测试文件
     */
    static isTestFile(filename: string): boolean {
        return filename.includes('test') ||
            filename.includes('spec') ||
            filename.includes('__tests__') ||
            filename.match(/\.(test|spec)\.(js|ts|jsx|tsx)$/i) !== null;
    }
}

/**
 * 依赖分析工具类
 */
export class DependencyUtils {
    /**
     * 判断是否为框架
     */
    static isFramework(dep: string): boolean {
        const frameworks = ['vue', 'react', 'angular', 'svelte', 'next', 'nuxt', 'express', 'koa', 'nest'];
        return frameworks.some(framework => dep.includes(framework));
    }

    /**
     * 判断是否为构建工具
     */
    static isBuildTool(dep: string): boolean {
        const buildTools = ['webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'babel', 'typescript'];
        return buildTools.some(tool => dep.includes(tool));
    }

    /**
     * 判断是否为测试框架
     */
    static isTestingFramework(dep: string): boolean {
        const testFrameworks = ['jest', 'mocha', 'jasmine', 'cypress', 'playwright', 'vitest'];
        return testFrameworks.some(framework => dep.includes(framework));
    }

    /**
     * 判断是否为UI库
     */
    static isUILibrary(dep: string): boolean {
        const uiLibs = ['element', 'antd', 'vuetify', 'quasar', 'bootstrap', 'tailwind', 'material'];
        return uiLibs.some(lib => dep.includes(lib));
    }

    /**
     * 判断是否为状态管理库
     */
    static isStateManagement(dep: string): boolean {
        const stateLibs = ['vuex', 'pinia', 'redux', 'mobx', 'zustand'];
        return stateLibs.some(lib => dep.includes(lib));
    }

    /**
     * 判断是否为路由库
     */
    static isRouting(dep: string): boolean {
        const routingLibs = ['vue-router', 'react-router', 'next/router'];
        return routingLibs.some(lib => dep.includes(lib));
    }

    /**
     * 将依赖映射到技术栈
     */
    static mapDependencyToTechnology(dep: string): string | null {
        const techMap: { [key: string]: string } = {
            'vue': 'Vue.js',
            'react': 'React',
            'typescript': 'TypeScript',
            'vite': 'Vite',
            'webpack': 'Webpack',
            'tailwindcss': 'Tailwind CSS',
            'element-plus': 'Element Plus',
            'antd': 'Ant Design',
            'jest': 'Jest',
            'cypress': 'Cypress',
            'eslint': 'ESLint',
            'prettier': 'Prettier'
        };

        for (const [key, value] of Object.entries(techMap)) {
            if (dep.includes(key)) return value;
        }
        return null;
    }

    /**
     * 将文件扩展名映射到技术栈
     */
    static mapFileExtensionToTechnology(ext: string): string | null {
        const extMap: { [key: string]: string } = {
            '.vue': 'Vue.js',
            '.jsx': 'React',
            '.tsx': 'React + TypeScript',
            '.ts': 'TypeScript',
            '.scss': 'Sass',
            '.less': 'Less',
            '.styl': 'Stylus'
        };
        return extMap[ext] || null;
    }
}

/**
 * 代码分析工具类
 */
export class CodeAnalysisUtils {
    /**
     * 分析文件内容
     */
    static analyzeFileContent(content: string): {
        codeLines: number;
        commentLines: number;
        blankLines: number;
        complexity: number;
    } {
        const lines = content.split('\n');
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        let complexity = 1; // 基础复杂度

        lines.forEach(line => {
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
                blankLines++;
            } else if (trimmedLine.startsWith('//') ||
                trimmedLine.startsWith('*') ||
                trimmedLine.startsWith('/*') ||
                trimmedLine.startsWith('<!--')) {
                commentLines++;
            } else {
                codeLines++;

                // 计算圈复杂度
                const complexityPatterns = [
                    /\bif\b/, /\belse\b/, /\bfor\b/, /\bwhile\b/, /\bdo\b/,
                    /\bswitch\b/, /\bcase\b/, /\bcatch\b/, /\btry\b/,
                    /\&\&/, /\|\|/, /\?.*:/, /\bthrow\b/
                ];

                complexityPatterns.forEach(pattern => {
                    const matches = trimmedLine.match(pattern);
                    if (matches) {
                        complexity += matches.length;
                    }
                });
            }
        });

        return { codeLines, commentLines, blankLines, complexity };
    }

    /**
     * 计算文件复杂度
     */
    static calculateFileComplexity(filePath: string): number {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const stats = this.analyzeFileContent(content);
            return stats.complexity;
        } catch (error) {
            return 1;
        }
    }

    /**
     * 识别技术栈从实体
     */
    static identifyTechnologyFromEntity(entity: any): string[] {
        const technologies: string[] = [];

        if (entity.type === 'VueComponent') technologies.push('Vue.js');
        if (entity.type === 'ReactComponent') technologies.push('React');
        if (entity.file.endsWith('.ts') || entity.file.endsWith('.tsx')) technologies.push('TypeScript');

        return technologies;
    }
}

/**
 * 项目结构工具类
 */
export class ProjectUtils {
    /**
     * 查找主入口文件
     */
    static findMainEntries(projectPath: string): string[] {
        const entries: string[] = [];
        const possibleEntries = ['index.html', 'main.js', 'main.ts', 'app.js', 'app.ts', 'index.js', 'index.ts'];

        possibleEntries.forEach(entry => {
            const entryPath = path.join(projectPath, entry);
            if (fs.existsSync(entryPath)) {
                entries.push(entry);
            }
        });

        // 从src目录查找
        const srcPath = path.join(projectPath, 'src');
        if (fs.existsSync(srcPath)) {
            possibleEntries.forEach(entry => {
                const entryPath = path.join(srcPath, entry);
                if (fs.existsSync(entryPath)) {
                    entries.push(`src/${entry}`);
                }
            });
        }

        return entries;
    }

    /**
     * 查找配置文件
     */
    static findConfigFiles(projectPath: string): string[] {
        const configFiles: string[] = [];
        const configPatterns = [
            'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
            'vue.config.js', 'nuxt.config.js', 'next.config.js', 'tailwind.config.js',
            'babel.config.js', 'jest.config.js', 'cypress.config.js', 'playwright.config.js',
            'eslint.config.js', '.eslintrc.js', 'prettier.config.js', '.prettierrc.js',
            'docker-compose.yml', 'Dockerfile', '.env', '.env.example'
        ];

        configPatterns.forEach(pattern => {
            const configPath = path.join(projectPath, pattern);
            if (fs.existsSync(configPath)) {
                configFiles.push(pattern);
            }
        });

        return configFiles;
    }

    /**
     * 查找文档文件
     */
    static findDocumentation(projectPath: string): string[] {
        const docFiles: string[] = [];
        const docPatterns = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'docs/'];

        docPatterns.forEach(pattern => {
            const docPath = path.join(projectPath, pattern);
            if (fs.existsSync(docPath)) {
                docFiles.push(pattern);
            }
        });

        return docFiles;
    }

    /**
     * 读取 package.json 信息
     */
    static readPackageInfo(projectPath: string): any {
        const packagePath = path.join(projectPath, 'package.json');
        if (fs.existsSync(packagePath)) {
            try {
                return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            } catch (error) {
                console.warn('⚠️ 读取package.json失败:', error);
            }
        }
        return {};
    }

    /**
     * 检查是否有良好的文件夹结构
     */
    static hasGoodFolderStructure(projectPath: string): boolean {
        const importantDirs = ['src', 'components', 'utils'];
        return importantDirs.some(dir =>
            fs.existsSync(path.join(projectPath, dir))
        );
    }

    /**
     * 检查是否有基本的配置文件
     */
    static hasEssentialConfigFiles(projectPath: string): boolean {
        const configFiles = ['package.json', 'tsconfig.json'];
        return configFiles.every(file =>
            fs.existsSync(path.join(projectPath, file))
        );
    }
}

/**
 * API 分析工具类
 */
export class APIAnalysisUtils {
    /**
     * 判断是否为API函数
     */
    static isApiFunction(entity: any): boolean {
        return entity.CALLS?.some((call: string) => this.isHttpCall(call)) ||
            entity.file.includes('api') ||
            entity.file.includes('service');
    }

    /**
     * 判断是否为HTTP调用
     */
    static isHttpCall(call: string): boolean {
        const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'axios', 'fetch'];
        return httpMethods.some(method => call.toLowerCase().includes(method));
    }

    /**
     * 提取HTTP方法
     */
    static extractHttpMethod(call: string): string {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        for (const method of methods) {
            if (call.toLowerCase().includes(method.toLowerCase())) {
                return method;
            }
        }
        return 'GET';
    }

    /**
     * 提取API路径
     */
    static extractApiPath(call: string): string {
        // 简单的API路径提取逻辑
        const pathMatch = call.match(/['"`]([^'"`]*\/[^'"`]*)['"`]/);
        return pathMatch ? pathMatch[1] : '/api/endpoint';
    }

    /**
     * 判断是否为数据模型
     */
    static isDataModel(imp: string): boolean {
        return imp.includes('model') || imp.includes('interface') || imp.includes('type');
    }
} 