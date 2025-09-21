import path from 'path';
import fs from 'fs';

export interface WorkspacePackageInfo {
  name: string;
  path: string;
  relativePath: string;
}

export interface WorkspaceMappingOptions {
  includeDevDependencies?: boolean;
  includePeerDependencies?: boolean;
  maxDepth?: number;
}

/**
 * workspace依赖关系映射
 */
export interface WorkspaceDependencyMap {
  // packageName -> 依赖它的其他包的packageName列表
  dependents: Map<string, Set<string>>;
  // packageName -> packagePath 映射
  packagePaths: Map<string, string>;
}

/**
 * 依赖关系分析结果
 */
export interface DependencyAnalysisResult {
  dependencyMap: WorkspaceDependencyMap;
}

/**
 * 获取当前工程依赖的所有workspace包路径映射
 */
export function getWorkspacePackageMappings(
  projectRoot: string, 
  options: WorkspaceMappingOptions = {}
): WorkspacePackageInfo[] {
  const {
    includeDevDependencies = true,
    includePeerDependencies = false,
    maxDepth = 3
  } = options;

  // 确保projectRoot是绝对路径
  const absoluteProjectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(process.cwd(), projectRoot);
  console.log(`🔍 开始分析workspace包映射 (项目: ${projectRoot} -> ${absoluteProjectRoot})`);
  
  try {
    // 1. 读取项目的package.json
    const packageJsonPath = path.join(absoluteProjectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`❌ 项目package.json不存在: ${packageJsonPath}`);
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    console.log(`📦 分析项目: ${packageJson.name || 'unknown'}`);

    // 2. 收集所有workspace依赖
    const workspaceDeps = new Set<string>();
    
    // 收集dependencies
    if (packageJson.dependencies) {
      Object.entries(packageJson.dependencies).forEach(([name, version]) => {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          workspaceDeps.add(name);
          console.log(`📌 发现workspace依赖: ${name} (${version})`);
        }
      });
    }

    // 收集devDependencies
    if (includeDevDependencies && packageJson.devDependencies) {
      Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          workspaceDeps.add(name);
          console.log(`🔧 发现workspace开发依赖: ${name} (${version})`);
        }
      });
    }

    // 收集peerDependencies
    if (includePeerDependencies && packageJson.peerDependencies) {
      Object.entries(packageJson.peerDependencies).forEach(([name, version]) => {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          workspaceDeps.add(name);
          console.log(`🤝 发现workspace peer依赖: ${name} (${version})`);
        }
      });
    }

    // 检查dependenciesMeta中的injected包
    if (packageJson.dependenciesMeta) {
      Object.entries(packageJson.dependenciesMeta).forEach(([name, meta]: [string, any]) => {
        if (meta && meta.injected) {
          workspaceDeps.add(name);
          console.log(`💉 发现injected依赖: ${name}`);
        }
      });
    }

    if (workspaceDeps.size === 0) {
      console.log('📭 未发现任何workspace依赖');
      return [];
    }

    console.log(`🎯 共发现 ${workspaceDeps.size} 个workspace依赖`);

    // 3. 查找workspace根目录
    const workspaceRoot = findWorkspaceRoot(absoluteProjectRoot);
    if (!workspaceRoot) {
      console.warn('❌ 未找到workspace根目录');
      return [];
    }

    console.log(`🏠 workspace根目录: ${workspaceRoot}`);

    // 4. 构建包映射
    const packageMappings: WorkspacePackageInfo[] = [];
    const workspacePackageMap = buildWorkspacePackageMap(workspaceRoot, maxDepth);

    for (const packageName of workspaceDeps) {
      const packagePath = workspacePackageMap.get(packageName);
      if (packagePath) {
        const relativePath = path.relative(absoluteProjectRoot, packagePath);
        packageMappings.push({
          name: packageName,
          path: packagePath,
          relativePath
        });
        console.log(`✅ 映射成功: ${packageName} -> ${relativePath}`);
      } else {
        console.warn(`⚠️  未找到包路径: ${packageName}`);
      }
    }

    console.log(`🎉 workspace包映射完成，共映射 ${packageMappings.length}/${workspaceDeps.size} 个包`);
    return packageMappings;

  } catch (error) {
    console.error(`❌ workspace包映射失败:`, error);
    return [];
  }
}

/**
 * 获取workspace包中变更的文件列表
 */
