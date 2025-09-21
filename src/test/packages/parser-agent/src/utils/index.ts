/**
 * 实用工具函数
 */
import crypto from 'crypto';

/**
 * 规范化代码内容，移除空格和空行等不影响语义的字符
 * @param content 原始代码内容
 * @returns 规范化后的代码内容
 */
function normalizeCode(content: string): string {
  if (!content) return '';
  // 更彻底的规范化处理:
  // 1. 先删除所有空白字符（包括空格、制表符、换行符等）
  // 2. 保留字母、数字、符号和标点
  return content
    .replace(/\/\/.*$/gm, '') // 删除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 删除多行注释
    .replace(/\s+/g, ''); // 删除所有空白字符
}

/**
 * 规范化注释内容，只移除多余的空白字符，保留注释内容
 * @param content 原始注释内容
 * @returns 规范化后的注释内容
 */
function normalizeAnnotation(content: string): string {
  if (!content) return '';
  // 对于注释，我们只规范化空白字符，但保留注释内容
  return content
    .replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
    .trim(); // 移除首尾空白字符
}

/**
 * 计算字符串的MD5哈希值
 * @param content 需要计算哈希的内容
 * @param normalize 是否需要规范化内容 (默认为true)
 * @returns MD5哈希值
 */
export function calculateMd5(content: string, normalize: boolean = true): string {
  if (!content) return '';
  const processedContent = normalize ? normalizeCode(content) : content;
  return crypto.createHash('md5').update(processedContent).digest('hex');
}

/**
 * 计算注释的MD5哈希值，保留注释内容但规范化空白字符
 * @param content 注释内容
 * @returns MD5哈希值
 */
export function calculateAnnotationMd5(content: string): string {
  if (!content) return '';
  const processedContent = normalizeAnnotation(content);
  return crypto.createHash('md5').update(processedContent).digest('hex');
}
