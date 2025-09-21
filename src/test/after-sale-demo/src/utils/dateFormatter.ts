// 定义一个日期格式化函数，用于将日期格式化为YYYY-MM-DD HH:MM:SS格式
export function formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
  }
  