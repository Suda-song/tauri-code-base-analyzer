// apps/ecommerce-after-sale/src/stores/afterSale.ts
import { defineStore } from 'pinia';
import { submitAfterSale, getAfterSaleStats } from '@/api/afterSale';

// 定义一个状态管理器，用于管理售后申请的状态和统计信息
export const useAfterSaleStore = defineStore('afterSale', {
  state: () => ({
    status: '' as string,
    stats: { count: 0, updatedAt: '' } as { count: number; updatedAt: string }
  }),
  actions: {
    async applyAfterSale(data: any) {
      this.status = 'processing';
      await submitAfterSale(data);
      this.status = 'completed';
      this.stats = await getAfterSaleStats(data.orderId);
    }
  }
});
