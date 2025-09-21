"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 简单的文件日志工具类
 */
class SimpleLogger {
    constructor(projectRoot) {
        // 使用传入的 projectRoot，最后fallback到当前工作目录
        const baseDir = projectRoot || process.cwd();
        this.logDir = path_1.default.join(baseDir, 'logs', 'rag-tool');
        this.enableLogging = process.env.RAG_TOOL_DEBUG === 'true';
        if (this.enableLogging) {
            this.ensureLogDir();
        }
    }
    ensureLogDir() {
        try {
            if (!fs_1.default.existsSync(this.logDir)) {
                fs_1.default.mkdirSync(this.logDir, { recursive: true });
            }
        }
        catch (error) {
            // 如果创建日志目录失败，禁用日志记录
            this.enableLogging = false;
        }
    }
    getLogFileName() {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
        return path_1.default.join(this.logDir, `rag-tool-${date}.log`);
    }
    writeLog(level, message) {
        if (!this.enableLogging)
            return;
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] [${level}] ${message}\n`;
            fs_1.default.appendFileSync(this.getLogFileName(), logEntry, 'utf8');
        }
        catch (error) {
            // 静默失败，避免影响主要功能
        }
    }
    log(message) {
        this.writeLog('INFO', message);
    }
    warn(message) {
        this.writeLog('WARN', message);
    }
    error(message) {
        this.writeLog('ERROR', message);
    }
}
exports.SimpleLogger = SimpleLogger;
//# sourceMappingURL=simple-logger.js.map