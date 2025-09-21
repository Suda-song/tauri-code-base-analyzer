// apps/ecommerce-after-sale/src/components/NotificationToast.tsx
import { h, Fragment } from 'vue';
import ToastContent from './ToastContent.vue';

// 定义一个通知提示组件，用于显示通知消息
export default () => {
  // 定义一个通知提示组件，用于显示通知消息
  return h(Fragment, null, [
    h(ToastContent, { message: '提交成功', type: 'success' })
  ]);
};
