import { ref, watch } from 'vue';
import { getAfterSaleStats } from '@/api/afterSale';
import dayjs from 'dayjs';

// 定义一个售后统计钩子，用于获取售后统计信息
export function useAfterSaleMetrics(orderId: string) {
  const stats = ref({ count: 0, lastUpdate: '' });
  async function fetch() {
    const res = await getAfterSaleStats(orderId);
    stats.value = {
      count: res.count,
      lastUpdate: dayjs(res.updatedAt).format('YYYY-MM-DD HH:mm')
    };
  }
  watch(() => orderId, fetch, { immediate: true });
  return { stats, refresh: fetch };
}