import fs from 'fs';
import path from 'path';

/**
 * 简单的文件日志工具类
 */
export class SimpleLogger {
  private logDir: string;
  private enableLogging: boolean;

  constructor(projectRoot?: string) {
    // 使用传入的 projectRoot，最后fallback到当前工作目录
    const baseDir = projectRoot || process.cwd();
    this.logDir = path.join(baseDir, 'logs', 'rag-tool');
    this.enableLogging = process.env.RAG_TOOL_DEBUG === 'true';
    
    if (this.enableLogging) {
      this.ensureLogDir();
    }
  }

  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // 如果创建日志目录失败，禁用日志记录
      this.enableLogging = false;
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
    return path.join(this.logDir, `rag-tool-${date}.log`);
  }

  private writeLog(level: string, message: string): void {
    if (!this.enableLogging) return;

    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] ${message}\n`;
      fs.appendFileSync(this.getLogFileName(), logEntry, 'utf8');
    } catch (error) {
      // 静默失败，避免影响主要功能
    }
  }

  log(message: string): void {
    this.writeLog('INFO', message);
  }

  warn(message: string): void {
    this.writeLog('WARN', message);
  }

  error(message: string): void {
    this.writeLog('ERROR', message);
  }
} 