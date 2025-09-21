import path from "path";
import fs from "fs";
import { promisify } from "util";
import { VueExtractor } from "./extractors/VueExtractor";
import { TSXExtractor } from "./extractors/TSXExtractor";
import { FunctionExtractor } from "./extractors/FunctionExtractor";
import { clearFileTSCache } from "./extractors/TSProjectManager";
import crypto from "crypto";

// 异步化常用的fs方法
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

// 性能配置
const PERFORMANCE_CONFIG = {
  MAX_PARALLEL_FILES: 8, // 最大并行文件处理数
  MAX_PARALLEL_DIRS: 4, // 最大并行目录扫描数
  BATCH_SIZE: 50, // 批处理大小
  ENABLE_FILE_CACHE: true, // 启用文件内容缓存
  CACHE_SIZE_LIMIT: 100 * 1024 * 1024, // 缓存大小限制100MB
};

// 全局缓存
const FILE_CONTENT_CACHE = new Map<
  string,
  { content: string; mtime: number }
>();
const PATH_RESOLVE_CACHE = new Map<string, string>();
const WORKSPACE_INFO_CACHE = new Map<
  string,
  { packageNames: string[]; packagePaths: string[] }
>();
const WORKSPACE_PACKAGE_CACHE = new Map<string, Map<string, string>>();

/**
 * 清除特定文件的缓存
 * @param filePath 需要清除缓存的文件路径
 */
export function clearFileCache(filePath: string): void {
  if (FILE_CONTENT_CACHE.has(filePath)) {
    console.log(`清除文件缓存: ${filePath}`);
    FILE_CONTENT_CACHE.delete(filePath);
  }

  // 同时清理ts-morph相关的缓存
  clearFileTSCache(filePath);
  console.log(`已清理文件的所有缓存: ${filePath}`);
}

/**
 * 清理缓存以释放内存
 */
function clearCache(): void {
  FILE_CONTENT_CACHE.clear();
  PATH_RESOLVE_CACHE.clear();
  console.log("缓存已清理");
}

/**
 * 获取文件内容（带缓存）
 */