export function getWorkspaceChangedFiles(
  projectRoot: string, 
  gitChangedFiles: string[],
  options: WorkspaceMappingOptions = {}
): string[] {
  console.log(`🔄 分析workspace包中的变更文件...`);
  
  // 确保projectRoot是绝对路径
  const absoluteProjectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(process.cwd(), projectRoot);
  console.log(`📋 输入参数:`);
  console.log(`  - projectRoot: ${projectRoot} -> ${absoluteProjectRoot}`);
  console.log(`  - gitChangedFiles数量: ${gitChangedFiles.length}`);
  console.log(`  - gitChangedFiles前5个: ${gitChangedFiles.slice(0, 5).join(', ')}`);
  
  const workspacePackages = getWorkspacePackageMappings(absoluteProjectRoot, options);
  if (workspacePackages.length === 0) {
    console.log('📭 无workspace包，返回空列表');
    return [];
  }

  console.log(`📦 找到 ${workspacePackages.length} 个workspace包:`);
  workspacePackages.forEach(pkg => {
    console.log(`  - ${pkg.name}: ${pkg.path}`);
  });

  const workspaceChangedFiles: string[] = [];

  for (const pkg of workspacePackages) {
    console.log(`🔍 检查workspace包: ${pkg.name} (${pkg.path})`);
    
    // 查找该workspace包中的变更文件
    const packageChangedFiles = gitChangedFiles.filter(file => {
      const absoluteFile = path.isAbsolute(file) ? file : path.resolve(absoluteProjectRoot, file);
      const isInPackage = absoluteFile.startsWith(pkg.path + path.sep) || absoluteFile === pkg.path;
      
      if (isInPackage) {
        console.log(`  ✅ 匹配文件: ${file} -> ${absoluteFile}`);
      }
      
      return isInPackage;
    });

    console.log(`  📊 ${pkg.name} 中的变更文件数量: ${packageChangedFiles.length}`);
    
    if (packageChangedFiles.length > 0) {
      console.log(`📝 在 ${pkg.name} 中发现 ${packageChangedFiles.length} 个变更文件:`);
      packageChangedFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
      workspaceChangedFiles.push(...packageChangedFiles);
    } else {
      console.log(`  📭 ${pkg.name} 中无变更文件`);
    }
  }

  console.log(`🎯 workspace包变更文件总数: ${workspaceChangedFiles.length}`);
  if (workspaceChangedFiles.length > 0) {
    console.log(`📋 workspace变更文件列表:`);
    workspaceChangedFiles.forEach(file => console.log(`  - ${file}`));
  }
  
  return workspaceChangedFiles;
}

/**
 * 向上查找workspace配置文件
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = startDir;
  
  while (currentDir !== path.dirname(currentDir)) {
    // 检查pnpm-workspace.yaml
    const pnpmWorkspacePath = path.join(currentDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspacePath)) {
      return currentDir;
    }
    
    // 检查package.json的workspaces字段
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.workspaces) {
          return currentDir;
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * 构建workspace包映射
 */
export function buildWorkspacePackageMap(workspaceRoot: string, maxDepth: number = 3): Map<string, string> {
  const packageMap = new Map<string, string>();
  
  try {
    console.log(`🔨 构建workspace包映射 (根目录: ${workspaceRoot}, 最大深度: ${maxDepth})`);
    
    // 获取workspace patterns
    const workspacePatterns = getWorkspacePatterns(workspaceRoot);
    console.log(`📋 workspace模式: ${JSON.stringify(workspacePatterns)}`);
    
    let totalFound = 0;
    
    for (const pattern of workspacePatterns) {
      console.log(`🔍 处理模式: ${pattern}`);
      const possiblePaths = resolveWorkspacePattern(workspaceRoot, pattern, maxDepth);
      console.log(`  解析出 ${possiblePaths.length} 个路径`);
      
      for (const possiblePath of possiblePaths) {
        if (isValidWorkspacePackage(possiblePath)) {
          const packageJsonPath = path.join(possiblePath, 'package.json');
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name) {
              packageMap.set(packageJson.name, possiblePath);
              console.log(`  📦 ${packageJson.name} -> ${path.relative(workspaceRoot, possiblePath)}`);
              totalFound++;
            }
          } catch (error) {
            console.warn(`  ⚠️  解析 ${packageJsonPath} 失败: ${error}`);
          }
        }
      }
    }
    
    console.log(`✅ 包映射构建完成，找到 ${totalFound} 个workspace包`);
    
  } catch (error) {
    console.warn(`❌ 构建包映射失败: ${error}`);
  }
  
  return packageMap;
}

/**
 * 获取workspace patterns
 */
