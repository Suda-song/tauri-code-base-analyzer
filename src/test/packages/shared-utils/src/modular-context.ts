import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/** 上下文配置类型 */
export enum ContextType {
  REDDOC = "redDoc",
  PINGCODE = "pingCode",
  UNRECOGNIZED = "unrecognized",
}

/**
 * 上下文项类型定义
 */
export interface ContextItem {
  id: string;
  type: ContextType;
  title: string;
  content: string;
  link: string;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分支上下文数据
 */
export interface BranchContextData {
  branchName: string;
  contexts: ContextItem[];
  lastUpdated: string;
  isActive: boolean;
}

/**
 * RedDoc上下文项（只包含必要字段）
 */
export interface RedDocContextItem {
  title: string;
  filePath: string;
}

/**
 * 上下文存储数据结构
 */
export interface ContextStorageData {
  currentBranch: string;
  branches: { [branchName: string]: BranchContextData };
  configuredBranches: string[];
  version: string;
}

/**
 * 获取 Cursor 的全局存储路径
 */
function getCursorGlobalStoragePath(): string {
  const homeDir = os.homedir();

  switch (process.platform) {
    case "darwin": // macOS
      return path.join(
        homeDir,
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage"
      );
    case "win32": // Windows
      return path.join(
        homeDir,
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage"
      );
    case "linux": // Linux
      return path.join(homeDir, ".config", "Cursor", "User", "globalStorage");
    default:
      throw new Error(`不支持的操作系统: ${process.platform}`);
  }
}

/**
 * 获取Cline上下文配置文件路径
 */
function getClineContextFilePath(): string {
  const globalStoragePath = getCursorGlobalStoragePath();
  // Cline扩展ID: xhs.modular
  const extensionStoragePath = path.join(globalStoragePath, "xhs.modular");
  return path.join(extensionStoragePath, "contexts", "branch_contexts.json");
}

/**
 * 读取 Modular Dev 的上下文配置
 * @returns 返回上下文配置数据，如果文件不存在则返回null
 */
export async function readModularContext(): Promise<ContextStorageData | null> {
  try {
    const contextFilePath = getClineContextFilePath();

    // 检查文件是否存在
    try {
      await fs.access(contextFilePath);
    } catch (error) {
      console.log(`🍃 上下文配置文件不存在: ${contextFilePath}`);
      return null;
    }

    // 读取并解析JSON文件
    const fileContent = await fs.readFile(contextFilePath, "utf8");
    const contextData: ContextStorageData = JSON.parse(fileContent);

    return contextData;
  } catch (error) {
    console.error(`🍃 读取Cline上下文配置失败:`, error);
    return null;
  }
}

/**
 * 获取当前分支的上下文信息
 * @param contextData Modular Dev 上下文数据
 * @returns 返回指定分支的上下文数据
 */
export async function getCurrentBranchContext(
  contextData: ContextStorageData
): Promise<BranchContextData | null> {
  let currentBranch = "";
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD");
    currentBranch = stdout.trim();
  } catch (error) {
    throw new Error("获取分支上下文失败: " + error);
  }
  const targetBranch = currentBranch || contextData.currentBranch;
  return contextData.branches[targetBranch] || null;
}