async function getCachedFileContent(filePath: string): Promise<string> {
  if (!PERFORMANCE_CONFIG.ENABLE_FILE_CACHE) {
    return await readFile(filePath, "utf-8");
  }

  try {
    const fileStat = await stat(filePath);
    const mtime = fileStat.mtime.getTime();

    const cached = FILE_CONTENT_CACHE.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.content;
    }

    const content = await readFile(filePath, "utf-8");

    // 检查缓存大小限制
    const currentCacheSize = Array.from(FILE_CONTENT_CACHE.values()).reduce(
      (sum, item) => sum + item.content.length,
      0
    );

    if (currentCacheSize < PERFORMANCE_CONFIG.CACHE_SIZE_LIMIT) {
      FILE_CONTENT_CACHE.set(filePath, { content, mtime });
    }

    return content;
  } catch (error) {
    throw new Error(`读取文件失败 ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * 向上查找workspace配置文件
 */
function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    // 直到根目录
    // 检查pnpm-workspace.yaml
    const pnpmWorkspacePath = path.join(currentDir, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpmWorkspacePath)) {
      return currentDir;
    }

    // 检查package.json的workspaces字段
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
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
 * 获取项目实际依赖的workspace包信息
 */
function getWorkspaceInfo(rootDir: string): {
  packageNames: string[];
  packagePaths: string[];
} {
  const packageNames: string[] = [];
  const packagePaths: string[] = [];
  const startTime = Date.now();
  const TOTAL_TIMEOUT_MS = 60000; // 总体60秒超时

  try {
    // 读取当前目录的package.json
    const packageJsonPath = path.join(rootDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      // 收集所有workspace:*依赖的包名
      const collectWorkspaceDeps = (deps: Record<string, string> = {}) => {
        Object.entries(deps).forEach(([name, version]) => {
          if (version.startsWith("workspace:")) {
            packageNames.push(name);
          }
        });
      };

      collectWorkspaceDeps(packageJson.dependencies);
      collectWorkspaceDeps(packageJson.devDependencies);
      collectWorkspaceDeps(packageJson.peerDependencies);

      // 检查dependenciesMeta配置中的injected包
      if (packageJson.dependenciesMeta) {
        Object.entries(packageJson.dependenciesMeta).forEach(
          ([name, meta]: [string, any]) => {
            if (meta && meta.injected) {
              console.log(`发现dependenciesMeta.injected配置: ${name}`);
              // 确保不重复添加
              if (!packageNames.includes(name)) {
                packageNames.push(name);
              }
            }
          }
        );
      }
    }

    // 查找workspace根目录
    const workspaceRoot = findWorkspaceRoot(rootDir);
    if (!workspaceRoot) {
      console.log("未找到workspace配置，使用当前目录作为根目录");
      return { packageNames, packagePaths };
    }

    console.log(`找到workspace根目录: ${workspaceRoot}`);

    // 优先通过工作区配置查找真实路径
    if (packageNames.length > 0) {
      const workspacePatterns = getWorkspacePatterns(workspaceRoot);
      console.log(
        `找到 ${packageNames.length} 个workspace包和 ${workspacePatterns.length} 个workspace模式`
      );
      console.log(`workspace模式: ${JSON.stringify(workspacePatterns)}`);
      console.log(`需要查找的包: ${JSON.stringify(packageNames)}`);

      for (const packageName of packageNames) {
        // 检查总体超时
        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
          console.warn(`getWorkspaceInfo 总体超时，停止处理剩余包`);
          break;
        }

        console.log(`正在查找workspace包: ${packageName}`);
        let found = false;

        // 策略1: 通过工作区配置查找
        console.log(`  策略1: 通过工作区配置查找`);
        for (const pattern of workspacePatterns) {
          // 检查超时
          if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
            console.warn(`处理workspace模式时超时，停止处理`);
            break;
          }

          console.log(`  尝试解析模式: ${pattern}`);
          const possiblePaths = resolveWorkspacePattern(workspaceRoot, pattern);
          console.log(
            `  模式 ${pattern} 解析出 ${possiblePaths.length} 个路径`
          );

          for (const possiblePath of possiblePaths) {
            const possiblePackageJsonPath = path.join(
              possiblePath,
              "package.json"
            );
            if (fs.existsSync(possiblePackageJsonPath)) {
              try {
                const possiblePackageJson = JSON.parse(
                  fs.readFileSync(possiblePackageJsonPath, "utf-8")
                );
                if (possiblePackageJson.name === packageName) {
                  packagePaths.push(possiblePath);
                  console.log(
                    `通过工作区配置找到: ${packageName} -> ${possiblePath}`
                  );
                  found = true;
                  break;
                }
              } catch (error) {
                console.warn(
                  `解析package.json失败: ${possiblePackageJsonPath}`,
                  error
                );
              }
            }
          }
          if (found) break;
        }

        // 策略2: 通过智能包名模式直接查找
        if (!found) {
          console.log(`  策略2: 通过智能包名模式直接查找`);
          const searchResult = searchPackageByIntelligentPatterns(
            workspaceRoot,
            packageName
          );
          if (searchResult) {
            packagePaths.push(searchResult);
            console.log(`通过智能模式找到: ${packageName} -> ${searchResult}`);
            found = true;
          }
        }

        // 策略3: 通过node_modules符号链接解析
        if (!found) {
          console.log(`  策略3: 通过node_modules符号链接查找`);
          const nodeModulesPath = path.join(workspaceRoot, "node_modules");
          if (fs.existsSync(nodeModulesPath)) {
            let packagePath: string;

            // 处理作用域包和普通包
            if (packageName.startsWith("@")) {
              packagePath = path.join(nodeModulesPath, packageName);
            } else {
              packagePath = path.join(nodeModulesPath, packageName);
            }

            try {
              if (fs.existsSync(packagePath)) {
                const stat = fs.lstatSync(packagePath);
                // 如果是符号链接，解析到真实路径
                if (stat.isSymbolicLink()) {
                  const realPath = fs.realpathSync(packagePath);
                  console.log(`  符号链接解析: ${packagePath} -> ${realPath}`);

                  // 只有当真实路径不包含node_modules时才添加（说明是workspace包）
                  if (!realPath.includes("node_modules")) {
                    packagePaths.push(realPath);
                    console.log(
                      `通过符号链接找到: ${packageName} -> ${realPath}`
                    );
                    found = true;
                  } else {
                    // 处理pnpm的特殊情况
                    const pnpmMatch = realPath.match(
                      /node_modules\/\.pnpm\/file\+packages\+([^/]+)(?:\+([^/]+))*\/node_modules\/(@[^/]+\/[^/]+|[^/]+)/
                    );
                    if (pnpmMatch) {
                      console.log(`  检测到pnpm路径，解析路径组件...`);

                      // 尝试从pnpm路径推断workspace路径
                      const workspacePath = inferWorkspacePathFromPnpm(
                        workspaceRoot,
                        realPath,
                        packageName
                      );
                      if (workspacePath) {
                        packagePaths.push(workspacePath);
                        console.log(
                          `通过pnpm路径推断找到: ${packageName} -> ${workspacePath}`
                        );
                        found = true;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(
                `处理workspace包 ${packageName} 时出错:`,
                (error as Error).message
              );
            }
          }
        }

        // 策略4: 递归搜索整个workspace根目录
        if (!found) {
          console.log(`  策略4: 递归搜索workspace根目录`);
          try {
            const searchResult = recursiveSearchPackage(
              workspaceRoot,
              packageName,
              3
            ); // 限制深度为3
            if (searchResult) {
              packagePaths.push(searchResult);
              console.log(
                `通过递归搜索找到: ${packageName} -> ${searchResult}`
              );
              found = true;
            }
          } catch (error) {
            console.warn(`递归搜索失败: ${packageName}`, error);
          }
        }

        console.log(`包 ${packageName} 查找结果: ${found ? "找到" : "未找到"}`);
      }
    }

    // 如果根项目没有依赖，直接返回空就行
    const totalTime = Date.now() - startTime;
    console.log(
      `getWorkspaceInfo 完成，总耗时: ${totalTime}ms，找到 ${packagePaths.length} 个workspace路径`
    );
  } catch (error) {
    console.error("获取workspace信息时出错:", error);
  }

  return { packageNames, packagePaths };
}

/**
 * 获取工作区模式配置
 */
function getWorkspacePatterns(rootDir: string): string[] {
  const patterns: string[] = [];

  // 检查pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(rootDir, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmWorkspacePath)) {
    try {
      const yamlContent = fs.readFileSync(pnpmWorkspacePath, "utf-8");
      console.log(
        `读取pnpm-workspace.yaml内容:`,
        yamlContent.substring(0, 200)
      );

      // 更灵活的YAML解析
      const lines = yamlContent.split("\n");
      let inPackagesSection = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === "packages:") {
          inPackagesSection = true;
          continue;
        }

        if (inPackagesSection) {
          // 如果遇到新的顶级配置，退出packages部分
          if (
            trimmedLine &&
            !trimmedLine.startsWith("-") &&
            !trimmedLine.startsWith(" ") &&
            trimmedLine.includes(":")
          ) {
            inPackagesSection = false;
            continue;
          }

          // 解析包模式
          if (trimmedLine.startsWith("-")) {
            const pattern = trimmedLine.replace(/^\s*-\s*['"]?|['"]?\s*$/g, "");
            if (pattern) {
              patterns.push(pattern);
              console.log(`从pnpm-workspace.yaml解析到模式: ${pattern}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn("解析pnpm-workspace.yaml失败:", error);
    }
  }

  // 检查package.json的workspaces字段
  const packageJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      console.log(`检查package.json的workspaces配置:`, packageJson.workspaces);

      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          patterns.push(...packageJson.workspaces);
          console.log(
            `从package.json解析到数组模式: ${JSON.stringify(
              packageJson.workspaces
            )}`
          );
        } else if (packageJson.workspaces.packages) {
          patterns.push(...packageJson.workspaces.packages);
          console.log(
            `从package.json解析到packages模式: ${JSON.stringify(
              packageJson.workspaces.packages
            )}`
          );
        } else if (typeof packageJson.workspaces === "object") {
          // 处理其他可能的workspaces对象格式
          Object.keys(packageJson.workspaces).forEach((key) => {
            if (Array.isArray(packageJson.workspaces[key])) {
              patterns.push(...packageJson.workspaces[key]);
              console.log(
                `从package.json解析到${key}模式: ${JSON.stringify(
                  packageJson.workspaces[key]
                )}`
              );
            }
          });
        }
      }
    } catch (error) {
      console.warn("解析package.json workspaces失败:", error);
    }
  }

  // 如果没有找到任何模式，添加一些常见的默认模式
  if (patterns.length === 0) {
    const defaultPatterns = [
      "packages/*",
      "packages/*/*",
      "apps/*",
      "libs/*",
      "modules/*",
    ];
    console.log(
      `未找到workspace配置，使用默认模式: ${JSON.stringify(defaultPatterns)}`
    );
    patterns.push(...defaultPatterns);
  }

  console.log(`最终workspace模式: ${JSON.stringify(patterns)}`);
  return patterns;
}

