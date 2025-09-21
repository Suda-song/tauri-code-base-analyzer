<!-- 这是AfterSaleDashboard.vue文件是个售后中心页面 -->
<template>
    <div class="dashboard">
      <h1>售后中心</h1>
      <AfterSaleForm @submit="onSubmit" />
      <RefundRequestForm v-if="showRefund" @submit="onRefundSubmit" />
      <AfterSaleStatus :status="status" />
      <div v-if="responseMessage" class="response-message" :class="{ error: hasError }">
        {{ responseMessage }}
      </div>
    </div>
  </template>
  <script setup lang="ts">
  import { ref } from 'vue';
  import AfterSaleForm from '../components/AfterSaleForm.vue';
  import RefundRequestForm from '../components/RefundRequestForm.vue';
  import AfterSaleStatus from '../components/AfterSaleStatus.vue';
  import { submitAfterSale, submitRefundRequest } from '../api/afterSale';
  import AftersaleDa from '../components/AftersaleDa.tsx';
  import AftersaleDax from '../components/AftersaleDax.tsx';
  
  // 定义类型
  type SubmitData = { 
    orderId: string; 
    reason: string;
  };
  
  type RefundInfo = { 
    amount: number;
    method: string; 
  };
  
  const status = ref('idle');
  const showRefund = ref(false);
  const responseMessage = ref('');
  const hasError = ref(false);
  const currentOrderId = ref('');
  
  // 显示响应消息
  function showMessage(message: string, isError = false) {
    responseMessage.value = message;
    hasError.value = isError;
    
    // 3秒后自动清除消息
    setTimeout(() => {
      responseMessage.value = '';
    }, 3000);
  }
  
  // 提交售后申请
  async function onSubmit(data: SubmitData) {
    try {
      status.value = 'submitting'; // 添加一个提交中状态
      const response = await submitAfterSale(data);
      
      if (response.success) {
        status.value = 'processing';
        currentOrderId.value = data.orderId;
        showRefund.value = true;
        showMessage(response.message);
      } else {
        // 处理失败情况
        status.value = 'idle';
        showMessage(response.message || '提交失败，请重试', true);
      }
    } catch (error) {
      console.error('售后申请提交失败:', error);
      status.value = 'idle';
      showMessage('系统错误，请稍后重试', true);
    }
  }
  
  // 提交退款申请
  async function onRefundSubmit(info: RefundInfo) {
    try {
      status.value = 'submitting_refund'; // 添加一个退款提交中状态
      
      // 确保将当前订单ID附加到请求中
      const request = {
        ...info,
        orderId: currentOrderId.value
      };
      
      const response = await submitRefundRequest(request);
      
      if (response.success) {
        status.value = 'refund_submitted';
        showMessage(response.message);
      } else {
        // 处理失败情况
        showMessage(response.message || '退款申请失败，请重试', true);
      }
    } catch (error) {
      console.error('退款申请提交失败:', error);
      showMessage('系统错误，请稍后重试', true);
    }
  }
  </script>

  <style>
  .dashboard {
    padding: 20px;
  }

  .response-message {
    margin-top: 20px;
    padding: 10px;
    border-radius: 4px;
    background-color: #d4edda;
    color: #155724;
    font-weight: bold;
    text-align: center;
  }

  .response-message.error {
    background-color: #f8d7da;
    color: #721c24;
  }
  </style>