<!-- 这是ToastContent.vue文件是个通知提示内容 -->
<template>
  <div class="toast" :class="type">
    {{ message }}
  </div>
</template>

<script lang="ts" setup>
// 定义 props
defineProps<{
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}>();
</script>

<style scoped>
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  border-radius: 4px;
  color: white;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

.success {
  background-color: #4caf50;
}

.error {
  background-color: #f44336;
}

.warning {
  background-color: #ff9800;
}

.info {
  background-color: #2196f3;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 