<script setup>
import { ref, onMounted, computed } from 'vue';
import anime from 'animejs/lib/anime.es.js';
import { useChatStore } from '../stores/useChatStore.js';

const store = useChatStore();
const inputValue = ref('');
const hasMessages = computed(() => (store.messages || []).length > 0);

onMounted(() => {
  anime({
    targets: '.fade-in',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: anime.stagger(100),
    easing: 'easeOutQuart',
  });
});

function sendMessage(message) {
  const text = message ?? inputValue.value.trim();
  if (!text) return;
  store.sendUserMessage(text);
  inputValue.value = '';
}

function clearChat() {
  store.clearChat();
}
</script>

<template>
  <div class="text-white bg-slate-900 min-h-screen">
    <nav class="glass-effect sticky top-0 z-40 backdrop-blur-md">
      <div class="container mx-auto px-6">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-8">
            <div class="text-gradient font-bold text-xl">智能基金分析工具</div>
            <div class="hidden md:flex space-x-6">
              <a href="index.html" class="nav-item text-gray-300 hover:text-white transition-colors">首页</a>
              <a href="analysis.html" class="nav-item text-gray-300 hover:text-white transition-colors">分析</a>
              <a href="alerts.html" class="nav-item text-gray-300 hover:text-white transition-colors">提醒</a>
              <a href="chat.html" class="nav-item text-white border-b-2 border-green-400">AI助手</a>
              <a href="reports.html" class="nav-item text-gray-300 hover:text-white transition-colors">报告</a>
              <a href="vue-demo.html" class="nav-item text-gray-300 hover:text-white transition-colors">Vue Demo</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button @click="clearChat" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors">清空对话</button>
          </div>
        </div>
      </div>
    </nav>

    <main class="container mx-auto px-6 py-8">
      <div class="mb-8 fade-in">
        <h1 class="text-3xl font-bold text-white mb-2">智能投资助手</h1>
        <p class="text-gray-400">专业的 AI 对话分析，为您提供个性化的投资建议和市场洞察</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-1">
          <div class="glass-effect rounded-xl p-6 mb-6 fade-in">
            <h3 class="text-lg font-semibold text-white mb-4">快速提问</h3>
            <div class="space-y-3">
              <button @click="sendMessage('分析我的持仓')" class="quick-action w-full text-left px-3 py-2 rounded-lg text-sm">
                分析我的持仓
              </button>
              <button @click="sendMessage('市场趋势如何')" class="quick-action w-full text-left px-3 py-2 rounded-lg text-sm">
                市场趋势如何
              </button>
              <button @click="sendMessage('推荐优质基金')" class="quick-action w-full text-left px-3 py-2 rounded-lg text-sm">
                推荐优质基金
              </button>
              <button @click="sendMessage('风险评估')" class="quick-action w-full text-left px-3 py-2 rounded-lg text-sm">风险评估</button>
              <button @click="sendMessage('止盈建议')" class="quick-action w-full text-left px-3 py-2 rounded-lg text-sm">止盈建议</button>
            </div>
          </div>

          <div class="glass-effect rounded-xl p-6 fade-in">
            <h3 class="text-lg font-semibold text-white mb-4">投资提示</h3>
            <div class="space-y-3">
              <div class="suggestion-card p-3">
                <div class="flex items-center mb-2">
                  <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  <span class="text-sm font-medium text-white">市场机会</span>
                </div>
                <p class="text-xs text-gray-400">新能源板块近期表现活跃，建议关注相关基金</p>
              </div>
              <div class="suggestion-card p-3">
                <div class="flex items-center mb-2">
                  <div class="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  <span class="text-sm font-medium text-white">风险提示</span>
                </div>
                <p class="text-xs text-gray-400">港股波动加大，建议适当控制仓位</p>
              </div>
              <div class="suggestion-card p-3">
                <div class="flex items-center mb-2">
                  <div class="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  <span class="text-sm font-medium text-white">配置建议</span>
                </div>
                <p class="text-xs text-gray-400">建议增加债券基金配置，平衡投资风险</p>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div class="glass-effect rounded-xl chat-container fade-in">
            <div id="chat-messages" class="chat-messages">
              <div v-if="!hasMessages" class="text-gray-400 text-sm">暂无对话，试着向 AI 提问市场或基金问题。</div>
              <div v-else v-for="msg in store.messages" :key="msg.id" class="message" :class="msg.sender">
                <div class="message-bubble" v-html="msg.text.replace(/\\n/g, '<br>')"></div>
              </div>
              <div v-if="store.typing" id="typing-indicator" class="typing-indicator">
                <span class="typing-dots"></span>
              </div>
            </div>

            <div class="p-4 border-t border-gray-700">
              <div class="flex items-center space-x-3 mb-3">
                <input
                  id="chat-input"
                  name="chatInput"
                  v-model="inputValue"
                  rows="2"
                  placeholder="请输入您的问题..."
                  class="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  @keyup.enter.prevent="sendMessage()"
                />
                <button @click="sendMessage()" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">发送</button>
              </div>
              <p class="text-xs text-gray-500">回车发送，Shift+回车换行</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-container {
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
.message {
  margin-bottom: 1rem;
  animation: fadeInUp 0.3s ease-out;
}
.message.user {
  text-align: right;
}
.message.ai {
  text-align: left;
}
.message-bubble {
  display: inline-block;
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  word-wrap: break-word;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
}
.message.user .message-bubble {
  background: linear-gradient(135deg, #00d4aa, #4a90e2);
  color: white;
}
.typing-indicator {
  display: block;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  color: #8892b0;
}
.typing-dots::after {
  content: '';
  animation: typing 1.5s infinite;
}
@keyframes typing {
  0%,
  20% {
    content: '';
  }
  40% {
    content: '.';
  }
  60% {
    content: '..';
  }
  80%,
  100% {
    content: '...';
  }
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.suggestion-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}
.suggestion-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  border-color: rgba(0, 212, 170, 0.3);
}
.quick-action {
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.3);
  color: #00d4aa;
  transition: all 0.3s ease;
}
.quick-action:hover {
  background: rgba(0, 212, 170, 0.2);
  transform: scale(1.05);
}
.glass-effect {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.text-gradient {
  background: linear-gradient(135deg, #00d4aa, #4a90e2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.nav-item {
  position: relative;
  transition: all 0.3s ease;
}
.nav-item:hover {
  color: #00d4aa;
}
.nav-item::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, #4a90e2);
  transition: width 0.3s ease;
}
.nav-item:hover::after {
  width: 100%;
}
</style>
