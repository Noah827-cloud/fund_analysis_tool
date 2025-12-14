import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ChatPage from './chat.vue';

const pinia = createPinia();
const app = createApp(ChatPage);
app.use(pinia);
app.mount('#app');
