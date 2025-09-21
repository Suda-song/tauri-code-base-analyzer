<!-- apps/ecommerce-after-sale/src/components/AfterSaleForm.vue -->
<template>
  <!-- 这是AfterSaleForm.vue文件是个售后申请表单 -->
  <form @submit.prevent="handle">
    <!-- 飒飒飒 -->
    <div>
      <label for="orderId">订单号</label>
      <input id="orderId" v-model="formData.orderId" required />
    </div>
    <div>
      <label for="reason">申请原因</label>
      <select id="reason" v-model="formData.reason" required>
        <option value="产品损坏">产品损坏</option>
        <option value="不符合期望">不符合期望</option>
        <option value="其他">其他</option>
      </select>
    </div>
    <button type="submit">申请售后</button>
  </form>
</template>

<script lang="ts" setup>
import { reactive } from 'vue';

// 定义表单数据类型
type SubmitData = {
  orderId: string;
  reason: string;
};

// 使用类型标注
const emit = defineEmits<{
  (e: 'submit', payload: SubmitData): void
}>();

const formData = reactive<SubmitData>({
  orderId: '',
  reason: '产品损坏'
});

function handle() {
  emit('submit', formData);
}
</script>

<style scoped>
form {
  margin: 20px 0;
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
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
  