function getWorkspacePatterns(rootDir: string): string[] {
  const patterns: string[] = [];
  
  // 检查pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    try {
      const yamlContent = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
      const lines = yamlContent.split('\n');
      let inPackagesSection = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine === 'packages:') {
          inPackagesSection = true;
          continue;
        }
        
        if (inPackagesSection) {
          if (trimmedLine && !trimmedLine.startsWith('-') && !trimmedLine.startsWith(' ') && trimmedLine.includes(':')) {
            inPackagesSection = false;
            continue;
          }
          
          if (trimmedLine.startsWith('-')) {
            const pattern = trimmedLine.replace(/^\s*-\s*['"]?|['"]?\s*$/g, '');
            if (pattern) {
              patterns.push(pattern);
            }
          }
        }
      }
    } catch (error) {
      console.warn('解析pnpm-workspace.yaml失败:', error);
    }
  }
  
  // 检查package.json的workspaces字段
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          patterns.push(...packageJson.workspaces);
        } else if (packageJson.workspaces.packages) {
          patterns.push(...packageJson.workspaces.packages);
        }
      }
    } catch (error) {
      console.warn('解析package.json workspaces失败:', error);
    }
  }
  
  // 默认模式
  if (patterns.length === 0) {
    patterns.push('packages/*', 'packages/*/*', 'apps/*', 'libs/*');
  }
  
  return patterns;
}

/**
 * 解析workspace pattern
 */
function resolveWorkspacePattern(rootDir: string, pattern: string, maxDepth: number = 3): string[] {
  const results: string[] = [];
  
  try {
    console.log(`开始解析workspace模式: ${pattern}, 基于根目录: ${rootDir}`);
    
    if (pattern.includes('*')) {
      // 处理各种glob模式
      const candidatePaths = expandGlobPattern(pattern, rootDir);
      // 过滤出真正的workspace包
      results.push(...filterValidWorkspacePackages(candidatePaths));
    } else {
      // 直接路径，基于根目录解析
      const fullPath = path.resolve(rootDir, pattern);
      if (isValidWorkspacePackage(fullPath)) {
        results.push(fullPath);
        console.log(`直接路径解析成功: ${pattern} -> ${fullPath}`);
      }
    }
  } catch (error) {
    console.warn(`解析workspace模式 ${pattern} 失败:`, error);
  }
  
  console.log(`模式 ${pattern} 解析结果数量: ${results.length}`);
  if (results.length > 0) {
    console.log(`有效workspace包: ${results.slice(0, 3).join(', ')}${results.length > 3 ? '...' : ''}`);
  }
  return results;
}

/**
 * 展开glob模式（支持 *, **, /** 等复杂模式）
 */
function expandGlobPattern(pattern: string, basePath: string): string[] {
  const results: string[] = [];
  
  // 预处理模式：标准化路径分隔符
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // 检查是否包含递归通配符 **
  if (normalizedPattern.includes('**')) {
    results.push(...expandRecursivePattern(normalizedPattern, basePath));
  } else {
    // 处理简单的单层通配符
    results.push(...expandSimplePattern(normalizedPattern, basePath));
  }
  
  return results;
}

/**
 * 展开递归模式（包含 ** 的模式）
 */