/**
 * 解析工作区模式到实际路径
 */
function resolveWorkspacePattern(rootDir: string, pattern: string): string[] {
  const results: string[] = [];
  const startTime = Date.now();
  const TIMEOUT_MS = 30000; // 30秒超时

  try {
    console.log(`    开始解析模式: ${pattern} (根目录: ${rootDir})`);

    if (pattern.includes("*")) {
      console.log(`    检测到glob模式，开始处理...`);
      // 简单处理glob模式
      const parts = pattern.split("/");
      console.log(`    模式分割为: ${JSON.stringify(parts)}`);
      let currentPaths = [rootDir];

      for (let i = 0; i < parts.length; i++) {
        // 检查超时
        if (Date.now() - startTime > TIMEOUT_MS) {
          console.warn(`    解析模式 ${pattern} 超时，停止处理`);
          break;
        }

        const part = parts[i];
        console.log(
          `    处理部分 ${i}: ${part}, 当前路径数: ${currentPaths.length}`
        );

        if (part === "*") {
          const newPaths: string[] = [];
          let processedCount = 0;
          const MAX_DIRS_PER_LEVEL = 100; // 限制每层最多处理100个目录

          for (const currentPath of currentPaths) {
            console.log(`      扫描目录: ${currentPath}`);
            if (fs.existsSync(currentPath)) {
              try {
                const entries = fs.readdirSync(currentPath);
                console.log(`      找到 ${entries.length} 个条目`);

                for (const entry of entries) {
                  // 检查超时
                  if (Date.now() - startTime > TIMEOUT_MS) {
                    console.warn(`      处理目录条目时超时，停止处理`);
                    break;
                  }

                  // 跳过常见的大目录和不需要的目录
                  if (
                    entry.startsWith(".") ||
                    [
                      "node_modules",
                      "dist",
                      "build",
                      "coverage",
                      "tmp",
                      "temp",
                      ".git",
                      "logs",
                      "cache",
                      ".cache",
                      "public",
                      "static",
                      "assets",
                    ].includes(entry)
                  ) {
                    continue;
                  }

                  const entryPath = path.join(currentPath, entry);
                  try {
                    if (fs.statSync(entryPath).isDirectory()) {
                      newPaths.push(entryPath);
                      console.log(`        添加目录: ${entryPath}`);
                      processedCount++;

                      // 限制处理的目录数量
                      if (processedCount >= MAX_DIRS_PER_LEVEL) {
                        console.warn(
                          `      达到目录数量限制 ${MAX_DIRS_PER_LEVEL}，停止处理更多目录`
                        );
                        break;
                      }
                    }
                  } catch (error) {
                    // 忽略访问权限错误
                    console.log(`        跳过无法访问的目录: ${entryPath}`);
                  }
                }
              } catch (error) {
                console.warn(
                  `      读取目录失败: ${currentPath}, 错误: ${
                    (error as Error).message
                  }`
                );
              }
            } else {
              console.log(`      目录不存在: ${currentPath}`);
            }

            // 检查是否超时
            if (Date.now() - startTime > TIMEOUT_MS) {
              console.warn(`      扫描目录时超时，停止处理`);
              break;
            }
          }
          currentPaths = newPaths;
          console.log(`    通配符处理后路径数: ${currentPaths.length}`);
        } else if (part === "**") {
          console.log(`    处理递归通配符 **`);
          // 递归查找所有子目录
          const newPaths: string[] = [];
          for (const currentPath of currentPaths) {
            console.log(`      递归扫描: ${currentPath}`);
            const allDirs = findAllDirectories(currentPath, 3); // 限制递归深度为3
            console.log(`      找到 ${allDirs.length} 个子目录`);
            newPaths.push(...allDirs);

            // 检查超时
            if (Date.now() - startTime > TIMEOUT_MS) {
              console.warn(`      递归扫描时超时，停止处理`);
              break;
            }
          }
          currentPaths = newPaths;
          console.log(`    递归处理后路径数: ${currentPaths.length}`);
        } else {
          console.log(`    处理固定路径部分: ${part}`);
          currentPaths = currentPaths.map((p) => path.join(p, part));
          console.log(`    固定路径处理后: ${currentPaths.length} 个路径`);
        }
      }

      const existingPaths = currentPaths.filter((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });
      console.log(`    最终存在的路径: ${existingPaths.length} 个`);
      results.push(...existingPaths);
    } else {
      console.log(`    处理直接路径模式`);
      // 直接路径
      const fullPath = path.resolve(rootDir, pattern);
      console.log(`    解析为: ${fullPath}`);
      if (fs.existsSync(fullPath)) {
        results.push(fullPath);
        console.log(`    路径存在，已添加`);
      } else {
        console.log(`    路径不存在`);
      }
    }

    const elapsedTime = Date.now() - startTime;
    console.log(
      `    模式 ${pattern} 解析完成，返回 ${results.length} 个路径，耗时 ${elapsedTime}ms`
    );
  } catch (error) {
    console.warn(`解析工作区模式 ${pattern} 失败:`, error);
  }

  return results;
}

