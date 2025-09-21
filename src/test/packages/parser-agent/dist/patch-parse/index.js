"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTaskQueue = initializeTaskQueue;
exports.addFilesToQueueWithDeletion = addFilesToQueueWithDeletion;
exports.addFilesToQueue = addFilesToQueue;
exports.addGitChangedFilesToQueue = addGitChangedFilesToQueue;
exports.startTaskQueue = startTaskQueue;
exports.pauseTaskQueue = pauseTaskQueue;
exports.resumeTaskQueue = resumeTaskQueue;
exports.getTaskProgress = getTaskProgress;
exports.resetTaskQueue = resetTaskQueue;
exports.getFileEntityMappings = getFileEntityMappings;
exports.getCurrentInitConfig = getCurrentInitConfig;
const task_queue_manager_1 = require("./task-queue-manager");
const git_provider_1 = require("./git-provider");
const entity_file_manager_1 = require("./entity-file-manager");
const patch_parse_processor_1 = require("./patch-parse-processor");
// 全局处理器实例
let globalProcessor = null;
let globalGitProvider = null;
// 记录当前初始化配置，用于检测是否需要重新初始化
let currentInitConfig = null;
/**
 * 初始化任务队列（设置回调）
 * @param callback 进度回调函数
 * @param options 处理选项
 * @param force 是否强制重新初始化，默认false
 */
function initializeTaskQueue(callback, options = {}, force = false) {
    const rootDir = options.rootDir || process.cwd();
    const newConfig = {
        rootDir,
        baseFileCount: options.baseFileCount
    };
    // 检查是否需要重新初始化
    const needsReinit = force ||
        !globalProcessor ||
        !currentInitConfig ||
        currentInitConfig.rootDir !== newConfig.rootDir ||
        currentInitConfig.baseFileCount !== newConfig.baseFileCount;
    if (!needsReinit) {
        console.log('🔄 任务队列已初始化且配置未变更，跳过重复初始化');
        // 更新回调函数（可能变化）
        const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
        taskManager.setCallback(callback);
        return;
    }
    if (globalProcessor) {
        console.log('🔄 检测到配置变更，重新初始化任务队列');
        // 清理旧的处理器状态
        globalProcessor.clearFileEntityMappings();
    }
    else {
        console.log('🚀 首次初始化任务队列');
    }
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    taskManager.setCallback(callback);
    // 设置基础文件数量
    if (options.baseFileCount !== undefined) {
        taskManager.setBaseFileCount(options.baseFileCount);
    }
    else {
        const entityManager = new entity_file_manager_1.EntityFileManager(rootDir);
        const existingCount = entityManager.getExistingFileCount();
        taskManager.setBaseFileCount(existingCount);
    }
    // 初始化全局处理器和Git提供者
    globalProcessor = new patch_parse_processor_1.PatchParseProcessor(rootDir, options);
    globalGitProvider = new git_provider_1.GitChangedFilesProvider(rootDir);
    // 记录当前配置
    currentInitConfig = newConfig;
    console.log(`📊 任务队列已初始化，基础文件数量: ${taskManager.getProgress().processedFiles - taskManager.getProgress().pendingFiles}`);
}
/**
 * 添加文件到处理队列（支持删除文件处理）
 * @param files 变更文件路径列表
 * @param deletedFiles 删除文件路径列表
 * @param options 处理选项
 */
async function addFilesToQueueWithDeletion(files, deletedFiles = [], options = {}) {
    if (!globalProcessor) {
        throw new Error('请先调用 initializeTaskQueue 初始化任务队列');
    }
    if (files.length === 0 && deletedFiles.length === 0) {
        console.log('📭 没有文件需要处理');
        return;
    }
    console.log(`📋 添加文件到队列: ${files.length} 个新文件, ${deletedFiles.length} 个删除文件`);
    // 先解析更新 entities.json，处理删除文件，然后添加到队列
    await globalProcessor.parseAndEnrichFiles(files, deletedFiles, options);
    // 自动启动任务队列处理（保持与原先逻辑一致）
    if (files.length > 0) {
        console.log('🚀 自动启动任务队列处理');
        await globalProcessor.startProcessingQueue(options);
    }
}
/**
 * 添加文件到处理队列（不支持删除文件）
 * @param files 变更文件路径列表
 * @param options 处理选项
 */
async function addFilesToQueue(files, options = {}) {
    return addFilesToQueueWithDeletion(files, [], options);
}
/**
 * 添加git变更文件到处理队列（包含删除文件处理）
 * @param options 处理选项（可选的rootDir，优先使用全局实例）
 */
async function addGitChangedFilesToQueue(options = {}) {
    let gitProvider;
    // 优先使用全局Git提供者，如果不存在则创建临时实例（向后兼容）
    if (globalGitProvider) {
        gitProvider = globalGitProvider;
    }
    else {
        // 向后兼容：如果未初始化全局实例，则创建临时实例
        const rootDir = options.rootDir || process.cwd();
        gitProvider = new git_provider_1.GitChangedFilesProvider(rootDir);
        console.log('⚠️ 建议先调用 initializeTaskQueue 进行初始化以获得更好的性能');
    }
    console.log(`🔍 获取git变更文件...`);
    // 获取git变更文件和删除文件
    const changedFiles = await gitProvider.getGitChangedFiles();
    const deletedFiles = gitProvider.getDeletedFiles();
    if (changedFiles.length === 0 && deletedFiles.length === 0) {
        console.log('📭 没有发现git变更文件');
        globalProcessor?.notifyProgress();
        return;
    }
    console.log(`📋 发现 ${changedFiles.length} 个git变更文件, ${deletedFiles.length} 个删除文件`);
    // 处理git变更文件和删除文件
    await addFilesToQueueWithDeletion(changedFiles, deletedFiles, options);
}
/**
 * 开始处理任务队列（只做富化处理）
 * @param options 处理选项
 */
async function startTaskQueue(options = {}) {
    if (!globalProcessor) {
        throw new Error('请先调用 initializeTaskQueue 初始化任务队列');
    }
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    if (!taskManager.hasWork()) {
        console.log('📭 任务队列为空，无需处理');
        return;
    }
    console.log('🚀 开始处理任务队列');
    await globalProcessor.startProcessingQueue(options);
}
/**
 * 暂停任务队列
 */
function pauseTaskQueue() {
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    taskManager.pause();
}
/**
 * 恢复任务队列
 */
async function resumeTaskQueue(options = {}) {
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    taskManager.resume();
    // 如果有待处理的任务且没有在处理中，重新启动处理队列
    if (!taskManager.isProcessingState() && taskManager.hasWork() && globalProcessor) {
        console.log('🚀 恢复后检测到待处理任务，重新启动处理队列');
        await globalProcessor.startProcessingQueue(options);
    }
}
/**
 * 获取当前任务进度
 */
function getTaskProgress() {
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    return taskManager.getProgress();
}
/**
 * 重置任务队列
 */
function resetTaskQueue() {
    const taskManager = task_queue_manager_1.TaskQueueManager.getInstance();
    taskManager.reset();
    // 清理全局处理器的文件实体映射
    if (globalProcessor) {
        globalProcessor.clearFileEntityMappings();
    }
    globalProcessor = null;
    globalGitProvider = null;
    currentInitConfig = null;
}
/**
 * 获取文件实体映射状态（用于调试）
 */
function getFileEntityMappings() {
    if (!globalProcessor) {
        throw new Error('请先调用 initializeTaskQueue 初始化任务队列');
    }
    return globalProcessor.getFileEntityMappings();
}
function getCurrentInitConfig() {
    return currentInitConfig;
}
