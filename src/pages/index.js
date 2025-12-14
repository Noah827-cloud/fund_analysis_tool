import { createApp } from 'vue';
import { createPinia } from 'pinia';
import IndexPage from './index.vue';

const pinia = createPinia();
const app = createApp(IndexPage);
app.use(pinia);
app.mount('#app');
