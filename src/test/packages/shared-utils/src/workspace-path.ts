import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 从shell配置文件中读取环境变量的值
 * @param varName 变量名
 * @returns 变量值或null
 */
function readEnvFromShellConfig(varName: string): string | null {
  const homeDir = os.homedir();
  const configFiles = ['.zshrc', '.bashrc', '.profile', '.bash_profile'];
  
  for (const configFile of configFiles) {
    const configPath = path.join(homeDir, configFile);
    
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        
        // 匹配 export VAR_NAME=value 或 VAR_NAME=value 格式
        const patterns = [
          new RegExp(`^\\s*export\\s+${varName}\\s*=\\s*["']?([^"'\\s]+)["']?\\s*$`, 'm'),
          new RegExp(`^\\s*${varName}\\s*=\\s*["']?([^"'\\s]+)["']?\\s*$`, 'm')
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            // 处理路径中的 ~ 符号
            let value = match[1];
            if (value.startsWith('~')) {
              value = value.replace('~', homeDir);
            }
            return value;
          }
        }
      }
    } catch (error) {
      // 忽略读取错误，继续尝试下一个文件
      continue;
    }
  }
  
  return null;
}

/**
 * 获取单个工作空间路径（内部使用）
 * 按照以下优先级顺序：
 * 1. process.env.CODE_RESEARCH_WORKSPACE_PATH
 * 2. 从shell配置文件读取CODE_RESEARCH_WORKSPACE_PATH变量
 * 3. process.env.CURSOR_WORKSPACE_PATH
 * 4. process.cwd()
 * 
 * @returns 单个工作空间路径
 */
function getSingleWorkspacePath(): string {
  // 1. 先通过process.env.CODE_RESEARCH_WORKSPACE_PATH获取
  if (process.env.CODE_RESEARCH_WORKSPACE_PATH) {
    return process.env.CODE_RESEARCH_WORKSPACE_PATH;
  }
  
  // 2. 从shell配置文件读取CODE_RESEARCH_WORKSPACE_PATH变量
  const pathFromShell = readEnvFromShellConfig('CODE_RESEARCH_WORKSPACE_PATH');
  if (pathFromShell) {
    return pathFromShell;
  }
  
  // 3. 通过process.env.CURSOR_WORKSPACE_PATH获取
  if (process.env.CURSOR_WORKSPACE_PATH) {
    return process.env.CURSOR_WORKSPACE_PATH;
  }
  
  // 4. 最后通过process.cwd()获取
  return process.cwd();
}

/**
 * 获取工作空间路径数组
 * 支持多workspace场景，返回数组形式（至少包含一个workspace）
 * 如果配置的是单个路径，会自动转换为数组
 * 如果配置的是多个路径（用逗号或分号分隔），会解析为数组
 * 
 * @returns 工作空间路径数组
 */
export function getWorkspacePath(): string[] {
  const singlePath = getSingleWorkspacePath();
  
  // 检查是否包含分隔符（支持逗号和分号）
  if (singlePath.includes(',') || singlePath.includes(';')) {
    const delimiter = singlePath.includes(',') ? ',' : ';';
    return singlePath
      .split(delimiter)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
  
  // 如果是单个路径，转换为数组
  return [singlePath];
}

/**
 * 获取entities文件的完整路径（多workspace支持）
 * @param filename 文件名，默认为 'entities.enriched.json'
 * @param workspacePaths 可选的工作空间路径数组，如果不提供则自动获取
 * @returns entities文件的完整路径数组
 */
export function getEntitiesFilePath(filename: string = 'entities.enriched.json', workspacePaths?: string[]): string[] {
  const workspaces = workspacePaths || getWorkspacePath();
  return workspaces.map(workspace => path.join(workspace, 'data', filename));
} 