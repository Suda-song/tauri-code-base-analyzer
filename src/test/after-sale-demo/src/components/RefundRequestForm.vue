<!-- apps/ecommerce-after-sale/src/components/RefundRequestForm.vue -->
<!-- 这是RefundRequestForm.vue文件是个退款申请表单 -->
<template>
  <form @submit.prevent="handleRefund">
    <h3>退款申请</h3>
    <div>
      <label for="amount">退款金额</label>
      <input id="amount" type="number" v-model.number="formData.amount" required />
    </div>
    <div>
      <label for="method">退款方式</label>
      <select id="method" v-model="formData.method" required>
        <option value="原路返回">原路返回</option>
        <option value="退到余额">退到余额</option>
      </select>
    </div>
    <button type="submit">提交退款申请</button>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

// 定义表单数据类型
type RefundData = {
  amount: number;
  method: string;
};

const emit = defineEmits<{
  (e: 'submit', info: RefundData): void
}>();

const formData = reactive<RefundData>({
  amount: 0,
  method: '原路返回'
});

function handleRefund() {
  emit('submit', formData);
}
</script>

<style scoped>
form {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #f9f9f9;
}
h3 {
  margin-top: 0;
  color: #333;
}
form div {
  margin-bottom: 15px;
}
label {
  display: block;
  margin-bottom: 5px;
}
input, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 8px 16px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
  