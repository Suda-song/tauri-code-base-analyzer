// apps/ecommerce-after-sale/src/utils/validation.ts
// 定义一个验证函数，用于验证售后申请数据是否有效
export function validateAfterSale(data: any): boolean {
    if (!data.orderId) return false;
    if (!data.reason) return false;
    return true;
  }
  