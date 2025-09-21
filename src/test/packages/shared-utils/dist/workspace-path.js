"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspacePath = getWorkspacePath;
exports.getEntitiesFilePath = getEntitiesFilePath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * 从shell配置文件中读取环境变量的值
 * @param varName 变量名
 * @returns 变量值或null
 */
function readEnvFromShellConfig(varName) {
    const homeDir = os_1.default.homedir();
    const configFiles = ['.zshrc', '.bashrc', '.profile', '.bash_profile'];
    for (const configFile of configFiles) {
        const configPath = path_1.default.join(homeDir, configFile);
        try {
            if (fs_1.default.existsSync(configPath)) {
                const content = fs_1.default.readFileSync(configPath, 'utf-8');
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
        }
        catch (error) {
            // 忽略读取错误，继续尝试下一个文件
            continue;
        }
    }
    return null;
}
/**
 * 获取工作空间路径
 * 按照以下优先级顺序：
 * 1. process.env.CODE_RESEARCH_WORKSPACE_PATH
 * 2. 从shell配置文件读取CODE_RESEARCH_WORKSPACE_PATH变量
 * 3. process.env.CURSOR_WORKSPACE_PATH
 * 4. process.cwd()
 *
 * @returns 工作空间路径
 */
function getWorkspacePath() {
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
 * 获取entities文件的完整路径
 * @param filename 文件名，默认为 'entities.enriched.json'
 * @param workspacePath 可选的工作空间路径，如果不提供则自动获取
 * @returns entities文件的完整路径
 */
function getEntitiesFilePath(filename = 'entities.enriched.json', workspacePath) {
    const workspace = workspacePath || getWorkspacePath();
    return path_1.default.join(workspace, 'data', filename);
}
//# sourceMappingURL=workspace-path.js.map