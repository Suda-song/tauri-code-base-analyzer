// apps/ecommerce-after-sale/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import AfterSaleDashboard from '@/pages/AfterSaleDashboard.vue';

const routes = [
  { path: '/after-sale', component: AfterSaleDashboard }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});
