import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AnalysisPage from './analysis.vue';

const pinia = createPinia();
const app = createApp(AnalysisPage);
app.use(pinia);
app.mount('#app');