/**
 * 递归查找所有子目录
 */
function findAllDirectories(
  dir: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): string[] {
  const directories = [dir];

  // 防止递归过深
  if (currentDepth >= maxDepth) {
    console.log(`        达到最大递归深度 ${maxDepth}，停止递归: ${dir}`);
    return directories;
  }

  try {
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir);
      console.log(
        `        递归扫描目录 ${dir} (深度 ${currentDepth}): ${entries.length} 个条目`
      );

      for (const entry of entries) {
        // 跳过常见的不需要扫描的目录
        if (
          entry.startsWith(".") ||
          [
            "node_modules",
            "dist",
            "build",
            "coverage",
            "tmp",
            "temp",
            ".git",
          ].includes(entry)
        ) {
          continue;
        }

        const entryPath = path.join(dir, entry);
        try {
          if (fs.statSync(entryPath).isDirectory()) {
            directories.push(
              ...findAllDirectories(entryPath, maxDepth, currentDepth + 1)
            );
          }
        } catch (error) {
          // 忽略访问权限错误等
          console.log(`        跳过无法访问的目录: ${entryPath}`);
        }
      }
    }
  } catch (error) {
    console.log(
      `        递归扫描目录失败: ${dir}, 错误: ${(error as Error).message}`
    );
  }

  return directories;
}

/**
 * 递归搜索指定包名的package.json
 */
function recursiveSearchPackage(
  rootDir: string,
  packageName: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): string | null {
  // 防止递归过深
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    if (!fs.existsSync(rootDir)) {
      return null;
    }

    const entries = fs.readdirSync(rootDir);

    for (const entry of entries) {
      // 跳过常见的不需要搜索的目录
      if (
        entry.startsWith(".") ||
        [
          "node_modules",
          "dist",
          "build",
          "coverage",
          "tmp",
          "temp",
          ".git",
          "logs",
          "cache",
          ".cache",
          "public",
          "static",
          "assets",
        ].includes(entry)
      ) {
        continue;
      }

      const entryPath = path.join(rootDir, entry);

      try {
        const stat = fs.statSync(entryPath);
        if (stat.isDirectory()) {
          // 检查当前目录是否包含目标package.json
          const packageJsonPath = path.join(entryPath, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf-8")
              );
              if (packageJson.name === packageName) {
                console.log(
                  `    递归搜索找到包: ${packageName} 在 ${entryPath}`
                );
                return entryPath;
              }
            } catch (error) {
              // 忽略package.json解析错误
            }
          }

          // 递归搜索子目录
          const result = recursiveSearchPackage(
            entryPath,
            packageName,
            maxDepth,
            currentDepth + 1
          );
          if (result) {
            return result;
          }
        }
      } catch (error) {
        // 忽略访问权限错误
      }
    }
  } catch (error) {
    console.warn(`递归搜索目录失败: ${rootDir}`, error);
  }

  return null;
}

/**
 * 生成随机字符串，用于确保ID唯一性
 */
function generateRandomSuffix(length: number = 6): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * 确保实体ID唯一性，如果存在重复则添加随机后缀
 */
function ensureUniqueIds(entities: any[]): any[] {
  const idMap = new Map<string, number>();

  return entities.map((entity) => {
    if (!entity.id) return entity;

    const count = idMap.get(entity.id) || 0;
    idMap.set(entity.id, count + 1);

    if (count === 0) return entity;

    const randomSuffix = generateRandomSuffix();
    const newId = `${entity.id}_${randomSuffix}`;
    console.log(`ID重复，将 ${entity.id} 更新为 ${newId}`);

    return {
      ...entity,
      id: newId,
    };
  });
}

/**
 * 使用Node.js内置的文件系统查找文件
 */
function findFilesWithExtensions(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const { packageNames, packagePaths } = getWorkspaceInfo(dir);

  // 如果有workspace包路径，扫描workspace包 + 项目本身
  if (packagePaths.length > 0) {
    console.log(`扫描 ${packagePaths.length} 个workspace包路径...`);

    for (const workspacePath of packagePaths) {
      scanDirectory(workspacePath, extensions, results);
    }

    // 扫描项目根目录本身的常见源码目录
    console.log(`扫描项目根目录本身...`);
    scanProjectRootDirectories(dir, extensions, results);
  } else {
    // 如果没有workspace配置，回退到原来的扫描方式
    console.log("未找到workspace配置，使用默认扫描方式...");
    scanDirectory(dir, extensions, results);
  }

  return results;
}

/**
 * 并行扫描目录，查找指定扩展名的文件
 */
async function findFilesWithExtensionsAsync(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  const startTime = Date.now();
  const results: string[] = [];

  // 获取workspace信息（带缓存）
  let workspaceInfo = WORKSPACE_INFO_CACHE.get(dir);
  if (!workspaceInfo) {
    workspaceInfo = getWorkspaceInfo(dir);
    WORKSPACE_INFO_CACHE.set(dir, workspaceInfo);
  }

  const { packagePaths } = workspaceInfo;

  if (packagePaths.length > 0) {
    console.log(`🚀 并行扫描 ${packagePaths.length} 个workspace包路径...`);

    // 并行扫描所有workspace路径
    const scanPromises = packagePaths.map((workspacePath) => {
      console.log(`📂 扫描workspace包: ${workspacePath}`);
      return scanDirectoryAsync(
        workspacePath,
        extensions,
        PERFORMANCE_CONFIG.MAX_PARALLEL_DIRS
      );
    });

    // 添加项目根目录本身的源码目录扫描
    scanPromises.push(scanProjectRootDirectoriesAsync(dir, extensions));

    const allResults = await Promise.all(scanPromises);
    results.push(...allResults.flat());
  } else {
    console.log("未找到workspace配置，使用默认扫描方式...");
    const defaultResults = await scanDirectoryAsync(
      dir,
      extensions,
      PERFORMANCE_CONFIG.MAX_PARALLEL_DIRS
    );
    results.push(...defaultResults);
  }

  // 去重
  const uniqueResults = Array.from(new Set(results));

  const scanTime = Date.now() - startTime;
  console.log(
    `📊 文件扫描完成: 找到 ${uniqueResults.length} 个文件，耗时 ${scanTime}ms`
  );

  return uniqueResults;
}

