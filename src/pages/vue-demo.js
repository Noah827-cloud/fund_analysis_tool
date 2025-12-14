import { createApp } from 'vue';
import VueDemo from './vue-demo.vue';
import { createPinia } from 'pinia';

const pinia = createPinia();
const app = createApp(VueDemo);

app.use(pinia);

// 挂载到页面中的特定元素
app.mount('#vue-demo-container');
