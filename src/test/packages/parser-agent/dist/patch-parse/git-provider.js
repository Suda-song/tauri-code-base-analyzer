"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitChangedFilesProvider = void 0;
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const shared_utils_1 = require("@xhs/shared-utils");
// Git变更文件获取器
class GitChangedFilesProvider {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    async getGitChangedFiles() {
        let gitRoot = '';
        let relativePath = '';
        try {
            gitRoot = (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
                encoding: 'utf-8',
                cwd: this.rootDir
            }).trim();
            const currentDir = this.rootDir;
            console.log('gitRoot', gitRoot);
            console.log('currentDir', currentDir);
            relativePath = path_1.default.relative(gitRoot, currentDir);
            console.log('relativePath', relativePath);
        }
        catch (error) {
            console.log('警告: 指定目录不是 git 仓库，将处理所有文件');
            return [];
        }
        let changedFiles = [];
        let allGitChangedFiles = [];
        try {
            // 获取已跟踪的变更文件（在git根目录执行）
            const diffOutput = (0, child_process_1.execSync)('git diff --diff-filter=ACMR --name-only', {
                encoding: 'utf-8',
                cwd: gitRoot
            });
            const trackedFiles = diffOutput
                .split('\n')
                .filter(file => file.trim())
                .map(file => path_1.default.resolve(gitRoot, file.trim()));
            // 获取未跟踪的文件（在git根目录执行）
            const untrackedOutput = (0, child_process_1.execSync)('git ls-files --others --exclude-standard', {
                encoding: 'utf-8',
                cwd: gitRoot
            });
            const untrackedFiles = untrackedOutput
                .split('\n')
                .filter(file => file.trim())
                .map(file => path_1.default.resolve(gitRoot, file.trim()));
            // 保存所有变更文件（用于workspace包检测）
            allGitChangedFiles = [...trackedFiles, ...untrackedFiles];
            // 过滤当前目录下的文件
            changedFiles = allGitChangedFiles.filter(file => !relativePath || file.startsWith(path_1.default.resolve(gitRoot, relativePath) + path_1.default.sep) ||
                file === path_1.default.resolve(gitRoot, relativePath));
            console.log(`🔍 Git变更检测:`);
            console.log(`  - 全部变更文件: ${allGitChangedFiles.length} 个`);
            console.log(`  - 当前目录变更: ${changedFiles.length} 个`);
            // 检测workspace包中的变更文件
            console.log(`\n🔗 检测workspace包变更...`);
            const workspaceChangedFiles = (0, shared_utils_1.getWorkspaceChangedFiles)(this.rootDir, allGitChangedFiles, {
                includeDevDependencies: true,
                includePeerDependencies: false,
                maxDepth: 3
            });
            if (workspaceChangedFiles.length > 0) {
                console.log(`📦 发现workspace包变更文件: ${workspaceChangedFiles.length} 个`);
                // 去重：只添加不在 changedFiles 中的 workspace 文件
                const uniqueWorkspaceFiles = workspaceChangedFiles.filter(wsFile => !changedFiles.some(existingFile => path_1.default.resolve(existingFile) === path_1.default.resolve(wsFile)));
                if (uniqueWorkspaceFiles.length > 0) {
                    console.log(`📦 添加 ${uniqueWorkspaceFiles.length} 个新的workspace变更文件`);
                    changedFiles.push(...uniqueWorkspaceFiles);
                }
                else {
                    console.log(`📦 workspace变更文件已在git变更列表中，无需重复添加`);
                }
                console.log(`📊 合并后总变更文件: ${changedFiles.length} 个`);
            }
            else {
                console.log(`📭 无workspace包变更`);
            }
        }
        catch (error) {
            console.log('警告: 无法获取 git 变更');
            return [];
        }
        return changedFiles;
    }
    getDeletedFiles() {
        let gitRoot = '';
        let relativePath = '';
        try {
            gitRoot = (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
                encoding: 'utf-8',
                cwd: this.rootDir
            }).trim();
            const currentDir = this.rootDir;
            relativePath = path_1.default.relative(gitRoot, currentDir);
        }
        catch (error) {
            return [];
        }
        try {
            const deletedOutput = (0, child_process_1.execSync)('git diff --diff-filter=D --name-only', {
                encoding: 'utf-8',
                cwd: gitRoot
            });
            return deletedOutput
                .split('\n')
                .filter(file => file.trim())
                // 只保留当前目录下的文件
                .filter(file => !relativePath || file.startsWith(relativePath + path_1.default.sep) || file === relativePath)
                // 转换为绝对路径
                .map(file => path_1.default.resolve(gitRoot, file.trim()));
        }
        catch (error) {
            console.log('警告: 无法获取删除的文件列表');
            return [];
        }
    }
}
exports.GitChangedFilesProvider = GitChangedFilesProvider;