/**
 * 扫描项目根目录的常见源码目录
 */
function scanProjectRootDirectories(
  dir: string,
  extensions: string[],
  results: string[]
) {
  // 常见的项目源码目录
  const commonSourceDirs = [
    "src",
    "lib",
    "app",
    "components",
    "pages",
    "views",
    "utils",
  ];

  // 先扫描根目录的直接文件
  scanRootFiles(dir, extensions, results);

  // 然后扫描常见的源码目录
  for (const sourceDir of commonSourceDirs) {
    const sourcePath = path.join(dir, sourceDir);
    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
      console.log(`📂 扫描项目源码目录: ${sourcePath}`);
      scanDirectory(sourcePath, extensions, results);
    }
  }
}

/**
 * 异步扫描项目根目录的常见源码目录
 */
async function scanProjectRootDirectoriesAsync(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  const results: string[] = [];

  // 常见的项目源码目录
  const commonSourceDirs = [
    "src",
    "lib",
    "app",
    "components",
    "pages",
    "views",
    "utils",
  ];

  console.log(`📁 扫描项目根目录: ${dir}`);

  // 先扫描根目录的直接文件
  const rootFiles = await scanRootFilesAsync(dir, extensions);
  results.push(...rootFiles);

  // 并行扫描常见的源码目录
  const scanPromises = commonSourceDirs.map(async (sourceDir) => {
    const sourcePath = path.join(dir, sourceDir);
    try {
      const stat = await fs.promises.stat(sourcePath);
      if (stat.isDirectory()) {
        console.log(`📂 扫描项目源码目录: ${sourcePath}`);
        return await scanDirectoryAsync(
          sourcePath,
          extensions,
          PERFORMANCE_CONFIG.MAX_PARALLEL_DIRS
        );
      }
    } catch {
      // 目录不存在，忽略
    }
    return [];
  });

  const sourceDirResults = await Promise.all(scanPromises);
  results.push(...sourceDirResults.flat());

  console.log(`✅ 项目根目录扫描完成: ${results.length} 个文件`);
  return results;
}

/**
 * 异步并行递归扫描目录
 */
async function scanDirectoryAsync(
  dir: string,
  extensions: string[],
  maxParallel: number = 4
): Promise<string[]> {
  const results: string[] = [];
  const dirsToScan = [dir];

  while (dirsToScan.length > 0) {
    // 取出一批目录进行并行扫描
    const currentBatch = dirsToScan.splice(0, maxParallel);

    const batchPromises = currentBatch.map(async (currentDir) => {
      try {
        console.log(`📂 扫描目录: ${currentDir}`);
        const files = await readdir(currentDir);
        const batchResults: string[] = [];
        const subDirs: string[] = [];

        // 并行处理当前目录下的所有文件
        const filePromises = files.map(async (file) => {
          if (
            file.startsWith(".") ||
            [
              "node_modules",
              "dist",
              "build",
              "coverage",
              "tmp",
              "temp",
            ].includes(file)
          ) {
            return;
          }

          const currentPath = path.join(currentDir, file);
          try {
            const fileStat = await stat(currentPath);

            if (fileStat.isDirectory()) {
              subDirs.push(currentPath);
            } else if (extensions.includes(path.extname(file))) {
              batchResults.push(currentPath);
              console.log(`📄 找到文件: ${currentPath}`);
            }
          } catch {
            // 忽略访问错误的文件/目录
          }
        });

        await Promise.all(filePromises);

        return { files: batchResults, dirs: subDirs };
      } catch (error) {
        console.error(`读取目录 ${currentDir} 时出错:`, error);
        return { files: [], dirs: [] };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // 收集结果
    for (const { files, dirs } of batchResults) {
      results.push(...files);
      dirsToScan.push(...dirs);
    }
  }

  return results;
}

/**
 * 扫描根目录下的直接文件（不递归）
 */
function scanRootFiles(dir: string, extensions: string[], results: string[]) {
  try {
    console.log(`扫描根目录文件: ${dir}`);
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const currentPath = path.join(dir, file);

      // 跳过目录和特殊文件
      if (fs.statSync(currentPath).isDirectory() || file.startsWith(".")) {
        continue;
      }

      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        console.log(`找到根目录文件: ${currentPath}`);
        results.push(currentPath);
      }
    }
  } catch (error) {
    console.error(`扫描根目录失败 ${dir}:`, error);
  }
}

/**
 * 异步并行扫描根目录文件
 */
async function scanRootFilesAsync(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  try {
    console.log(`📁 扫描根目录文件: ${dir}`);
    const files = await readdir(dir);
    const results: string[] = [];

    // 并行检查文件
    const checkPromises = files.map(async (file) => {
      if (file.startsWith(".")) return null;

      const currentPath = path.join(dir, file);
      try {
        const fileStat = await stat(currentPath);
        if (
          !fileStat.isDirectory() &&
          extensions.includes(path.extname(file))
        ) {
          return currentPath;
        }
      } catch {
        // 忽略访问错误的文件
      }
      return null;
    });

    const checkedFiles = await Promise.all(checkPromises);
    results.push(...(checkedFiles.filter(Boolean) as string[]));

    console.log(`✅ 根目录扫描完成: ${results.length} 个文件`);
    return results;
  } catch (error) {
    console.error(`扫描根目录失败 ${dir}:`, error);
    return [];
  }
}

/**
 * 递归扫描指定目录
 */
function scanDirectory(dir: string, extensions: string[], results: string[]) {
  try {
    console.log(`扫描目录: ${dir}`);
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const currentPath = path.join(dir, file);

      // 跳过常见的无需扫描的目录和文件
      if (
        file.startsWith(".") ||
        ["node_modules", "dist", "build", "coverage", "tmp", "temp"].includes(
          file
        )
      ) {
        continue;
      }

      if (fs.statSync(currentPath).isDirectory()) {
        // 递归扫描子目录
        scanDirectory(currentPath, extensions, results);
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          console.log(`找到文件: ${currentPath}`);
          results.push(currentPath);
        }
      }
    }
  } catch (error) {
    console.error(`读取目录 ${dir} 时出错:`, error);
  }
}

