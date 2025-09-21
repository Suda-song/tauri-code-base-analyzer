/**
 * 简单的文件日志工具类
 */
export declare class SimpleLogger {
    private logDir;
    private enableLogging;
    constructor(projectRoot?: string);
    private ensureLogDir;
    private getLogFileName;
    private writeLog;
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
//# sourceMappingURL=simple-logger.d.ts.map