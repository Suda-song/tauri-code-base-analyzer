<!-- apps/ecommerce-after-sale/src/components/AfterSaleStatus.vue -->
<template>
  <div class="status-container">
    <h3>售后状态</h3>
    <div class="status-box" :class="statusClass">
      {{ statusMessage }}
    </div>
    <ReturnPolicyModal v-if="props.status === 'processing' && showPolicy" @close="hidePolicy" />
  </div>
</template>

<script lang="ts" setup>
/**
 * 售后状态展示组件
 * 根据不同状态显示对应的消息和样式
 * 在处理中状态时可展示退货政策弹窗
 */
import { computed, ref } from 'vue';
import ReturnPolicyModal from '../components/ReturnPolicyModal.vue';

// 控制政策弹窗显示
const showPolicy = ref(true);

function hidePolicy() {
  showPolicy.value = false;
}

// 定义props
const props = defineProps<{ 
  status: string 
}>();

// 计算status的显示消息
const statusMessage = computed(() => {
  switch (props.status) {
    case 'idle':
      return '请提交您的售后申请';
    case 'submitting':
      return '正在提交您的售后申请...';
    case 'processing':
      return '正在处理您的售后申请';
    case 'submitting_refund':
      return '正在提交您的退款申请...';
    case 'refund_submitted':
      return '退款申请已提交，请等待处理';
    case 'refund_approved':
      return '退款已批准，资金将在1-3个工作日内到账';
    case 'completed':
      return '售后服务已完成';
    default:
      return '未知状态';
  }
});

// 计算状态的样式class
const statusClass = computed(() => {
  switch (props.status) {
    case 'idle':
      return 'idle';
    case 'submitting':
    case 'submitting_refund':
      return 'loading';
    case 'processing':
      return 'processing';
    case 'refund_submitted':
      return 'pending';
    case 'refund_approved':
    case 'completed':
      return 'success';
    default:
      return '';
  }
});
</script>

<style scoped>
.status-container {
  margin: 20px 0;
}
.status-box {
  padding: 15px;
  border-radius: 4px;
  text-align: center;
  font-weight: bold;
}
.idle {
  background-color: #e0e0e0;
  color: #555;
}
.loading {
  background-color: #e6f7ff;
  color: #1890ff;
  animation: pulse 1.5s infinite;
}
.processing {
  background-color: #fff3cd;
  color: #856404;
}
.pending {
  background-color: #cce5ff;
  color: #004085;
}
.success {
  background-color: #d4edda;
  color: #155724;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}
</style>
  