<script setup>
import { ref, onMounted } from 'vue';
import { useDashboardStore } from '../stores/useDashboardStore.js';
import { logger } from '../utils/logger.js';

const store = useDashboardStore();
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  loading.value = true;
  try {
    await store.load();
  } catch (e) {
    logger.error(e, { ctx: 'vue-demo load' });
    error.value = '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-4 text-white bg-slate-900 min-h-screen">
    <h1 class="text-2xl font-bold mb-4">Vue Demo（Pinia + DataService）</h1>
    <p class="text-sm text-gray-400 mb-4">验证 Pinia 数据流与 DataService/Mock</p>

    <div v-if="loading" class="text-gray-300">加载中...</div>
    <div v-else-if="error" class="text-red-400">{{ error }}</div>
    <div v-else-if="store.data" class="space-y-3">
      <div class="bg-slate-800/70 p-4 rounded">
        <p class="text-gray-400 text-sm">总资产</p>
        <p class="text-xl font-semibold">¥{{ store.data.totalAssets.toLocaleString() }}</p>
      </div>
      <div class="bg-slate-800/70 p-4 rounded">
        <p class="text-gray-400 text-sm">今日收益</p>
        <p class="text-xl font-semibold" :class="store.data.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'">
          ¥{{ store.data.todayProfit.toFixed(2) }}
        </p>
      </div>
      <button class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition" @click="() => store.refresh()">刷新数据</button>
    </div>
  </div>
</template>
