import * as path from 'path';
import * as fs from 'fs';
import { Project, SourceFile, SyntaxKind, Node, CallExpression, ImportDeclaration } from 'ts-morph';
import { parse } from '@vue/compiler-sfc';
import { jsonrepair } from 'jsonrepair';
import { BaseEntity, StaticAnalysisResult } from './interfaces';
import * as crypto from 'crypto';
import * as ts from 'typescript';
import { EntityIdGenerator } from '../extractors/EntityIdGenerator';

/**
 * 生成唯一的临时文件名
 */
function generateTempFileName(prefix: string): string {
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${randomStr}_temp.ts`;
}

export class StaticAnalyzer {
  private project: Project;
  private rootDir: string;
  // 缓存已分析过的文件中导出的实体
  private entityExportsCache: Map<string, Set<string>> = new Map();
  // 缓存文件路径到实体类型的映射
  private fileEntityTypeCache: Map<string, Map<string, string>> = new Map();
  // 跟踪创建的临时文件
  private tempFiles: Set<string> = new Set();
  // 存储所有已知的实体
  private entities: BaseEntity[];
  // 使用双Map优化查找速度：file -> (rawName -> entity)
  private entityMap: Map<string, Map<string, BaseEntity>> = new Map();
  // Workspace 依赖信息缓存
  private workspaceInfo: { packageNames: string[], packagePaths: string[] } | null = null;
  // TypeScript 路径别名配置
  private pathAliases: Map<string, string> = new Map();
  // 大仓根目录路径（包含pnpm-workspace.yaml的目录）
  private monoRepoRoot: string;

  constructor(rootDir: string, entities: BaseEntity[]) {
    this.rootDir = rootDir;
    this.entities = entities;
    // 查找并记录大仓根目录
    this.monoRepoRoot = this.findMonoRepoRoot(rootDir);
    console.log(`大仓根目录: ${this.monoRepoRoot}`);
    // 初始化双Map
    this.initEntityMap();
    // 初始化EntityIdGenerator的实体映射
    EntityIdGenerator.initEntityMap(entities);
    // 初始化workspace信息
    this.initWorkspaceInfo();
    // 初始化路径别名配置
    this.initPathAliases();
    this.project = new Project({
      // 尝试找到tsconfig.json，如果不存在则使用默认编译选项
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        jsx: ts.JsxEmit.React,
        allowJs: true,
        declaration: false,
        sourceMap: false,
        experimentalDecorators: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      } as any,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true // 使用内存文件系统避免写入磁盘
    });
  }

  /**
   * 设置新的实体列表并重新初始化相关映射
   * @param entities 新的实体列表
   */
  setEntities(entities: BaseEntity[]): void {
    this.entities = entities;
    // 重新初始化双Map
    this.initEntityMap();
    // 重新初始化EntityIdGenerator的实体映射
    EntityIdGenerator.initEntityMap(entities);
  }

  /**
   * 查找大仓根目录（向上查找包含pnpm-workspace.yaml的目录）
   */
  private findMonoRepoRoot(dir: string): string {
    const pnpmWorkspacePath = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspacePath)) {
      console.log(`找到大仓根目录: ${dir}`);
      return dir;
    }
    
    // 检查是否还有package.json作为备用判断
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // 如果package.json中有workspaces字段，也认为是大仓根目录
        if (packageJson.workspaces) {
          console.log(`通过package.json找到大仓根目录: ${dir}`);
          return dir;
        }
      } catch (error) {
        // 忽略解析错误，继续向上查找
      }
    }
    
    const parentDir = path.dirname(dir);
    if (parentDir !== dir) {
      return this.findMonoRepoRoot(parentDir);
    }
    
    // 如果没有找到大仓根目录，返回原始目录作为兜底
    console.warn(`未找到大仓根目录，使用原始目录: ${this.rootDir}`);
    return this.rootDir;
  }

  /**
   * 初始化实体查找Map
   */
  private initEntityMap(): void {
    for (const entity of this.entities) {
      if (!this.entityMap.has(entity.file)) {
        this.entityMap.set(entity.file, new Map());
      }
      this.entityMap.get(entity.file)!.set(entity.rawName, entity);
    }
  }

  /**
   * 初始化workspace信息
   */
  private initWorkspaceInfo(): void {
    this.workspaceInfo = this.getWorkspaceInfo();
  }

  /**
   * 获取项目实际依赖的workspace包信息
   */
  private getWorkspaceInfo(): { packageNames: string[], packagePaths: string[] } {
    const packageNames: string[] = [];
    const packagePaths: string[] = [];
    
    try {
      // 直接通过工作区配置发现所有workspace包
      const workspacePatterns = this.getWorkspacePatterns();
      console.log(`发现workspace模式: ${workspacePatterns.join(', ')}`);
      
      for (const pattern of workspacePatterns) {
        const possiblePaths = this.resolveWorkspacePattern(pattern);
        console.log(`模式 ${pattern} 解析到路径: ${possiblePaths.join(', ')}`);
        
        for (const possiblePath of possiblePaths) {
          const possiblePackageJsonPath = path.join(possiblePath, 'package.json');
          if (fs.existsSync(possiblePackageJsonPath)) {
            try {
              const possiblePackageJson = JSON.parse(fs.readFileSync(possiblePackageJsonPath, 'utf-8'));
              if (possiblePackageJson.name) {
                packageNames.push(possiblePackageJson.name);
                packagePaths.push(possiblePath);
                console.log(`发现workspace包: ${possiblePackageJson.name} -> ${possiblePath}`);
              }
            } catch (error) {
              console.warn(`解析workspace包 ${possiblePath} 的package.json失败:`, error);
            }
          }
        }
      }
      
      // 收集有显式workspace依赖的包名（作为备用）
      // const packageJsonPath = path.join(this.rootDir, 'package.json');
      // if (fs.existsSync(packageJsonPath)) {
      //   const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
      //   const collectWorkspaceDeps = (deps: Record<string, string> = {}) => {
      //     Object.entries(deps).forEach(([name, version]) => {
      //       if (version.startsWith('workspace:') && !packageNames.includes(name)) {
      //         packageNames.push(name);
              
      //         // 尝试通过node_modules符号链接解析
      //         const nodeModulesPath = path.join(this.rootDir, 'node_modules');
      //         if (fs.existsSync(nodeModulesPath)) {
      //           const packagePath = path.join(nodeModulesPath, name);
                
      //           try {
      //             if (fs.existsSync(packagePath)) {
      //               const stat = fs.lstatSync(packagePath);
      //               // 如果是符号链接，解析到真实路径
      //               if (stat.isSymbolicLink()) {
      //                 const realPath = fs.realpathSync(packagePath);
      //                 packagePaths.push(realPath);

      //               }
      //             }
      //           } catch (error) {
      //             console.warn(`处理workspace包 ${name} 时出错:`, (error as Error).message);
      //           }
      //         }
      //       }
      //     });
      //   };
        
      //   collectWorkspaceDeps(packageJson.dependencies);
      //   collectWorkspaceDeps(packageJson.devDependencies);
      //   collectWorkspaceDeps(packageJson.peerDependencies);
      // }
    } catch (error) {
      console.error('获取workspace信息时出错:', error);
    }
    
    if (packageNames.length === 0) {
      console.warn('未发现任何workspace包，请检查workspace配置');
    } else {
      console.log(`workspace信息收集完成: 发现${packageNames.length}个包: ${packageNames.join(', ')}`);
    }

    return { packageNames, packagePaths };
  }

  /**
   * 获取工作区模式配置
   */
  private getWorkspacePatterns(): string[] {
    const patterns: string[] = [];
    
    // 基于大仓根目录检查pnpm-workspace.yaml
    const pnpmWorkspacePath = path.join(this.monoRepoRoot, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspacePath)) {
      try {
        const yamlContent = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
        const packagesMatch = yamlContent.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
        if (packagesMatch) {
          const packageLines = packagesMatch[1].trim().split('\n');
          for (const line of packageLines) {
            const pattern = line.replace(/^\s*-\s*['"]?|['"]?\s*$/g, '');
            if (pattern) {
              patterns.push(pattern);
              console.log(`从pnpm-workspace.yaml获取模式: ${pattern}`);
            }
          }
        }
      } catch (error) {
        console.warn('解析pnpm-workspace.yaml失败:', error);
      }
    }
    
    // 基于大仓根目录检查package.json的workspaces字段
    const packageJsonPath = path.join(this.monoRepoRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.workspaces) {
          if (Array.isArray(packageJson.workspaces)) {
            patterns.push(...packageJson.workspaces);
            console.log(`从package.json获取模式: ${packageJson.workspaces.join(', ')}`);
          } else if (packageJson.workspaces.packages) {
            patterns.push(...packageJson.workspaces.packages);
            console.log(`从package.json获取模式: ${packageJson.workspaces.packages.join(', ')}`);
          }
        }
      } catch (error) {
        console.warn('解析package.json workspaces失败:', error);
      }
    }
    
    return patterns;
  }

  /**
   * 解析工作区模式到实际路径
   */
  private resolveWorkspacePattern(pattern: string): string[] {
    const results: string[] = [];
    
    try {
      console.log(`开始解析workspace模式: ${pattern}, 基于大仓根目录: ${this.monoRepoRoot}`);
      
      if (pattern.includes('*')) {
        // 处理各种glob模式
        const candidatePaths = this.expandGlobPattern(pattern, this.monoRepoRoot);
        // 过滤出真正的workspace包
        results.push(...this.filterValidWorkspacePackages(candidatePaths));
      } else {
        // 直接路径，基于大仓根目录解析
        const fullPath = path.resolve(this.monoRepoRoot, pattern);
        if (this.isValidWorkspacePackage(fullPath)) {
          results.push(fullPath);
          console.log(`直接路径解析成功: ${pattern} -> ${fullPath}`);
        }
      }
    } catch (error) {
      console.warn(`解析工作区模式 ${pattern} 失败:`, error);
    }
    
    console.log(`模式 ${pattern} 解析结果数量: ${results.length}`);
    if (results.length > 0) {
      console.log(`有效workspace包: ${results.slice(0, 3).join(', ')}${results.length > 3 ? '...' : ''}`);
    }
    return results;
  }

  /**
   * 展开glob模式（支持 *, **, /\*\*\/* 等复杂模式）
   */
  private expandGlobPattern(pattern: string, basePath: string): string[] {
    const results: string[] = [];
    
    // 预处理模式：标准化路径分隔符
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    // 检查是否包含递归通配符 **
    if (normalizedPattern.includes('**')) {
      results.push(...this.expandRecursivePattern(normalizedPattern, basePath));
    } else {
      // 处理简单的单层通配符
      results.push(...this.expandSimplePattern(normalizedPattern, basePath));
    }
    
    return results;
  }

  /**
   * 展开递归模式（包含 ** 的模式）
   */
  private expandRecursivePattern(pattern: string, basePath: string): string[] {
    const results: string[] = [];
    
    // 处理形如 packages/\*\*, packages/\*\*/\*, \*\*/\* 等模式
    if (pattern === '**' || pattern === '**/*') {
      // 递归查找所有目录
      results.push(...this.findAllDirectories(basePath, true));
    } else if (pattern.startsWith('**/')) {
      // 形如 \*\*/subpath 的模式
      const subPattern = pattern.substring(3);
      const allDirs = this.findAllDirectories(basePath, true);
      for (const dir of allDirs) {
        const subResults = this.expandGlobPattern(subPattern, dir);
        results.push(...subResults);
      }
    } else if (pattern.endsWith('/**')) {
      // 形如 packages/\*\* 的模式
      const prefix = pattern.substring(0, pattern.length - 3);
      const prefixPath = path.join(basePath, prefix);
      if (fs.existsSync(prefixPath)) {
        results.push(...this.findAllDirectories(prefixPath, true));
      }
    } else if (pattern.endsWith('/**/*')) {
      // 形如 packages/\*\*/\* 的模式
      const prefix = pattern.substring(0, pattern.length - 5);
      const prefixPath = path.join(basePath, prefix);
      if (fs.existsSync(prefixPath)) {
        results.push(...this.findAllDirectories(prefixPath, true));
      }
    } else {
      // 包含 ** 的复杂模式，按 ** 分割处理
      const parts = pattern.split('**');
      if (parts.length === 2) {
        const [prefix, suffix] = parts;
        let searchPaths = [basePath];
        
        // 处理前缀
        if (prefix && prefix !== '/') {
          const cleanPrefix = prefix.replace(/\/$/, '');
          searchPaths = [path.join(basePath, cleanPrefix)];
        }
        
        // 递归查找所有目录
        const allDirs: string[] = [];
        for (const searchPath of searchPaths) {
          if (fs.existsSync(searchPath)) {
            allDirs.push(...this.findAllDirectories(searchPath, true));
          }
        }
        
        // 处理后缀
        if (suffix && suffix !== '/' && suffix !== '/*') {
          const cleanSuffix = suffix.replace(/^\//, '');
          for (const dir of allDirs) {
            const subResults = this.expandGlobPattern(cleanSuffix, dir);
            results.push(...subResults);
          }
        } else {
          results.push(...allDirs);
        }
      }
    }
    
    return results;
  }

  /**
   * 展开简单模式（只包含单层通配符 * 的模式）
   */
  private expandSimplePattern(pattern: string, basePath: string): string[] {
    const results: string[] = [];
    const parts = pattern.split('/');
    let currentPaths = [basePath];
    
    for (const part of parts) {
      if (part === '*') {
        const newPaths: string[] = [];
        for (const currentPath of currentPaths) {
          if (fs.existsSync(currentPath)) {
            const entries = fs.readdirSync(currentPath);
            for (const entry of entries) {
              // 跳过不应该包含workspace包的目录
              if (this.shouldSkipDirectory(entry)) {
                continue;
              }
              
              const entryPath = path.join(currentPath, entry);
              if (fs.statSync(entryPath).isDirectory()) {
                newPaths.push(entryPath);
              }
            }
          }
        }
        currentPaths = newPaths;
      } else if (part !== '') {
        currentPaths = currentPaths.map(p => path.join(p, part));
      }
    }
    
    results.push(...currentPaths.filter(p => fs.existsSync(p) && fs.statSync(p).isDirectory()));
    return results;
  }

  /**
   * 递归查找目录下的所有子目录
   */
  private findAllDirectories(rootPath: string, includeRoot: boolean = false): string[] {
    const results: string[] = [];
    
    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      return results;
    }
    
    if (includeRoot) {
      results.push(rootPath);
    }
    
    try {
      const entries = fs.readdirSync(rootPath);
      for (const entry of entries) {
        // 跳过不应该包含workspace包的目录
        if (this.shouldSkipDirectory(entry)) {
          continue;
        }
        
        const entryPath = path.join(rootPath, entry);
        const stat = fs.statSync(entryPath);
        
        if (stat.isDirectory()) {
          results.push(entryPath);
          // 递归查找子目录（但不要递归太深，避免性能问题）
          const depth = entryPath.split(path.sep).length - rootPath.split(path.sep).length;
          if (depth < 3) { // 限制递归深度
            results.push(...this.findAllDirectories(entryPath, false));
          }
        }
      }
    } catch (error) {
      console.warn(`读取目录失败: ${rootPath}`, error);
    }
    
    return results;
  }

  /**
   * 检查是否应该跳过某个目录
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const excludedDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage',
      'tmp',
      'temp',
      '.DS_Store',
      'logs',
      '.next',
      '.nuxt',
      'out',
      'target',
      'bin',
      'obj'
    ];
    
    return excludedDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * 过滤出有效的workspace包
   */
  private filterValidWorkspacePackages(candidatePaths: string[]): string[] {
    const validPackages: string[] = [];
    
    for (const candidatePath of candidatePaths) {
      if (this.isValidWorkspacePackage(candidatePath)) {
        validPackages.push(candidatePath);
      }
    }
    
    return validPackages;
  }

  /**
   * 检查目录是否为有效的workspace包
   */
  private isValidWorkspacePackage(dirPath: string): boolean {
    try {
      // 1. 检查目录是否存在
      if (!fs.existsSync(dirPath)) {
        return false;
      }

      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return false;
      }

      // 2. 过滤掉不应该是workspace包的目录
      const dirName = path.basename(dirPath);
      const excludedDirs = [
        'node_modules',
        '.git',
        '.vscode',
        '.idea',
        'dist',
        'build',
        'coverage',
        'tmp',
        'temp',
        '.DS_Store',
        'logs'
      ];
      
      if (excludedDirs.includes(dirName) || dirName.startsWith('.')) {
        return false;
      }

      // 3. 检查是否包含package.json
      const packageJsonPath = path.join(dirPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return false;
      }

      // 4. 检查package.json是否有效且包含name字段
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        
        // 必须有name字段
        if (!packageJson.name || typeof packageJson.name !== 'string') {
          console.log(`跳过无效包(缺少name字段): ${dirPath}`);
          return false;
        }

        // 过滤掉一些明显不是应用包的包
        const excludedNames = [
          'eslint-config',
          'prettier-config',
          'tsconfig'
        ];
        
        const isExcludedName = excludedNames.some(excluded => 
          packageJson.name.includes(excluded)
        );
        
        if (isExcludedName) {
          console.log(`跳过配置包: ${packageJson.name} at ${dirPath}`);
          return false;
        }

        // 5. 可选：检查是否有常见的项目文件结构
        const hasSourceFiles = this.hasSourceFiles(dirPath);
        if (!hasSourceFiles) {
          console.log(`跳过无源码包: ${packageJson.name} at ${dirPath}`);
          return false;
        }

        console.log(`发现有效workspace包: ${packageJson.name} at ${dirPath}`);
        return true;

      } catch (error) {
        console.log(`跳过无效package.json: ${dirPath} - ${(error as Error).message}`);
        return false;
      }

    } catch (error) {
      console.warn(`检查workspace包失败: ${dirPath} - ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 检查目录是否包含源代码文件
   */
  private hasSourceFiles(dirPath: string): boolean {
    const commonSourceDirs = ['src', 'lib', 'app', 'components', 'pages', 'views'];
    const commonSourceFiles = [
      'index.js', 'index.ts', 'index.jsx', 'index.tsx', 'index.vue',
      'main.js', 'main.ts', 'app.js', 'app.ts', 'server.js', 'server.ts'
    ];

    try {
      // 检查是否有源码目录
      for (const sourceDir of commonSourceDirs) {
        const sourceDirPath = path.join(dirPath, sourceDir);
        if (fs.existsSync(sourceDirPath) && fs.statSync(sourceDirPath).isDirectory()) {
          return true;
        }
      }

      // 检查根目录是否有常见的入口文件
      for (const sourceFile of commonSourceFiles) {
        const sourceFilePath = path.join(dirPath, sourceFile);
        if (fs.existsSync(sourceFilePath)) {
          return true;
        }
      }

      // 检查是否至少有一些JS/TS/Vue文件
      const entries = fs.readdirSync(dirPath);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        if (fs.statSync(entryPath).isFile()) {
          const ext = path.extname(entry).toLowerCase();
          if (['.js', '.ts', '.jsx', '.tsx', '.vue', '.json'].includes(ext)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查模块是否为workspace包
   */
  private isWorkspaceModule(moduleSpecifier: string, resolvedPath: string): boolean {
    if (!this.workspaceInfo) return false;
    
    // 检查是否是workspace包名
    if (this.workspaceInfo.packageNames.includes(moduleSpecifier)) {
      return true;
    }
    
    // 检查解析后的路径是否在workspace包路径内
    for (const workspacePath of this.workspaceInfo.packagePaths) {
      if (resolvedPath.startsWith(workspacePath + path.sep) || resolvedPath === workspacePath) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 添加临时文件到项目中用于分析
   */
  private addTempSourceFile(fileName: string, content: string): SourceFile {
    try {
      // 使用唯一的临时文件名，避免冲突
      const tempFileName = this.generateTempFileName();
      // 使用完整的文件路径，包括原始文件的目录结构
      const tempFilePath = path.join(path.dirname(fileName), tempFileName);
      const sf = this.project.createSourceFile(tempFilePath, content, { overwrite: true });
      this.tempFiles.add(tempFilePath);
      return sf;
    } catch (error) {
      console.error(`创建临时文件失败: ${error}`);
      // 如果无法创建文件，创建一个空文件以避免null引用错误
      return this.project.createSourceFile('empty.ts', '', { overwrite: true });
    }
  }

  /**
   * 生成唯一的临时文件名
   */
  private generateTempFileName(): string {
    // 使用时间戳和随机数创建唯一文件名
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `temp_${timestamp}_${random}.ts`;
  }

  /**
   * 清理分析过程中创建的临时文件
   */
  private cleanupTempFiles(): void {
    // 从项目中移除所有临时文件
    this.tempFiles.forEach(file => {
      try {
        const sourceFile = this.project.getSourceFile(file);
        if (sourceFile) {
          this.project.removeSourceFile(sourceFile);
        }
      } catch (error) {
        console.error(`删除临时文件 ${file} 失败: ${error}`);
      }
    });
    this.tempFiles.clear();
  }

  /**
   * 提取实体相关的注释
   */
  private extractAnnotation(sf: SourceFile, entity: BaseEntity, isOri: boolean = false): string | undefined {
    try {
      // 如果是Vue文件，优先尝试提取script中的注释
      if (entity.file.endsWith('.vue')) {
        try {
          const content = fs.readFileSync(path.join(this.rootDir, entity.file), 'utf-8');
          const { descriptor } = parse(content);
          
          // 处理script部分的注释
          if (descriptor.script || descriptor.scriptSetup) {
            // 优先处理 scriptSetup
            if (descriptor.scriptSetup) {
              const tempSf = this.addTempSourceFile('temp.ts', descriptor.scriptSetup.content);
              
              // 获取所有节点
              const statements = tempSf.getStatements();
              if (statements.length > 0) {
                // 获取第一个节点的前导注释
                const firstStatement = statements[0];
                const leadingComments = firstStatement.getLeadingCommentRanges();
                if (leadingComments.length > 0) {
                  return leadingComments
                    .map(comment => {
                      const text = comment.getText();
                      if (isOri) {
                        return text;
                      }
                      // 处理多行注释
                      if (text.startsWith('/*')) {
                        return text
                          .replace(/^\/\*|\*\/$/g, '') // 移除注释标记
                          .replace(/^\s*\*\s?/gm, '') // 移除每行开头的 * 和空格
                          .trim();
                      }
                      // 处理单行注释
                      else if (text.startsWith('//')) {
                        return text.replace(/^\/\/\s?/, '').trim();
                      }
                      return text;
                    })
                    .join('\n')
                    .trim();
                }
              }
            }
            // 如果没有 scriptSetup 或没有找到注释，尝试 script
            if (descriptor.script) {
              const tempSf = this.addTempSourceFile('temp.ts', descriptor.script.content);
              
              // 获取所有节点
              const statements = tempSf.getStatements();
              if (statements.length > 0) {
                // 获取第一个节点的前导注释
                const firstStatement = statements[0];
                const leadingComments = firstStatement.getLeadingCommentRanges();
                if (leadingComments.length > 0) {
                  return leadingComments
                    .map(comment => {
                      const text = comment.getText();
                      if (isOri) {
                        return text;
                      }
                      // 处理多行注释
                      if (text.startsWith('/*')) {
                        return text
                          .replace(/^\/\*|\*\/$/g, '') // 移除注释标记
                          .replace(/^\s*\*\s?/gm, '') // 移除每行开头的 * 和空格
                          .trim();
                      }
                      // 处理单行注释
                      else if (text.startsWith('//')) {
                        return text.replace(/^\/\/\s?/, '').trim();
                      }
                      return text;
                    })
                    .join('\n')
                    .trim();
                }
              }
            }
          }
          // 如果没有找到script中的注释，尝试提取template中的注释
          if (descriptor.template) {
            const content = descriptor.template.content;
            // 先查找注释
            const commentMatch = content.match(/^\s*<!--[\s\S]*?-->/);
            if (commentMatch) {
              if (isOri) {
                return commentMatch[0].trim();
              }
              return commentMatch[0]
                .replace(/<!--|-->/g, '') // 移除注释标记
                .trim();
            }
          }
        } catch (error) {
          console.warn(`提取Vue文件注释失败: ${(error as Error).message}`);
        }
      } else {
        // 非Vue文件，直接提取JS/TS注释
        return this.extractJSComments(sf, entity, isOri);
      }

      return undefined;
    } catch (error) {
      console.error(`提取注释失败: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * 提取JS/TS注释
   */
  private extractJSComments(sf: SourceFile, entity: BaseEntity, isOri: boolean = false): string | undefined {
    try {
      // 查找所有可能的节点类型
      const exportDeclarations = sf.getExportDeclarations();
      const exportAssignments = sf.getExportAssignments();
      const functions = sf.getFunctions();
      const classes = sf.getClasses();
      const interfaces = sf.getInterfaces();
      const typeAliases = sf.getTypeAliases();
      const enums = sf.getEnums();
      const variables = sf.getVariableDeclarations();
      const variableStatements = sf.getVariableStatements();

      // 检查所有可能的导出节点
      const allNodes = [
        ...exportDeclarations,
        ...exportAssignments,
        ...functions,
        ...classes,
        ...interfaces,
        ...typeAliases,
        ...enums,
        ...variables,
        ...variableStatements
      ];

      // 首先尝试精确匹配
      for (const node of allNodes) {
        // 获取节点名称
        let nodeName: string | undefined;
        let shouldMatch = false;
        
        if ('getName' in node && typeof node.getName === 'function') {
          nodeName = node.getName();
          shouldMatch = true;
        } else if (Node.isExportAssignment(node)) {
          // 对于默认导出，检查导出表达式的名称
          const expression = node.getExpression();
          if (Node.isIdentifier(expression)) {
            nodeName = expression.getText();
            shouldMatch = true;
          }
        } else if (Node.isVariableStatement(node)) {
          // 处理变量声明语句
          const declarations = node.getDeclarations();
          for (const decl of declarations) {
            if (decl.getName() === entity.rawName) {
              nodeName = decl.getName();
              shouldMatch = true;
              break;
            }
          }
        }

        // 如果找到匹配的节点
        if (shouldMatch && nodeName === entity.rawName) {
          // 获取前导注释
          const leadingComments = node.getLeadingCommentRanges();
          if (leadingComments.length > 0) {
            return this.formatComments(leadingComments, isOri);
          }

          // 如果没有前导注释，尝试获取后置注释
          const trailingComments = node.getTrailingCommentRanges();
          if (trailingComments.length > 0) {
            return this.formatComments(trailingComments, isOri);
          }
        }
      }

      // 如果精确匹配失败，尝试查找export语句中的变量
      for (const node of exportDeclarations) {
        if (Node.isExportDeclaration(node)) {
          const namedExports = node.getNamedExports();
          for (const namedExport of namedExports) {
            if (namedExport.getName() === entity.rawName) {
              // 找到匹配的导出，获取其注释
              const leadingComments = node.getLeadingCommentRanges();
              if (leadingComments.length > 0) {
                return this.formatComments(leadingComments, isOri);
              }
            }
          }
        }
      }

      // 最后尝试通过文本搜索找到相关注释（适用于复杂的导出情况）
      const sourceText = sf.getFullText();
      const entityPattern = new RegExp(`\\b${entity.rawName}\\b`, 'g');
      let match;
      const matches = [];
      
      while ((match = entityPattern.exec(sourceText)) !== null) {
        matches.push(match.index);
      }

      // 检查每个匹配位置前面是否有注释
      for (const matchIndex of matches) {
        const beforeText = sourceText.substring(0, matchIndex);
        
        // 查找最近的注释
        const commentMatches = [];
        
        // 提取JSDoc注释
        const jsdocMatches = beforeText.match(/\/\*\*[\s\S]*?\*\//g);
        if (jsdocMatches) {
          for (const match of jsdocMatches) {
            commentMatches.push({ 0: match, index: beforeText.indexOf(match) });
          }
        }
        
        // 提取单行注释
        const lineMatches = beforeText.match(/\/\/.*$/gm);
        if (lineMatches) {
          for (const match of lineMatches) {
            commentMatches.push({ 0: match, index: beforeText.indexOf(match) });
          }
        }
        
        if (commentMatches.length > 0) {
          const lastComment = commentMatches[commentMatches.length - 1];
          const commentEnd = lastComment.index + lastComment[0].length;
          const textBetween = sourceText.substring(commentEnd, matchIndex);
          
          // 检查注释和实体之间是否只有空白字符和关键字
          if (/^\s*(export\s+)?(const|let|var|function|class)?\s*$/.test(textBetween)) {
            const commentText = lastComment[0];
            return this.formatCommentText(commentText, isOri);
          }
        }
      }

    } catch (error) {
      console.warn(`提取JS/TS注释失败: ${(error as Error).message}`);
    }

    return undefined;
  }

  /**
   * 格式化注释范围
   */
  private formatComments(comments: any[], isOri: boolean): string {
    return comments
      .map(comment => {
        const text = comment.getText();
        return this.formatCommentText(text, isOri);
      })
      .join('\n')
      .trim();
  }

  /**
   * 格式化注释文本
   */
  private formatCommentText(text: string, isOri: boolean): string {
    if (isOri) {
      return text;
    }
    // 处理多行注释
    if (text.startsWith('/*')) {
      return text
        .replace(/^\/\*+|\*+\/$/g, '') // 移除注释标记
        .replace(/^\s*\*\s?/gm, '') // 移除每行开头的 * 和空格
        .trim();
    }
    // 处理单行注释
    else if (text.startsWith('//')) {
      return text.replace(/^\/\/\s?/, '').trim();
    }
    return text;
  }

  /**
   * 分析实体并提取静态信息
   */
  async analyzeEntity(entity: BaseEntity): Promise<StaticAnalysisResult> {
    // 在每次新的分析开始时清理之前的临时文件
    this.cleanupTempFiles();

    const filePath = path.join(this.rootDir, entity.file);
    console.log('分析文件:', filePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`文件不存在: ${filePath}`);
      return { IMPORTS: [], CALLS: [], EMITS: [] };
    }

    try {
      let result: StaticAnalysisResult;
      if (filePath.endsWith('.vue')) {
        result = await this.analyzeVueFile(filePath, entity);
      } else if (filePath.endsWith('.tsx')) {
        result = this.analyzeTSXFile(filePath, entity);
      } else if (filePath.endsWith('.ts')) {
        result = this.analyzeTSFile(filePath, entity);
      } else {
        console.warn(`不支持的文件类型: ${filePath}`);
        return { IMPORTS: [], CALLS: [], EMITS: [] };
      }

      // 提取注释
      const content = fs.readFileSync(filePath, 'utf-8');
      const sf = this.addTempSourceFile(path.basename(filePath), content);
      result.ANNOTATION = this.extractAnnotation(sf, entity);
      result.ORI_ANNOTATION = this.extractAnnotation(sf, entity);
      console.log('注释:', result.ANNOTATION);

      return result;
    } catch (error) {
      console.error(`分析文件失败 ${filePath}: ${(error as Error).message}`);
      return { IMPORTS: [], CALLS: [], EMITS: [] };
    } finally {
      // 在分析结束后清理临时文件
      this.cleanupTempFiles();
    }
  }

  /**
   * 分析Vue文件
   */
  private async analyzeVueFile(filePath: string, entity: BaseEntity): Promise<StaticAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { descriptor } = parse(content);
    
    const result: StaticAnalysisResult = {
      IMPORTS: [],
      CALLS: [],
      EMITS: [],
      TEMPLATE_COMPONENTS: []
    };

    // 分析script部分
    if (descriptor.script || descriptor.scriptSetup) {
      const scripts: string[] = [];
      if (descriptor.script) scripts.push(descriptor.script.content);
      if (descriptor.scriptSetup) scripts.push(descriptor.scriptSetup.content);
      
      const sf = this.addTempSourceFile(filePath, scripts.join('\n'));
      if (sf) {
        this.extractImports(sf, result, filePath);
        this.extractCalls(sf, result, filePath);
        this.extractEmits(sf, result);
      }
    }

    // 分析template部分
    if (descriptor.template) {
      this.extractTemplateComponents(descriptor.template.content, result);
    }

    return result;
  }

  /**
   * 分析TSX文件
   */
  private analyzeTSXFile(filePath: string, entity: BaseEntity): StaticAnalysisResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sf = this.addTempSourceFile(filePath, content);
    
    const result: StaticAnalysisResult = {
      IMPORTS: [],
      CALLS: [],
      EMITS: []
    };

    this.extractImports(sf, result, filePath);
    this.extractCalls(sf, result, filePath);
    this.extractJsxEmits(sf, result);

    return result;
  }

  /**
   * 分析TS文件
   */
  private analyzeTSFile(filePath: string, entity: BaseEntity): StaticAnalysisResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sf = this.addTempSourceFile(filePath, content);
    
    const result: StaticAnalysisResult = {
      IMPORTS: [],
      CALLS: [],
      EMITS: []
    };

    this.extractImports(sf, result, filePath);
    this.extractCalls(sf, result, filePath);

    return result;
  }

  /**
   * 根据文件路径和导出名称生成实体ID
   */
  private generateEntityId(filePath: string, exportName: string, isDefaultExport: boolean = false): string {
    return EntityIdGenerator.generateIdByLookup(filePath, exportName, isDefaultExport, this.rootDir);
  }

  /**
   * 解析TypeScript路径别名（通用版本）
   */
  private resolveTypeScriptAlias(moduleSpecifier: string, projectRoot: string): string | null {
    // 按别名长度从长到短排序，避免短别名误匹配长路径
    const sortedAliases = Array.from(this.pathAliases.entries()).sort(([a], [b]) => b.length - a.length);
    
    for (const [alias, target] of sortedAliases) {
      // 确保精确匹配：别名后必须是/或者是完整匹配
      if (moduleSpecifier === alias || moduleSpecifier.startsWith(alias + '/')) {
        // 替换别名部分
        const relativePath = moduleSpecifier.replace(alias, '');
        const resolvedPath = path.join(target, relativePath);
        
        console.log(`解析路径别名: ${moduleSpecifier} (${alias}) -> ${resolvedPath}`);
        return resolvedPath;
      }
    }
    
    return null;
  }

  /**
   * 检查模块是否为第三方库
   */
  private isThirdPartyModule(moduleSpecifier: string): boolean {
    // 第三方库特征：
    // 1. 不以 . 或 / 开头（相对路径）
    // 2. 不匹配任何配置的路径别名
    // 3. 不是workspace包
    if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
      return false;
    }
    
    // 检查是否匹配路径别名
    // 按别名长度从长到短排序，避免短别名误匹配长路径
    const sortedAliases = Array.from(this.pathAliases.keys()).sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      // 确保精确匹配：别名后必须是/或者是完整匹配
      if (moduleSpecifier === alias || moduleSpecifier.startsWith(alias + '/')) {
        console.log(`模块 ${moduleSpecifier} 匹配路径别名 ${alias}`);
        return false;
      }
    }
    
    // 检查是否为workspace包
    const isWorkspacePackage = this.workspaceInfo?.packageNames.some(pkgName => 
      moduleSpecifier === pkgName || moduleSpecifier.startsWith(pkgName + '/')
    );
    
    console.log(`检查模块 ${moduleSpecifier} 是否为第三方库: 是否workspace包=${isWorkspacePackage}, 结果=${!isWorkspacePackage}`);
    
    return !isWorkspacePackage;
  }

  /**
   * 提取导入声明
   */
  private extractImports(sf: SourceFile, result: StaticAnalysisResult, realFilePath?: string): void {
    const entityIds: string[] = [];
    
    sf.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      console.log(`检查导入: ${moduleSpecifier}`);
      
      // 检查是否为第三方库，如果是则跳过
      if (this.isThirdPartyModule(moduleSpecifier)) {
        console.log(`跳过第三方库: ${moduleSpecifier}`);
        return;
      }
      
      let resolvedPath = '';
      let isWorkspace = false;
      let isInternal = false; // 标记是否为内部相对路径导入
      
      // 处理相对路径导入
      if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
        // 使用真实的文件路径而不是临时文件路径
        const currentFilePath = realFilePath || sf.getFilePath();
        resolvedPath = this.resolveModulePath(moduleSpecifier, currentFilePath);
        if (resolvedPath) {
          isWorkspace = this.isWorkspaceModule(moduleSpecifier, resolvedPath);
          isInternal = true; // 相对路径导入都被认为是内部导入
        }
      }
      // 处理TypeScript别名路径（通用支持 @、~、等配置的别名）
      else {
        const aliasPath = this.resolveTypeScriptAlias(moduleSpecifier, this.rootDir);
        if (aliasPath) {
          // 尝试解析文件扩展名
          const extensions = ['.vue', '.ts', '.tsx', '.js', '.jsx'];
          for (const ext of extensions) {
            const pathWithExt = aliasPath + ext;
            if (fs.existsSync(pathWithExt)) {
              resolvedPath = pathWithExt;
              break;
            }
          }
          
          // 如果没有找到带扩展名的文件，尝试作为目录处理
          if (!resolvedPath && fs.existsSync(aliasPath) && fs.statSync(aliasPath).isDirectory()) {
            for (const ext of extensions) {
              const indexPath = path.join(aliasPath, 'index' + ext);
              if (fs.existsSync(indexPath)) {
                resolvedPath = indexPath;
                break;
              }
            }
          }
          
          if (resolvedPath) {
            isInternal = true;
            console.log(`解析TS别名: ${moduleSpecifier} -> ${resolvedPath}`);
          }
        }
        // 如果不是别名路径，检查workspace包
        else {
          const isWorkspacePackage = this.workspaceInfo?.packageNames.some(pkgName => 
            moduleSpecifier === pkgName || moduleSpecifier.startsWith(pkgName + '/')
          );
          
          if (isWorkspacePackage) {
            let workspaceRealPath = this.findWorkspaceRealPath(moduleSpecifier);
            
            // 如果是子路径导入，需要解析到具体文件
            if (moduleSpecifier.includes('/')) {
              const [packageName, ...subPath] = moduleSpecifier.split('/');
              const baseWorkspacePath = this.findWorkspaceRealPath(packageName);
              
              if (baseWorkspacePath && subPath.length > 0) {
                const resolvedSubPath = this.resolveModulePath('./' + subPath.join('/'), baseWorkspacePath + '/dummy.ts');
                if (resolvedSubPath && fs.existsSync(resolvedSubPath)) {
                  workspaceRealPath = resolvedSubPath;
                }
              }
            }
            
            if (workspaceRealPath) {
              resolvedPath = workspaceRealPath;
              isWorkspace = true;
            }
          }
        }
      }
      
      // 处理workspace模块或内部相对路径导入
      if (isWorkspace || isInternal) {
        if (resolvedPath) {
          console.log(`收集${isWorkspace ? 'workspace' : '内部'}导入: ${moduleSpecifier} -> ${resolvedPath}`);
          
          // 获取这个模块导出的所有实体
          const moduleExports = this.analyzeModuleExports(resolvedPath);
          console.log(`模块 ${moduleSpecifier} 导出: ${Array.from(moduleExports).join(', ')}`);
          
          // 获取默认导入
          const defaultImport = importDecl.getDefaultImport();
          if (defaultImport && (moduleExports.has('default') || moduleExports.size > 0)) {
            const importName = defaultImport.getText();
            entityIds.push(this.generateEntityId(resolvedPath, importName, true));
            console.log(`记录默认导入: ${importName} <- ${moduleSpecifier}`);
          }
          
          // 获取命名导入
          importDecl.getNamedImports().forEach(namedImport => {
            const name = namedImport.getName();
            console.log('记录命名导入name', name);
            if (moduleExports.has(name)) {
              entityIds.push(this.generateEntityId(resolvedPath, name));
              console.log(`记录命名导入: ${name} <- ${moduleSpecifier}`);
            }
          });
        }
      }
    });
    
    result.IMPORTS = Array.from(new Set(entityIds)); // 去重
    console.log(`提取到 ${result.IMPORTS.length} 个有效导入`);
  }

  /**
   * 查找workspace包的真实路径
   */
  private findWorkspaceRealPath(packageName: string): string | null {
    if (!this.workspaceInfo) {
      console.log(`findWorkspaceRealPath: workspaceInfo为空，无法查找包 ${packageName}`);
      return null;
    }
    
    console.log(`查找workspace包路径: ${packageName}`);
    
    const packageNameIndex = this.workspaceInfo.packageNames.indexOf(packageName);
    if (packageNameIndex !== -1 && this.workspaceInfo.packagePaths[packageNameIndex]) {
      const foundPath = this.workspaceInfo.packagePaths[packageNameIndex];
      console.log(`直接找到workspace包路径: ${packageName} -> ${foundPath}`);
      return foundPath;
    }
    
    // 如果没有直接对应关系，通过package.json查找
    for (const workspacePath of this.workspaceInfo.packagePaths) {
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === packageName) {
            console.log(`通过package.json找到workspace包路径: ${packageName} -> ${workspacePath}`);
            return workspacePath;
          }
        } catch (error) {
          // 忽略解析错误
        }
      }
    }
    
    console.log(`未找到workspace包路径: ${packageName}`);
    return null;
  }

  /**
   * 解析重新导出的模块路径
   */
  private resolveReExportModulePath(moduleSpecifier: string, currentFilePath: string): string | null {
    try {
      // 使用现有的模块路径解析逻辑
      const resolvedPath = this.resolveModulePath(moduleSpecifier, currentFilePath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
      
      // 如果现有逻辑无法解析，尝试其他方式
      if (moduleSpecifier.startsWith('.')) {
        // 相对路径导入
        const dirPath = path.dirname(currentFilePath);
        let targetPath = path.resolve(dirPath, moduleSpecifier);
        
        // 尝试不同的扩展名
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
        
        // 首先检查是否已经有扩展名
        if (path.extname(targetPath)) {
          if (fs.existsSync(targetPath)) {
            return targetPath;
          }
        } else {
          // 尝试添加扩展名
          for (const ext of extensions) {
            const pathWithExt = targetPath + ext;
            if (fs.existsSync(pathWithExt)) {
              return pathWithExt;
            }
          }
          
          // 尝试作为目录处理，寻找index文件
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
            for (const ext of extensions) {
              const indexPath = path.join(targetPath, 'index' + ext);
              if (fs.existsSync(indexPath)) {
                return indexPath;
              }
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`解析重新导出模块路径失败: ${moduleSpecifier}`, error);
      return null;
    }
  }

  /**
   * 解析模块路径，获取绝对路径
   */
  private resolveModulePath(moduleSpecifier: string, currentFilePath: string): string {
    let resolvedPath = '';
    
    if (moduleSpecifier.startsWith('.')) {
      // 相对路径
      const dirPath = path.dirname(currentFilePath);
      resolvedPath = path.resolve(dirPath, moduleSpecifier);
    } else if (moduleSpecifier.startsWith('/')) {
      // 绝对路径（相对于项目根目录）
      resolvedPath = path.join(this.rootDir, moduleSpecifier);
    } else {
      // 第三方模块
      return '';
    }
    
    // 处理没有扩展名的情况
    if (!path.extname(resolvedPath)) {
      // 尝试不同的扩展名
      const extensions = ['.ts', '.tsx', '.vue', '.js', '.jsx'];
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext;
        if (fs.existsSync(pathWithExt)) {
          console.log(`模块路径解析: ${moduleSpecifier} -> ${pathWithExt}`);
          return pathWithExt;
        }
      }
      
      // 尝试作为目录处理，寻找index文件
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, 'index' + ext);
          if (fs.existsSync(indexPath)) {
            console.log(`模块路径解析(index): ${moduleSpecifier} -> ${indexPath}`);
            return indexPath;
          }
        }
        
        // 检查package.json的main字段
        const packageJsonPath = path.join(resolvedPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.main) {
              const mainPath = path.resolve(resolvedPath, packageJson.main);
              if (fs.existsSync(mainPath)) {
                console.log(`模块路径解析(main): ${moduleSpecifier} -> ${mainPath}`);
                return mainPath;
              }
            }
          } catch (error) {
            // 忽略package.json解析错误
          }
        }
      }
    }
    
    // 检查原始路径是否存在
    if (fs.existsSync(resolvedPath)) {
      console.log(`模块路径解析: ${moduleSpecifier} -> ${resolvedPath}`);
      return resolvedPath;
    }
    
    console.log(`模块路径解析失败: ${moduleSpecifier}`);
    return '';
  }

  /**
   * 分析模块导出的实体
   */
  private analyzeModuleExports(modulePath: string): Set<string> {
    // 检查缓存
    if (this.entityExportsCache.has(modulePath)) {
      return this.entityExportsCache.get(modulePath)!;
    }
    
    const exports = new Set<string>();
    
    try {
      if (!fs.existsSync(modulePath)) {
        return exports;
      }
      
      // 如果是目录，查找入口文件
      const stat = fs.statSync(modulePath);
      if (stat.isDirectory()) {
        let entryPath = '';
        
        // 优先检查package.json的main字段
        const packageJsonPath = path.join(modulePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.main) {
              const mainPath = path.join(modulePath, packageJson.main);
              if (fs.existsSync(mainPath)) {
                entryPath = mainPath;
              }
            }
          } catch (error) {
            // 忽略package.json解析错误
          }
        }
        
        // 如果package.json没有main字段或文件不存在，尝试常见的入口文件
        if (!entryPath) {
          // 优先查找编译后的文件，然后是源文件
          const entryFiles = ['index.js', 'index.jsx', 'index.ts', 'index.tsx'];
          
          for (const entryFile of entryFiles) {
            const possibleEntry = path.join(modulePath, entryFile);
            if (fs.existsSync(possibleEntry)) {
              entryPath = possibleEntry;
              break;
            }
          }
          
          // 如果仍未找到，尝试在src目录中查找
          if (!entryPath) {
            const srcDir = path.join(modulePath, 'src');
            if (fs.existsSync(srcDir)) {
              for (const entryFile of ['index.ts', 'index.tsx', 'index.js', 'index.jsx']) {
                const possibleEntry = path.join(srcDir, entryFile);
                if (fs.existsSync(possibleEntry)) {
                  entryPath = possibleEntry;
                  break;
                }
              }
            }
          }
        }
        
        if (!entryPath) {
          console.warn(`无法找到模块 ${modulePath} 的入口文件`);
          return exports;
        }
        
        modulePath = entryPath;
      }
      
      // Vue文件需要特殊处理
      if (modulePath.endsWith('.vue')) {
        // Vue组件通常默认导出组件本身
        exports.add('default');
        
        // 解析脚本部分看是否有其他导出
        const content = fs.readFileSync(modulePath, 'utf-8');
        const { descriptor } = parse(content);
        
        if (descriptor.script || descriptor.scriptSetup) {
          const scripts: string[] = [];
          if (descriptor.script) scripts.push(descriptor.script.content);
          if (descriptor.scriptSetup) scripts.push(descriptor.scriptSetup.content);
          
          const vueFileName = `vue_export_${path.basename(modulePath, '.vue')}_${crypto.randomBytes(4).toString('hex')}.ts`;
          const sf = this.project.createSourceFile(vueFileName, scripts.join('\n'));
          this.tempFiles.add(vueFileName);
          this.extractExports(sf, exports, modulePath);
        }
      } else {
        // 处理TS/TSX文件
        const content = fs.readFileSync(modulePath, 'utf-8');
        const fileName = `export_${path.basename(modulePath)}_${crypto.randomBytes(4).toString('hex')}.ts`;
        const sf = this.project.createSourceFile(fileName, content);
        this.tempFiles.add(fileName);
        this.extractExports(sf, exports, modulePath);
      }
    } catch (error) {
      console.error(`分析模块导出失败 ${modulePath}: ${(error as Error).message}`);
    }
    
    // 缓存结果
    this.entityExportsCache.set(modulePath, exports);
    return exports;
  }

  /**
   * 从源文件中提取导出的实体
   */
  private extractExports(sf: SourceFile, exports: Set<string>, realFilePath?: string): void {
    // 查找命名导出和重新导出（export * from）
    sf.getExportDeclarations().forEach(exportDecl => {
      // 处理命名导出：export { name1, name2 } from 'module'
      exportDecl.getNamedExports().forEach(named => {
        const aliasName = named?.getAliasNode()?.getText();
        const exportName = named.getName();
        exports.add(aliasName || exportName);
      });
      
      // 处理重新导出：export * from 'module'
      if (exportDecl.isNamespaceExport()) {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        if (moduleSpecifier) {
          console.log(`发现重新导出: export * from '${moduleSpecifier}'`);
          
          // 使用真实的文件路径而不是临时文件路径
          const currentFilePath = realFilePath || sf.getFilePath();
          console.log('currentFilePath (真实路径):', currentFilePath);
          const resolvedPath = this.resolveReExportModulePath(moduleSpecifier, currentFilePath);
          console.log('resolvedPath', resolvedPath);
          
          if (resolvedPath && fs.existsSync(resolvedPath)) {
            console.log(`解析重新导出模块路径: ${moduleSpecifier} -> ${resolvedPath}`);
            
            // 递归分析重新导出的模块
            const reExportedModuleExports = this.analyzeModuleExports(resolvedPath);
            console.log(`重新导出模块 ${moduleSpecifier} 的导出: ${Array.from(reExportedModuleExports).join(', ')}`);
            
            // 将重新导出的模块的所有导出添加到当前模块的导出中
            reExportedModuleExports.forEach(exportName => {
              // 排除 default 导出，因为 export * 不会重新导出 default
              if (exportName !== 'default') {
                exports.add(exportName);
                console.log(`添加重新导出: ${exportName}`);
              }
            });
          } else {
            console.warn(`无法解析重新导出模块路径: ${moduleSpecifier}`);
          }
        }
      }
    });
    
    // 查找导出变量声明
    sf.getVariableDeclarations().forEach(varDecl => {
      if (varDecl.isExported()) {
        const varName = varDecl.getName();
        exports.add(varName);
      }
    });
    
    // 查找导出函数声明
    sf.getFunctions().forEach(func => {
      if (func.isExported()) {
        const name = func.getName();
        if (name) {
          exports.add(name);
        } else {
          exports.add('default');
        }
      }
    });
    
    // 查找导出类声明
    sf.getClasses().forEach(cls => {
      if (cls.isExported()) {
        const name = cls.getName();
        if (name) {
          exports.add(name);
        }
      }
    });
    
    // 查找导出接口声明
    sf.getInterfaces().forEach(interfaceDecl => {
      if (interfaceDecl.isExported()) {
        const name = interfaceDecl.getName();
        if (name) {
          exports.add(name);
        }
      }
    });
    
    // 查找导出类型别名
    sf.getTypeAliases().forEach(typeAlias => {
      if (typeAlias.isExported()) {
        const name = typeAlias.getName();
        if (name) {
          exports.add(name);
        }
      }
    });
    
    // 查找导出枚举
    sf.getEnums().forEach(enumDecl => {
      if (enumDecl.isExported()) {
        const name = enumDecl.getName();
        if (name) {
          exports.add(name);
        }
      }
    });
    
    // 查找默认导出
    sf.getExportAssignments().forEach(() => {
      exports.add('default');
    });
    
    // 处理 CommonJS 格式的导出（针对编译后的JS文件）
    const sourceText = sf.getFullText();
    if (sf.getFilePath().endsWith('.js') || sourceText.includes('Object.defineProperty(exports,') || sourceText.includes('exports.')) {
      this.extractCommonJSExports(sf, exports);
    }
  }

  /**
   * 提取 CommonJS 格式的导出
   */
  private extractCommonJSExports(sf: SourceFile, exports: Set<string>): void {
    const sourceText = sf.getFullText();
    
    // 匹配 exports.xxx = ... 或 Object.defineProperty(exports, "xxx", ...)
    const exportsRegex = /(?:exports\.(\w+)\s*=|Object\.defineProperty\s*\(\s*exports\s*,\s*["'](\w+)["'])/g;
    let match;
    
    while ((match = exportsRegex.exec(sourceText)) !== null) {
      const exportName = match[1] || match[2];
      if (exportName && exportName !== '__esModule') {
        exports.add(exportName);
      }
    }
    
    // 匹配 module.exports = ... (默认导出)
    if (/module\.exports\s*=/.test(sourceText)) {
      exports.add('default');
    }
  }

  /**
   * 提取函数调用
   */
  private extractCalls(sf: SourceFile, result: StaticAnalysisResult, currentFilePath: string): void {
    const entityIds: string[] = [];
    
    // 为导入信息定义接口
    interface ImportInfo {
      moduleSpecifier: string;
      resolvedPath: string;
      isDefaultImport: boolean;
    }
    
    // 收集从workspace包和内部导入的模块和函数
    const workspaceImports = new Map<string, ImportInfo>();
    console.log(`开始收集内部导入信息...`);
    
    sf.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // 检查是否为第三方库，如果是则跳过
      if (this.isThirdPartyModule(moduleSpecifier)) {
        console.log(`跳过第三方库调用分析: ${moduleSpecifier}`);
        return;
      }

      
      let resolvedPath = '';
      let isWorkspace = false;
      let isInternal = false;
      
      // 处理相对路径导入
      if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
        resolvedPath = this.resolveModulePath(moduleSpecifier, currentFilePath);
        if (resolvedPath) {
          isWorkspace = this.isWorkspaceModule(moduleSpecifier, resolvedPath);
          isInternal = true;
        }
      }
      // 处理TypeScript别名路径（通用支持 @、~、等配置的别名）
      else {
        const aliasPath = this.resolveTypeScriptAlias(moduleSpecifier, this.rootDir);
        if (aliasPath) {
          // 尝试解析文件扩展名
          const extensions = ['.vue', '.ts', '.tsx', '.js', '.jsx'];
          for (const ext of extensions) {
            const pathWithExt = aliasPath + ext;
            if (fs.existsSync(pathWithExt)) {
              resolvedPath = pathWithExt;
              break;
            }
          }
          
          // 如果没有找到带扩展名的文件，尝试作为目录处理
          if (!resolvedPath && fs.existsSync(aliasPath) && fs.statSync(aliasPath).isDirectory()) {
            for (const ext of extensions) {
              const indexPath = path.join(aliasPath, 'index' + ext);
              if (fs.existsSync(indexPath)) {
                resolvedPath = indexPath;
                break;
              }
            }
          }
          
          if (resolvedPath) {
            isInternal = true;
            console.log(`解析TS别名: ${moduleSpecifier} -> ${resolvedPath}`);
          }
        }
        // 如果不是别名路径，检查workspace包
        else {
          const isWorkspacePackage = this.workspaceInfo?.packageNames.some(pkgName => 
            moduleSpecifier === pkgName || moduleSpecifier.startsWith(pkgName + '/')
          );
          
          if (isWorkspacePackage) {
            let workspaceRealPath = this.findWorkspaceRealPath(moduleSpecifier);
            
            // 如果是子路径导入，需要解析到具体文件
            if (moduleSpecifier.includes('/')) {
              const [packageName, ...subPath] = moduleSpecifier.split('/');
              const baseWorkspacePath = this.findWorkspaceRealPath(packageName);
              
              if (baseWorkspacePath && subPath.length > 0) {
                const resolvedSubPath = this.resolveModulePath('./' + subPath.join('/'), baseWorkspacePath + '/dummy.ts');
                if (resolvedSubPath && fs.existsSync(resolvedSubPath)) {
                  workspaceRealPath = resolvedSubPath;
                }
              }
            }
            
            if (workspaceRealPath) {
              resolvedPath = workspaceRealPath;
              isWorkspace = true;
            }
          }
        }
      }
      
      // 处理workspace模块或内部相对路径导入
      if (isWorkspace || isInternal) {
        if (resolvedPath) {
          console.log(`收集${isWorkspace ? 'workspace' : '内部'}导入: ${moduleSpecifier} -> ${resolvedPath}`);
          
          // 获取这个模块导出的所有实体
          const moduleExports = this.analyzeModuleExports(resolvedPath);
          console.log(`模块 ${moduleSpecifier} 导出: ${Array.from(moduleExports).join(', ')}`);
          
          // 获取默认导入
          const defaultImport = importDecl.getDefaultImport();
          if (defaultImport && (moduleExports.has('default') || moduleExports.size > 0)) {
            const importName = defaultImport.getText();
            workspaceImports.set(importName, { 
              moduleSpecifier, 
              resolvedPath, 
              isDefaultImport: true 
            });
            console.log(`记录默认导入: ${importName} <- ${moduleSpecifier}`);
          }
          
          // 获取命名导入
          importDecl.getNamedImports().forEach(namedImport => {
            const name = namedImport.getName();
            if (moduleExports.has(name)) {
              workspaceImports.set(name, { 
                moduleSpecifier, 
                resolvedPath, 
                isDefaultImport: false 
              });
              console.log(`记录命名导入: ${name} <- ${moduleSpecifier}`);
            }
          });
        }
      }
    });
    
    console.log(`总共收集到 ${workspaceImports.size} 个内部导入`);
    
    // 检查调用表达式
    sf.forEachDescendant(node => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        
        // 处理直接调用，如 functionName()
        if (Node.isIdentifier(expression)) {
          const functionName = expression.getText();
          
          // 检查是否是从内部或workspace包导入的函数
          if (workspaceImports.has(functionName)) {
            const importInfo = workspaceImports.get(functionName)!;
            const entityId = this.generateEntityId(importInfo.resolvedPath, functionName, importInfo.isDefaultImport);
            entityIds.push(entityId);
            console.log(`检测到直接调用: ${functionName}() -> ${entityId}`);
          }
        } 
        // 处理属性调用，如 object.method()
        else if (Node.isPropertyAccessExpression(expression)) {
          const object = expression.getExpression().getText();
          const property = expression.getName();
          
          // 检查对象是否是从内部或workspace包导入的
          if (workspaceImports.has(object)) {
            const importInfo = workspaceImports.get(object)!;
            const entityId = this.generateEntityId(importInfo.resolvedPath, object, importInfo.isDefaultImport);
            entityIds.push(`${entityId}.${property}`);
            console.log(`检测到属性调用: ${object}.${property}() -> ${entityId}.${property}`);
          }
        }
        // 处理元素访问调用，如 object['method']()
        else if (Node.isElementAccessExpression(expression)) {
          const object = expression.getExpression().getText();
          const argumentExpression = expression.getArgumentExpression();
          
          if (argumentExpression && Node.isStringLiteral(argumentExpression) && workspaceImports.has(object)) {
            const property = argumentExpression.getLiteralText();
            const importInfo = workspaceImports.get(object)!;
            const entityId = this.generateEntityId(importInfo.resolvedPath, object, importInfo.isDefaultImport);
            entityIds.push(`${entityId}.${property}`);
            console.log(`检测到元素访问调用: ${object}['${property}']() -> ${entityId}.${property}`);
          }
        }
      }
    });
    
    result.CALLS = Array.from(new Set(entityIds)); // 去重
    
    console.log(`提取到 ${result.CALLS.length} 个内部调用`);
  }

  /**
   * 提取Vue中的emit调用
   */
  private extractEmits(sf: SourceFile, result: StaticAnalysisResult): void {
    const emits: string[] = [];
    
    sf.forEachDescendant(node => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression().getText();
        
        // 检查是否为emit调用
        if (expression === 'emit' || expression.endsWith('.emit')) {
          const args = node.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const eventName = args[0].getText().replace(/['"]/g, '');
            emits.push(eventName);
          }
        }
      }
    });
    
    result.EMITS = emits;
  }

  /**
   * 提取JSX/TSX中的emit调用(props.onXxx())
   */
  private extractJsxEmits(sf: SourceFile, result: StaticAnalysisResult): void {
    const emits: string[] = [];
    
    sf.forEachDescendant(node => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression().getText();
        
        // 检查是否为props.onXxx()形式的调用
        if (expression.startsWith('props.on') || 
            expression.match(/props\['on[A-Z]/)) {
          const eventName = expression
            .replace(/props\.on/, '')
            .replace(/props\['on/, '')
            .replace(/']/, '')
            .replace(/^./, c => c.toLowerCase());
          
          emits.push(eventName);
        }
      }
    });
    
    result.EMITS = emits;
  }

  /**
   * 提取模板中的组件引用
   */
  private extractTemplateComponents(template: string, result: StaticAnalysisResult): void {
    // 简单的正则匹配，实际项目中可能需要使用@vue/compiler-dom进行更准确的解析
    const componentTags = new Set<string>();
    
    // 匹配形如<ComponentName 或 <component-name 的模式
    const componentRegex = /<([A-Z][a-zA-Z0-9]*|[a-z]+-[a-z-]+)(?:\s|>|\/>)/g;
    let match;
    
    while ((match = componentRegex.exec(template)) !== null) {
      const componentName = match[1];
      if (componentName && !['template', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'button', 'input', 'form'].includes(componentName)) {
        componentTags.add(componentName);
      }
    }
    
    result.TEMPLATE_COMPONENTS = Array.from(componentTags);
  }

  /**
   * 初始化TypeScript路径别名配置
   */
  private initPathAliases(): void {
    this.pathAliases = this.loadPathAliases();
  }

  /**
   * 加载TypeScript路径别名配置
   */
  private loadPathAliases(): Map<string, string> {
    const aliases = new Map<string, string>();
    
    try {
      // 1. 从 tsconfig.json 加载路径别名
      this.loadTsConfigAliases(aliases);
      
      // 2. 从 vue.config.js 加载路径别名
      this.loadVueConfigAliases(aliases);
      
      // 3. 从 vite.config.js/ts 加载路径别名
      this.loadViteConfigAliases(aliases);
      
      // 4. 从 webpack.config.js 加载路径别名
      this.loadWebpackConfigAliases(aliases);
      
      console.log(`总共加载了 ${aliases.size} 个路径别名配置`);
    } catch (error) {
      console.warn(`加载路径别名配置失败: ${(error as Error).message}`);
    }
    
    return aliases;
  }

  /**
   * 从 tsconfig.json 加载路径别名
   */
  private loadTsConfigAliases(aliases: Map<string, string>): void {
    try {
      const tsconfigPath = this.findTsConfig(this.rootDir);
      if (!tsconfigPath) {
        console.log('未找到 tsconfig.json');
        return;
      }
      
      const config = this.parseTsConfig(tsconfigPath);
      const paths = config.compilerOptions?.paths;
      const baseUrl = config.compilerOptions?.baseUrl || '.';
      
      if (paths) {
        Object.entries(paths).forEach(([alias, targets]) => {
          if (Array.isArray(targets) && targets.length > 0) {
            // 移除通配符 * 并获取基础别名
            const cleanAlias = alias.replace(/\/?\*$/, '');
            const cleanTarget = targets[0].replace(/\/?\*$/, '');
            
            // 构建绝对路径
            const absoluteTarget = path.resolve(this.rootDir, baseUrl, cleanTarget);
            aliases.set(cleanAlias, absoluteTarget);
            
            console.log(`从tsconfig.json加载路径别名: ${cleanAlias} -> ${absoluteTarget}`);
          }
        });
      }
    } catch (error) {
      console.warn(`从tsconfig.json加载路径别名失败: ${(error as Error).message}`);
    }
  }

  /**
   * 从 vue.config.js 加载路径别名
   */
  private loadVueConfigAliases(aliases: Map<string, string>): void {
    try {
      const vueConfigPath = path.join(this.rootDir, 'vue.config.js');
      if (!fs.existsSync(vueConfigPath)) {
        return;
      }
      
      const vueConfigContent = fs.readFileSync(vueConfigPath, 'utf-8');
      
      // 解析 configureWebpack.resolve.alias 配置
      const aliasMatch = vueConfigContent.match(/alias\s*:\s*\{([^}]+)\}/);
      if (aliasMatch) {
        const aliasContent = aliasMatch[1];
        
        // 解析每个别名配置
        const aliasRegex = /['"]([^'"]+)['"]\s*:\s*require\(['"`]path['"`]\)\.resolve\(__dirname,\s*['"]([^'"]+)['"]\)/g;
        let match;
        
        while ((match = aliasRegex.exec(aliasContent)) !== null) {
          const aliasKey = match[1];
          const aliasValue = match[2];
          const absolutePath = path.resolve(this.rootDir, aliasValue);
          
          aliases.set(aliasKey, absolutePath);
          console.log(`从vue.config.js加载路径别名: ${aliasKey} -> ${absolutePath}`);
        }
        
        // 处理简单的字符串路径格式
        const simpleAliasRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
        while ((match = simpleAliasRegex.exec(aliasContent)) !== null) {
          const aliasKey = match[1];
          const aliasValue = match[2];
          
          // 跳过已经处理过的require格式
          if (aliasContent.substring(match.index).includes('require(')) {
            continue;
          }
          
          const absolutePath = path.resolve(this.rootDir, aliasValue);
          aliases.set(aliasKey, absolutePath);
          console.log(`从vue.config.js加载路径别名(简单格式): ${aliasKey} -> ${absolutePath}`);
        }
      }
    } catch (error) {
      console.warn(`从vue.config.js加载路径别名失败: ${(error as Error).message}`);
    }
  }

  /**
   * 从 vite.config.js/ts 加载路径别名
   */
  private loadViteConfigAliases(aliases: Map<string, string>): void {
    try {
      const viteConfigPaths = [
        path.join(this.rootDir, 'vite.config.js'),
        path.join(this.rootDir, 'vite.config.ts'),
        path.join(this.rootDir, 'vitest.config.js'),
        path.join(this.rootDir, 'vitest.config.ts')
      ];
      
      for (const configPath of viteConfigPaths) {
        if (!fs.existsSync(configPath)) {
          continue;
        }
        
        const configContent = fs.readFileSync(configPath, 'utf-8');
        
        // 解析 resolve.alias 配置
        const aliasMatch = configContent.match(/resolve\s*:\s*\{[^}]*alias\s*:\s*\{([^}]+)\}/);
        if (aliasMatch) {
          const aliasContent = aliasMatch[1];
          
          // 解析别名配置
          const aliasRegex = /['"]([^'"]+)['"]\s*:\s*(?:path\.resolve\(__dirname,\s*)?['"]([^'"]+)['"]\)?/g;
          let match;
          
          while ((match = aliasRegex.exec(aliasContent)) !== null) {
            const aliasKey = match[1];
            const aliasValue = match[2];
            const absolutePath = path.resolve(this.rootDir, aliasValue);
            
            aliases.set(aliasKey, absolutePath);
            console.log(`从${path.basename(configPath)}加载路径别名: ${aliasKey} -> ${absolutePath}`);
          }
        }
        
        break; // 找到第一个配置文件就停止
      }
    } catch (error) {
      console.warn(`从vite配置文件加载路径别名失败: ${(error as Error).message}`);
    }
  }

  /**
   * 从 webpack.config.js 加载路径别名
   */
  private loadWebpackConfigAliases(aliases: Map<string, string>): void {
    try {
      const webpackConfigPath = path.join(this.rootDir, 'webpack.config.js');
      if (!fs.existsSync(webpackConfigPath)) {
        return;
      }
      
      const webpackConfigContent = fs.readFileSync(webpackConfigPath, 'utf-8');
      
      // 解析 resolve.alias 配置
      const aliasMatch = webpackConfigContent.match(/resolve\s*:\s*\{[^}]*alias\s*:\s*\{([^}]+)\}/);
      if (aliasMatch) {
        const aliasContent = aliasMatch[1];
        
        // 解析别名配置
        const aliasRegex = /['"]([^'"]+)['"]\s*:\s*(?:path\.resolve\(__dirname,\s*)?['"]([^'"]+)['"]\)?/g;
        let match;
        
        while ((match = aliasRegex.exec(aliasContent)) !== null) {
          const aliasKey = match[1];
          const aliasValue = match[2];
          const absolutePath = path.resolve(this.rootDir, aliasValue);
          
          aliases.set(aliasKey, absolutePath);
          console.log(`从webpack.config.js加载路径别名: ${aliasKey} -> ${absolutePath}`);
        }
      }
    } catch (error) {
      console.warn(`从webpack.config.js加载路径别名失败: ${(error as Error).message}`);
    }
  }

  /**
   * 查找 tsconfig.json 文件
   */
  private findTsConfig(dir: string): string | null {
    const tsconfigPath = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return tsconfigPath;
    }
    
    // 查找父目录
    const parentDir = path.dirname(dir);
    if (parentDir !== dir) {
      return this.findTsConfig(parentDir);
    }
    
    return null;
  }

  /**
   * 解析 tsconfig.json 文件（支持 extends）
   */
  private parseTsConfig(configPath: string): any {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(jsonrepair(configContent));
      
      // 处理 extends
      if (config.extends) {
        const baseConfigPath = path.resolve(path.dirname(configPath), config.extends);
        const baseConfig = this.parseTsConfig(baseConfigPath);
        
        // 合并配置
        return {
          ...baseConfig,
          ...config,
          compilerOptions: {
            ...baseConfig.compilerOptions,
            ...config.compilerOptions,
            paths: {
              ...baseConfig.compilerOptions?.paths,
              ...config.compilerOptions?.paths
            }
          }
        };
      }
      
      return config;
    } catch (error) {
      console.warn(`解析 tsconfig.json 失败: ${(error as Error).message}`);
      return {};
    }
  }
} 