// 判断是否是 DDD 实体
function isDDDEntity(fileContent: string): boolean {
  // 检查是否导入了 @xhs/di
  const diImportPatterns = [
    /from\s+['"]@xhs\/di['"]/,
    /import\s+.*from\s+['"]@xhs\/di['"]/,
    /require\s*\(\s*['"]@xhs\/di['"]\s*\)/,
  ];

  return diImportPatterns.some((pattern) => pattern.test(fileContent));
}

export async function extractAllEntities(
  rootDir: string,
  targetFiles?: string[]
): Promise<any[]> {
  const startTime = Date.now();
  console.log(`🚀 开始从目录提取实体: ${rootDir}`);

  const extensions = [".vue", ".ts", ".tsx"];

  // 使用异步文件扫描
  const allFiles = targetFiles
    ? targetFiles.filter((file) => extensions.includes(path.extname(file)))
    : await findFilesWithExtensionsAsync(rootDir, extensions);

  console.log(`📁 找到 ${allFiles.length} 个文件`);

  if (allFiles.length === 0) {
    console.log("未找到任何文件");
    return [];
  }

  const all: any[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  // 批量并行处理文件
  const batchSize = PERFORMANCE_CONFIG.BATCH_SIZE;
  const maxParallel = PERFORMANCE_CONFIG.MAX_PARALLEL_FILES;

  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    console.log(
      `📊 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        allFiles.length / batchSize
      )} (${batch.length} 个文件)`
    );

    // 将批次分成更小的并行组
    const parallelGroups = [];
    for (let j = 0; j < batch.length; j += maxParallel) {
      parallelGroups.push(batch.slice(j, j + maxParallel));
    }

    for (const group of parallelGroups) {
      const groupPromises = group.map(async (file) => {
        try {
          return await extractEntitiesFromFile(file, rootDir);
        } catch (error) {
          errors.push({
            file,
            error: (error as Error).message,
          });
          console.error(
            `⚠️  提取文件 ${file} 失败: ${(error as Error).message}`
          );
          return [];
        }
      });

      const groupResults = await Promise.all(groupPromises);
      all.push(...groupResults.flat());
    }

    // 每批次后清理一次缓存，避免内存过载
    if ((i + batchSize) % (batchSize * 4) === 0) {
      const currentCacheSize = Array.from(FILE_CONTENT_CACHE.values()).reduce(
        (sum, item) => sum + item.content.length,
        0
      );

      if (currentCacheSize > PERFORMANCE_CONFIG.CACHE_SIZE_LIMIT) {
        console.log(
          `🧹 清理缓存，当前大小: ${Math.round(
            currentCacheSize / 1024 / 1024
          )}MB`
        );
        FILE_CONTENT_CACHE.clear();
      }
    }
  }

  // 报告错误统计
  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} 个文件提取失败:`);
    errors.forEach(({ file, error }) => {
      console.warn(`  - ${file}: ${error}`);
    });
  }

  const extractTime = Date.now() - startTime;
  console.log(`⏱️  实体提取统计:`);
  console.log(`  - 总文件数: ${allFiles.length}`);
  console.log(`  - 成功提取: ${allFiles.length - errors.length}`);
  console.log(`  - 失败文件: ${errors.length}`);
  console.log(`  - 总实体数: ${all.length}`);
  console.log(`  - 总耗时: ${extractTime}ms`);
  console.log(
    `  - 平均耗时: ${Math.round(extractTime / allFiles.length)}ms/文件`
  );

  // 确保所有实体ID唯一
  const startUniqueTime = Date.now();
  const uniqueEntities = ensureUniqueIds(all);
  const uniqueTime = Date.now() - startUniqueTime;

  console.log(
    `🔄 ID唯一性处理: ${uniqueTime}ms, 最终实体数: ${uniqueEntities.length}`
  );

  // 最终清理缓存
  clearCache();

  return uniqueEntities;
}

/**
 * 判断文件是否来自workspace包
 */
function isWorkspaceFile(filePath: string, rootDir: string): boolean {
  // 获取相对于rootDir的路径
  const relativePath = path.relative(rootDir, filePath);

  // 检查文件是否在当前项目外部（通过相对路径判断）
  if (relativePath.startsWith("..")) {
    return true;
  }

  // 标准化路径分隔符
  const normalizedPath = relativePath.replace(/\\/g, "/");

  // 检查是否直接以workspace目录开头（第一级目录）
  const pathSegments = normalizedPath.split("/");
  if (pathSegments.length > 1) {
    const firstSegment = pathSegments[0];

    // 只有当第一级目录是这些workspace目录时才判断为workspace
    if (["packages", "apps", "libs", "modules"].includes(firstSegment)) {
      return true;
    }
  }

  return false;
}

/**
 * 从单个文件提取实体（异步版本）
 */
async function extractEntitiesFromFile(
  file: string,
  rootDir: string
): Promise<any[]> {
  let entities: any[] = [];

  try {
    // 先尝试规范化路径，处理可能的node_modules workspace包
    const normalizedFile = normalizeWorkspacePath(file, rootDir);

    // 检查规范化后的文件是否存在
    if (!(await exists(normalizedFile))) {
      console.log(`⚠️ 文件不存在，跳过: ${normalizedFile}`);
      return [];
    }

    // 判断是否是workspace文件
    const isWorkspace = isWorkspaceFile(normalizedFile, rootDir);

    // 使用缓存的文件内容读取
    const fileContent = await getCachedFileContent(normalizedFile);
    const isDDD = isDDDEntity(fileContent);

    if (normalizedFile.endsWith(".vue")) {
      console.log(`📄 从Vue文件提取实体: ${normalizedFile}`);
      entities = VueExtractor.extract(normalizedFile, rootDir);
    } else if (normalizedFile.endsWith(".tsx")) {
      console.log(`📄 从TSX文件提取实体: ${normalizedFile}`);
      entities = TSXExtractor.extract(normalizedFile, rootDir);
    } else if (normalizedFile.endsWith(".ts")) {
      console.log(`📄 从TS文件提取实体: ${normalizedFile}`);
      entities = FunctionExtractor.extract(normalizedFile, rootDir);
    }

    // 确保所有实体的file字段都使用相对路径，并添加标识
    entities = entities.map((entity) => ({
      ...entity,
      file: path.relative(rootDir, normalizedFile),
      isWorkspace: isWorkspace,
      isDDD: isDDD || entity.isDDD || false,
    }));

    console.log(
      `✅ 从文件 ${normalizedFile} 提取到 ${entities.length} 个实体${
        isWorkspace ? " (workspace)" : ""
      }`
    );
    return entities;
  } catch (error) {
    console.error(`❌ 提取文件 ${file} 失败: ${(error as Error).message}`);
    throw error;
  }
}

// 根据文件路径规范化
// 如果是node_modules中的workspace包，转换为对应的真实路径
function normalizeWorkspacePath(filePath: string, rootDir: string): string {
  // 如果不是node_modules路径，直接返回
  if (!filePath.includes("node_modules")) {
    return filePath;
  }

  try {
    // 查找workspace根目录
    const workspaceRoot = findWorkspaceRoot(rootDir);
    if (!workspaceRoot) {
      console.log("未找到workspace配置，无法规范化路径");
      return filePath;
    }

    // 获取workspace信息
    const { packageNames, packagePaths } = getWorkspaceInfo(rootDir);

    // 检查是否为pnpm注入的workspace包
    // 例如: node_modules/.pnpm/file+packages+shared-utils/node_modules/@xhs/shared-utils/src/simple-logger.ts
    const pnpmMatch = filePath.match(
      /node_modules\/\.pnpm\/file\+packages\+([^/]+)\/node_modules\/(@[^/]+\/[^/]+|[^/]+)\/(.+)$/
    );
    if (pnpmMatch) {
      const packageFolder = pnpmMatch[1]; // 例如 "shared-utils"
      const packageName = pnpmMatch[2]; // 例如 "@xhs/shared-utils"
      const relativePath = pnpmMatch[3]; // 例如 "src/simple-logger.ts"

      console.log(
        `检测到pnpm链接包: ${packageName} (文件夹: ${packageFolder})`
      );

      // 尝试找到对应的workspace路径
      for (const wsPath of packagePaths) {
        if (
          wsPath.endsWith(`/packages/${packageFolder}`) ||
          wsPath.endsWith(`\\packages\\${packageFolder}`)
        ) {
          const normalizedPath = path.join(wsPath, relativePath);
          console.log(`规范化pnpm路径: ${filePath} -> ${normalizedPath}`);
          return normalizedPath;
        }
      }
    }

    // 检查常规node_modules路径
    const nodeModulesMatch = filePath.match(
      /node_modules\/(@[^/]+\/[^/]+|[^/]+)\/(.+)$/
    );
    if (nodeModulesMatch) {
      const packageName = nodeModulesMatch[1];
      const relativePath = nodeModulesMatch[2];

      // 查找对应的workspace路径
      const packageIndex = packageNames.findIndex(
        (name) => name === packageName
      );
      if (packageIndex >= 0 && packageIndex < packagePaths.length) {
        const workspacePath = packagePaths[packageIndex];
        const normalizedPath = path.join(workspacePath, relativePath);
        console.log(`规范化node_modules路径: ${filePath} -> ${normalizedPath}`);
        return normalizedPath;
      }
    }

    // 如果无法规范化，返回原始路径
    return filePath;
  } catch (error) {
    console.error(`规范化workspace路径失败: ${error}`);
    return filePath;
  }
}

/**
 * 通过智能包名模式搜索包
 */
function searchPackageByIntelligentPatterns(
  workspaceRoot: string,
  packageName: string
): string | null {
  console.log(`    智能搜索包: ${packageName}`);

  // 生成可能的搜索路径
  const searchPaths = generateIntelligentSearchPaths(
    workspaceRoot,
    packageName
  );

  for (const searchPath of searchPaths) {
    console.log(`    检查路径: ${path.relative(workspaceRoot, searchPath)}`);

    if (fs.existsSync(searchPath)) {
      const packageJsonPath = path.join(searchPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf-8")
          );
          if (packageJson.name === packageName) {
            console.log(`    ✅ 找到匹配的包: ${searchPath}`);
            return searchPath;
          }
        } catch (error) {
          // 忽略解析错误
        }
      }
    }
  }

  return null;
}

/**
 * 生成智能搜索路径 - 保持原有逻辑 + 动态补充
 */
function generateIntelligentSearchPaths(
  workspaceRoot: string,
  packageName: string
): string[] {
  const paths: string[] = [];

  // 移除作用域前缀
  const nameWithoutScope = packageName.startsWith("@")
    ? packageName.split("/")[1]
    : packageName;

  // 1. 保持原有的特定包硬编码逻辑（确保兼容性）
  if (packageName === "@xhs/shared-ark") {
    // shared-ark 可能在 shared 目录中
    paths.push(
      path.join(workspaceRoot, "shared", "shared-ark"),
      path.join(workspaceRoot, "shared", "ark"),
      path.join(workspaceRoot, "packages", "shared", "shared-ark"),
      path.join(workspaceRoot, "packages", "shared", "ark"),
      path.join(workspaceRoot, "packages", "shared-ark")
    );
  } else if (packageName === "@xhs/fulfillment-common-ark") {
    // fulfillment-common-ark 可能在 fulfillment/fulfillment-common 下
    paths.push(
      path.join(
        workspaceRoot,
        "packages",
        "fulfillment",
        "fulfillment-common",
        "ark"
      ),
      path.join(
        workspaceRoot,
        "packages",
        "fulfillment",
        "fulfillment-common-ark"
      ),
      path.join(workspaceRoot, "packages", "fulfillment-common", "ark"),
      path.join(workspaceRoot, "packages", "fulfillment-common-ark")
    );
  } else if (packageName === "@xhs/lib-fulfillment-modules") {
    // lib-fulfillment-modules 可能在 fulfillment/fulfillment-common 下
    paths.push(
      path.join(
        workspaceRoot,
        "packages",
        "fulfillment",
        "fulfillment-common",
        "biz-module"
      ),
      path.join(
        workspaceRoot,
        "packages",
        "fulfillment",
        "fulfillment-common",
        "lib-fulfillment-modules"
      ),
      path.join(
        workspaceRoot,
        "packages",
        "fulfillment",
        "lib-fulfillment-modules"
      ),
      path.join(workspaceRoot, "packages", "lib-fulfillment-modules")
    );
  }

  // 2. 动态补充：通过实际包映射查找精确路径
  const exactPath = findExactWorkspacePackagePath(workspaceRoot, packageName);
  if (exactPath && !paths.includes(exactPath)) {
    paths.push(exactPath);
    console.log(
      `  📍 动态发现补充路径: ${packageName} -> ${path.relative(
        workspaceRoot,
        exactPath
      )}`
    );
  }

  // 3. 通用模式：基于包名推测（保持原有逻辑）
  const namePatterns = [
    nameWithoutScope, // shared-ark
    nameWithoutScope.replace("-ark", ""), // shared
    nameWithoutScope.replace("-moon", ""), // shared (去掉moon后缀)
    nameWithoutScope.replace("-", "/"), // shared/ark
    nameWithoutScope.split("-").pop() || "", // ark
  ].filter(Boolean);

  // 常见的目录结构（保持原有的覆盖范围）
  const commonDirs = [
    "packages",
    "packages/shared",
    "packages/fulfillment",
    "packages/fulfillment/fulfillment-common",
    "shared",
    "libs",
    "modules",
  ];

  for (const dir of commonDirs) {
    for (const pattern of namePatterns) {
      const candidatePath = path.join(workspaceRoot, dir, pattern);
      if (!paths.includes(candidatePath)) {
        paths.push(candidatePath);
      }
    }
  }

  console.log(`  生成了 ${paths.length} 个候选路径用于搜索 ${packageName}`);

  // 去重
  return Array.from(new Set(paths));
}

/**
 * 查找workspace包的精确路径（基于实际的包映射）
 */
function findExactWorkspacePackagePath(
  workspaceRoot: string,
  packageName: string
): string | null {
  try {
    // 缓存包映射以提高性能
    if (!WORKSPACE_PACKAGE_CACHE.has(workspaceRoot)) {
      const packageMap = buildRealWorkspacePackageMap(workspaceRoot);
      WORKSPACE_PACKAGE_CACHE.set(workspaceRoot, packageMap);
    }

    const packageMap = WORKSPACE_PACKAGE_CACHE.get(workspaceRoot)!;
    return packageMap.get(packageName) || null;
  } catch (error) {
    console.warn(`查找包 ${packageName} 时出错: ${error}`);
    return null;
  }
}

/**
 * 构建真实的workspace包映射
 */
function buildRealWorkspacePackageMap(
  workspaceRoot: string
): Map<string, string> {
  const packageMap = new Map<string, string>();

  try {
    console.log(`  🔍 构建workspace包映射 (根目录: ${workspaceRoot})...`);

    // 获取所有workspace patterns
    const workspacePatterns = getWorkspacePatterns(workspaceRoot);
    console.log(`  找到workspace模式: ${JSON.stringify(workspacePatterns)}`);

    let totalFound = 0;

    for (const pattern of workspacePatterns) {
      console.log(`  处理模式: ${pattern}`);
      const possiblePaths = resolveWorkspacePattern(workspaceRoot, pattern);
      console.log(`    解析出 ${possiblePaths.length} 个路径`);

      for (const possiblePath of possiblePaths) {
        const packageJsonPath = path.join(possiblePath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf-8")
            );
            if (packageJson.name) {
              packageMap.set(packageJson.name, possiblePath);
              console.log(
                `    📦 ${packageJson.name} -> ${path.relative(
                  workspaceRoot,
                  possiblePath
                )}`
              );
              totalFound++;
            }
          } catch (error) {
            // 忽略解析错误
            console.warn(`    ⚠️  解析 ${packageJsonPath} 失败: ${error}`);
          }
        }
      }
    }

    console.log(`  ✅ 包映射构建完成，找到 ${totalFound} 个workspace包`);
  } catch (error) {
    console.warn(`构建包映射失败: ${error}`);
  }

  return packageMap;
}

/**
 * 从pnpm路径推断workspace路径
 */
function inferWorkspacePathFromPnpm(
  workspaceRoot: string,
  pnpmPath: string,
  packageName: string
): string | null {
  console.log(`    推断pnpm路径: ${pnpmPath}`);

  // 解析pnpm路径模式: file+packages+fulfillment+fulfillment-common+ark
  const match = pnpmPath.match(/file\+packages\+(.+?)\/node_modules/);
  if (match) {
    const pathComponents = match[1].split("+");
    console.log(`    路径组件: ${JSON.stringify(pathComponents)}`);

    // 重构路径
    const workspacePath = path.join(
      workspaceRoot,
      "packages",
      ...pathComponents
    );
    console.log(`    推断的workspace路径: ${workspacePath}`);

    // 验证路径是否存在且包含正确的package.json
    if (fs.existsSync(workspacePath)) {
      const packageJsonPath = path.join(workspacePath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf-8")
          );
          if (packageJson.name === packageName) {
            console.log(`    ✅ 验证成功: ${workspacePath}`);
            return workspacePath;
          }
        } catch (error) {
          console.log(`    ❌ package.json解析失败: ${error}`);
        }
      }
    }
  }

  return null;
}

// 导出测试需要的函数
export {
  findWorkspaceRoot,
  buildRealWorkspacePackageMap,
  getWorkspaceInfo,
  generateIntelligentSearchPaths,
};
