// apps/ecommerce-after-sale/src/api/afterSale.ts
import axios from 'axios';

// 定义接口类型
export interface AfterSaleStats { 
  count: number; 
  updatedAt: string 
}

export interface AfterSaleResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface RefundRequest {
  amount: number;
  method: string;
  orderId?: string;
}

// 启用模拟数据返回
let useMock = true;

/**
 * 开关mock功能的函数
 * @param enabled 是否启用mock功能
 */
export function setMockEnabled(enabled: boolean): void {
  useMock = enabled;
}

// 售后申请接口
export function submitAfterSale(payload: any): Promise<AfterSaleResponse> {
  console.log('submitAfterSale', payload);
  
  if (useMock) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          message: '售后申请提交成功',
          data: { orderId: payload.orderId, status: 'processing' }
        });
      }, 800); // 模拟请求延迟
    });
  }
  
  return axios.post('/api/after-sale/apply', payload)
    .then(response => response.data);
}

// 获取售后统计数据接口
export function getAfterSaleStats(orderId: string): Promise<AfterSaleStats> {
  console.log('getAfterSaleStats', orderId);
  
  if (useMock) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          count: Math.floor(Math.random() * 5),
          updatedAt: new Date().toISOString()
        });
      }, 500);
    });
  }
  
  return axios.get(`/api/after-sale/stats?orderId=${orderId}`)
    .then(r => r.data);
}

// 提交退款申请接口
export function submitRefundRequest(request: RefundRequest): Promise<AfterSaleResponse> {
  console.log('submitRefundRequest', request);
  
  if (useMock) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          message: '退款申请提交成功',
          data: { 
            refundId: 'RF' + Date.now().toString().slice(-6),
            status: 'refund_submitted',
            amount: request.amount,
            method: request.method
          }
        });
      }, 1000);
    });
  }
  
  return axios.post('/api/after-sale/refund', request)
    .then(response => response.data);
}