function expandRecursivePattern(pattern: string, basePath: string): string[] {
  const results: string[] = [];
  
  // 处理形如 packages/**, packages/**/* 等模式
  if (pattern === '**' || pattern === '**/*') {
    // 递归查找所有目录
    results.push(...findAllDirectories(basePath, true));
  } else if (pattern.startsWith('**/')) {
    // 形如 **/subpath 的模式
    const subPattern = pattern.substring(3);
    const allDirs = findAllDirectories(basePath, true);
    for (const dir of allDirs) {
      const subResults = expandGlobPattern(subPattern, dir);
      results.push(...subResults);
    }
  } else if (pattern.endsWith('/**')) {
    // 形如 packages/** 的模式
    const prefix = pattern.substring(0, pattern.length - 3);
    const prefixPath = path.join(basePath, prefix);
    if (fs.existsSync(prefixPath)) {
      results.push(...findAllDirectories(prefixPath, true));
    }
  } else if (pattern.endsWith('/**/*')) {
    // 形如 packages/**/* 的模式
    const prefix = pattern.substring(0, pattern.length - 5);
    const prefixPath = path.join(basePath, prefix);
    if (fs.existsSync(prefixPath)) {
      results.push(...findAllDirectories(prefixPath, true));
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
          allDirs.push(...findAllDirectories(searchPath, true));
        }
      }
      
      // 处理后缀
      if (suffix && suffix !== '/' && suffix !== '/*') {
        const cleanSuffix = suffix.replace(/^\//, '');
        for (const dir of allDirs) {
          const subResults = expandGlobPattern(cleanSuffix, dir);
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
function expandSimplePattern(pattern: string, basePath: string): string[] {
  const results: string[] = [];
  const parts = pattern.split('/');
  let currentPaths = [basePath];
  
  for (const part of parts) {
    if (part === '*') {
      const newPaths: string[] = [];
      for (const currentPath of currentPaths) {
        if (fs.existsSync(currentPath)) {
          try {
            const entries = fs.readdirSync(currentPath);
            for (const entry of entries) {
              // 跳过不应该包含workspace包的目录
              if (shouldSkipDirectory(entry)) {
                continue;
              }
              
              const entryPath = path.join(currentPath, entry);
              if (fs.statSync(entryPath).isDirectory()) {
                newPaths.push(entryPath);
              }
            }
          } catch (error) {
            console.warn(`读取目录失败: ${currentPath}`);
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
function findAllDirectories(rootPath: string, includeRoot: boolean = false): string[] {
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
      if (shouldSkipDirectory(entry)) {
        continue;
      }
      
      const entryPath = path.join(rootPath, entry);
      const stat = fs.statSync(entryPath);
      
      if (stat.isDirectory()) {
        results.push(entryPath);
        // 递归查找子目录（但不要递归太深，避免性能问题）
        const depth = entryPath.split(path.sep).length - rootPath.split(path.sep).length;
        if (depth < 3) { // 限制递归深度
          results.push(...findAllDirectories(entryPath, false));
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
export function shouldSkipDirectory(dirName: string): boolean {
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
function filterValidWorkspacePackages(candidatePaths: string[]): string[] {
  const validPackages: string[] = [];
  
  for (const candidatePath of candidatePaths) {
    if (isValidWorkspacePackage(candidatePath)) {
      validPackages.push(candidatePath);
    }
  }
  
  return validPackages;
}

/**
 * 检查目录是否为有效的workspace包
 */
export function isValidWorkspacePackage(dirPath: string): boolean {
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
    if (shouldSkipDirectory(dirName)) {
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
      const hasSourceFiles = hasSourceFilesInDirectory(dirPath);
      if (!hasSourceFiles) {
        console.log(`跳过无源码包: ${packageJson.name} at ${dirPath}`);
        return false;
      }
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
function hasSourceFilesInDirectory(dirPath: string): boolean {
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
 * 构建workspace依赖关系图（基于dependenciesMeta.injected）
 */
export function buildWorkspaceDependencyMap(workspaceRoot: string, maxDepth: number = 3): DependencyAnalysisResult {
  console.log(`🔨 [依赖分析] 开始构建workspace依赖关系图 (根目录: ${workspaceRoot})`);
  
  const dependents = new Map<string, Set<string>>();
  const packagePaths = new Map<string, string>();
  
  try {
    // 1. 获取所有workspace包
    const allPackages = buildWorkspacePackageMap(workspaceRoot, maxDepth);
    console.log(`📦 [依赖分析] 发现 ${allPackages.size} 个workspace包`);
    
    // 2. 初始化packagePaths映射
    for (const [packageName, packagePath] of allPackages) {
      packagePaths.set(packageName, packagePath);
      // 初始化dependents为空集合
      if (!dependents.has(packageName)) {
        dependents.set(packageName, new Set());
      }
    }
    
    // 3. 解析每个包的dependenciesMeta.injected依赖
    for (const [packageName, packagePath] of allPackages) {
      try {
        const packageJsonPath = path.join(packagePath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          continue;
        }
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        // 检查dependenciesMeta中的injected依赖
        if (packageJson.dependenciesMeta) {
          Object.entries(packageJson.dependenciesMeta).forEach(([depName, meta]: [string, any]) => {
            if (meta && meta.injected) {
              // packageName 依赖了 depName
              // 所以 depName 的 dependents 中要包含 packageName
              if (!dependents.has(depName)) {
                dependents.set(depName, new Set());
              }
              dependents.get(depName)!.add(packageName);
              console.log(`🔗 [依赖分析] ${packageName} injected依赖 ${depName}`);
            }
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ [依赖分析] 解析 ${packageName} 的依赖失败:`, error);
      }
    }
    
    console.log(`✅ [依赖分析] 依赖关系图构建完成`);
    console.log(`📊 [依赖分析] 依赖关系统计:`);
    for (const [packageName, deps] of dependents) {
      if (deps.size > 0) {
        console.log(`   ${packageName} 被以下包依赖: ${Array.from(deps).join(', ')}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ [依赖分析] 构建依赖关系图失败:`, error);
  }
  
  return {
    dependencyMap: {
      dependents,
      packagePaths
    }
  };
}