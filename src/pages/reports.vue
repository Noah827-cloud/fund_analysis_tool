<script setup>
import { onMounted, nextTick, computed, ref } from 'vue';
import echarts from '../charts/echarts.js';
import anime from 'animejs/lib/anime.es.js';
import { useReportsStore } from '../stores/useReportsStore.js';

const store = useReportsStore();
const toast = ref('');
const toastTimer = ref(null);
const loading = ref(false);
const error = ref(null);
const hasData = computed(() => !error.value && !!store.series?.dates?.length);

onMounted(async () => {
  anime({
    targets: '.fade-in',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: anime.stagger(100),
    easing: 'easeOutQuart',
  });
  const today = new Date();
  if (!store.dateStr) store.setDate(today.toISOString().split('T')[0]);
  await store.load({ period: store.period, date: store.dateStr });
  if (store.error) {
    console.error('load reports data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  await nextTick();
  await initCharts();
});

async function setPeriod(p) {
  await store.setPeriod(p);
  if (store.error) {
    console.error('load reports data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  showToast(`${p === 'week' ? '周度' : p === 'month' ? '月度' : p === 'quarter' ? '季度' : '年度'}报告已更新`);
  await nextTick();
  await initCharts();
}

async function generateReport() {
  if (!store.dateStr) {
    showToast('请选择报告日期');
    return;
  }
  await store.load({ period: store.period, date: store.dateStr, force: true });
  if (store.error) {
    console.error('load reports data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  showToast('报告生成完成');
  await nextTick();
  await initCharts();
}

function exportReport() {
  showToast('报告导出功能开发中...');
}

function showToast(message) {
  toast.value = message;
  clearTimeout(toastTimer.value);
  toastTimer.value = setTimeout(() => {
    toast.value = '';
  }, 3000);
}

async function initCharts() {
  loading.value = true;
  error.value = null;
  try {
    renderProfitAnalysis();
    renderHoldingChange();
  } catch (e) {
    console.error('render reports charts failed', e);
    error.value = '图表渲染失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function renderProfitAnalysis() {
  const dom = document.getElementById('profit-analysis-chart');
  if (!dom) return;
  const chart = echarts.getInstanceByDom(dom) || echarts.init(dom);

  const series = store.getSeries();
  const dates = series.dates;
  const dailyReturns = series.dailyReturns;
  const cumulativeReturns = series.cumulativeReturns;
  const periodLabel = { week: '日收益', month: '周收益', quarter: '月收益', year: '季度收益' }[store.period] || '收益';
  const cumulativeLabel =
    { week: '累计日收益', month: '累计周收益', quarter: '累计月收益', year: '累计季度收益' }[store.period] || '累计收益';

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${val.toFixed(2)}%`,
    },
    legend: { data: [periodLabel, cumulativeLabel], textStyle: { color: '#fff' } },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#8892b0' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: periodLabel,
        type: 'bar',
        data: dailyReturns,
        itemStyle: {
          color: function (params) {
            return params.value >= 0 ? '#00d4aa' : '#ff6b6b';
          },
        },
      },
      {
        name: cumulativeLabel,
        type: 'line',
        data: cumulativeReturns,
        smooth: true,
        lineStyle: { color: '#4a90e2', width: 2 },
        itemStyle: { color: '#4a90e2' },
      },
    ],
  });
}

function renderHoldingChange() {
  const dom = document.getElementById('holding-change-chart');
  if (!dom) return;
  const chart = echarts.getInstanceByDom(dom) || echarts.init(dom);

  const series = store.getSeries();
  const funds = series.funds || [];
  const startValues = series.holdingsStart;
  const endValues = series.holdingsEnd;

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)', textStyle: { color: '#fff' } },
    legend: { data: ['期初', '期末'], textStyle: { color: '#fff' } },
    xAxis: {
      type: 'category',
      data: funds,
      axisLabel: { color: '#8892b0', rotate: 45 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '¥{value}' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      { name: '期初', type: 'bar', data: startValues, itemStyle: { color: '#4a90e2' } },
      { name: '期末', type: 'bar', data: endValues, itemStyle: { color: '#00d4aa' } },
    ],
  });
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
              <a href="chat.html" class="nav-item text-gray-300 hover:text-white transition-colors">AI助手</a>
              <a href="reports.html" class="nav-item text-white border-b-2 border-green-400">报告</a>
              <a href="vue-demo.html" class="nav-item text-gray-300 hover:text-white transition-colors">Vue Demo</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button
              id="report-generate-btn"
              @click="generateReport"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              生成报告
            </button>
            <button @click="exportReport" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">导出报告</button>
          </div>
        </div>
      </div>
    </nav>

    <main class="container mx-auto px-6 py-8 space-y-6">
      <div class="glass-effect p-6 rounded-xl fade-in">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-white mb-1">总结报告</h1>
            <p class="text-gray-400 text-sm">选择周期与日期，查看收益归因与持仓变化</p>
          </div>
          <div class="flex items-center gap-3">
            <input
              :value="store.dateStr"
              @input="store.setDate($event.target.value)"
              id="report-date"
              type="date"
              class="bg-gray-800 text-white rounded px-3 py-2 text-sm"
            />
            <div class="flex space-x-2">
              <button
                v-for="p in ['week', 'month', 'quarter', 'year']"
                :key="p"
                class="tab-button py-2 px-3 rounded text-sm"
                :class="store.period === p ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400'"
                @click="setPeriod(p)"
              >
                {{ p === 'week' ? '周度' : p === 'month' ? '月度' : p === 'quarter' ? '季度' : '年度' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="metric-highlight rounded p-4 glass-effect">
          <p class="text-gray-400 text-sm">收益</p>
          <p class="text-xl font-bold text-white">{{ store.metrics.profit }}</p>
          <p class="text-sm text-green-400">{{ store.metrics.profitRate }}</p>
        </div>
        <div class="metric-highlight rounded p-4 glass-effect">
          <p class="text-gray-400 text-sm">年化收益</p>
          <p class="text-xl font-bold text-white">{{ store.metrics.annualReturn }}</p>
          <p class="text-sm text-green-400">稳健</p>
        </div>
        <div class="metric-highlight rounded p-4 glass-effect">
          <p class="text-gray-400 text-sm">最大回撤</p>
          <p class="text-xl font-bold text-white">{{ store.metrics.maxDrawdown }}</p>
          <p class="text-sm text-yellow-400">可接受</p>
        </div>
        <div class="metric-highlight rounded p-4 glass-effect">
          <p class="text-gray-400 text-sm">夏普比率</p>
          <p class="text-xl font-bold text-white">{{ store.metrics.sharpeRatio }}</p>
          <p class="text-sm text-green-400">风险调整收益良好</p>
        </div>
      </div>

      <div class="glass-effect p-6 rounded-xl fade-in">
        <h3 class="text-lg font-semibold text-white mb-4">收益归因</h3>
        <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
        <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
        <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
        <div v-else id="profit-analysis-chart" class="h-64"></div>
      </div>

      <div class="glass-effect p-6 rounded-xl fade-in">
        <h3 class="text-lg font-semibold text-white mb-4">持仓变化</h3>
        <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
        <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
        <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
        <div v-else id="holding-change-chart" class="h-64"></div>
      </div>
    </main>

    <footer class="glass-effect mt-16 py-8">
      <div class="container mx-auto px-6 text-center text-gray-400">
        <p>© 2025 智能基金分析工具 - 专业的基金投资分析平台</p>
      </div>
    </footer>

    <div v-if="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
.tab-button {
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}
.metric-highlight {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.1), rgba(74, 144, 226, 0.1));
  border: 1px solid rgba(0, 212, 170, 0.3);
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
