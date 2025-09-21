
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';        // 你在 router/index.ts 里导出的路由实例
import { createPinia } from 'pinia';      // 如果你用 Pinia 做全局状态管理

// 1. 创建应用实例
const app = createApp(App);

// 2. 安装插件
app.use(createPinia());
app.use(router);

// 3. 挂载到页面上的 <div id="app"></div>
app.mount('#app');
