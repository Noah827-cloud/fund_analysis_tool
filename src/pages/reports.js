import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ReportsPage from './reports.vue';

const pinia = createPinia();
const app = createApp(ReportsPage);
app.use(pinia);
app.mount('#app');
