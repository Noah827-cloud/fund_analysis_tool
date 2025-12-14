import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AlertsPage from './alerts.vue';

const pinia = createPinia();
const app = createApp(AlertsPage);
app.use(pinia);
app.mount('#app');
