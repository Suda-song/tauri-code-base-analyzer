<!-- apps/ecommerce-after-sale/src/components/ReturnPolicyModal.vue -->
<!-- 这是ReturnPolicyModal.vue文件是个退货政策弹窗 -->
<template>
  <div class="modal" v-if="isVisible">
    <div class="modal-content">
      <h2>退货政策</h2>
      <p>产品在 7 天内可退，需保持原包装。</p>
      <p>15天内可换货，需支付运费。</p>
      <button @click="closeModal">我知道了</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void
}>();

const isVisible = ref(true);

function closeModal() {
  isVisible.value = false;
  emit('close');
}
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  max-width: 500px;
  width: 90%;
}

h2 {
  margin-top: 0;
  color: #333;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}
</style>
  