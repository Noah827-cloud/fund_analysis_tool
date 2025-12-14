<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import echarts from '../charts/echarts.js';
import anime from 'animejs/lib/anime.es.js';
import { useAnalysisStore } from '../stores/useAnalysisStore.js';

const store = useAnalysisStore();
const activeTab = ref(store.activeTab);
const activeFund = ref(store.activeFund);
const toast = ref('');
let toastTimer = null;
const loading = ref(false);
const error = ref(null);
const hasData = computed(() => !error.value && !!store.series?.dates?.length);

function consumePrefillFund() {
  try {
    const raw = localStorage.getItem('ui:analysis:selectedFund');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    try {
      localStorage.removeItem('ui:analysis:selectedFund');
    } catch {}
  }
}

onMounted(async () => {
  const prefill = consumePrefillFund();
  const desiredCode = prefill?.fundCode || activeFund.value;
  activeFund.value = desiredCode;

  await store.setFund(desiredCode);
  activeFund.value = store.activeFund;
  if (store.error) {
    console.error('load analysis data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  anime({
    targets: '.fade-in',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: anime.stagger(100),
    easing: 'easeOutQuart',
  });
  await nextTick();
  await initCharts();
});

function setTab(tab) {
  store.setTab(tab);
  activeTab.value = store.activeTab;
  nextTick().then(() => initCharts());
}

async function onFundChange(event) {
  const code = event.target.value;
  await store.setFund(code);
  activeFund.value = store.activeFund;
  if (store.error) {
    console.error('load analysis data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  await nextTick();
  await initCharts();
}

function showToast(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 2000);
}

async function runAnalysis() {
  await store.load({ fundCode: store.activeFund, force: true });
  if (store.error) {
    console.error('load analysis data failed', store.error);
    error.value = '数据加载失败，请稍后重试';
    return;
  }
  showToast('分析完成');
  await nextTick();
  await initCharts();
}

function exportAnalysis() {
  showToast('分析报告导出功能开发中...');
}

async function initCharts() {
  loading.value = true;
  error.value = null;
  try {
    renderChart('performance-chart', buildPerformanceOption);
    renderChart('return-chart', buildReturnOption);
    renderChart('drawdown-chart', buildDrawdownOption);
    renderChart('asset-allocation-detail', buildAssetAllocationOption);
    renderChart('industry-allocation', buildIndustryOption);
    renderChart('comparison-chart', buildComparisonOption);
  } catch (e) {
    console.error('render analysis charts failed', e);
    error.value = '图表渲染失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function renderChart(domId, optionBuilder) {
  const dom = document.getElementById(domId);
  if (!dom) return;
  if (dom.offsetWidth === 0 || dom.offsetHeight === 0) {
    setTimeout(() => renderChart(domId, optionBuilder), 150);
    return;
  }
  const existing = echarts.getInstanceByDom(dom);
  if (existing) existing.dispose();
  const chart = echarts.init(dom);
  chart.setOption(optionBuilder());
}

function buildPerformanceOption() {
  const s = store.series || {};
  const dates = s.dates || [];
  const fundReturns = s.fundCumulative || [];
  const benchmarkReturns = s.benchmarkCumulative || [];
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${Number(val).toFixed(2)}%`,
    },
    legend: { data: ['基金收益', '基准收益'], textStyle: { color: '#fff' } },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8892b0', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: '基金收益',
        type: 'line',
        data: fundReturns,
        smooth: true,
        lineStyle: { color: '#00d4aa', width: 2 },
        itemStyle: { color: '#00d4aa' },
      },
      {
        name: '基准收益',
        type: 'line',
        data: benchmarkReturns,
        smooth: true,
        lineStyle: { color: '#4a90e2', width: 2 },
        itemStyle: { color: '#4a90e2' },
      },
    ],
  };
}

function buildReturnOption() {
  const s = store.series || {};
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const returns = s.monthlyReturns || months.map(() => 0);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${Number(val).toFixed(2)}%`,
    },
    xAxis: { type: 'category', data: months, axisLabel: { color: '#8892b0' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        data: returns,
        type: 'bar',
        itemStyle: {
          color: function (params) {
            return params.value >= 0 ? '#00d4aa' : '#ff6b6b';
          },
        },
      },
    ],
  };
}

function buildDrawdownOption() {
  const s = store.series || {};
  const dates = s.dates || [];
  const drawdowns = s.drawdowns || [];
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${Number(val).toFixed(2)}%`,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8892b0', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        data: drawdowns,
        type: 'line',
        smooth: true,
        lineStyle: { color: '#ff6b6b', width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 107, 107, 0.3)' },
            { offset: 1, color: 'rgba(255, 107, 107, 0.05)' },
          ]),
        },
        itemStyle: { color: '#ff6b6b' },
      },
    ],
  };
}

function buildAssetAllocationOption() {
  const seed = store.getSeed();
  const aa = { stock: 40 + seed * 3, bond: 25 - seed, cash: 15, other: 20 - seed * 2 };
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      formatter: '{b}: {d}%',
    },
    series: [
      {
        type: 'pie',
        radius: ['30%', '70%'],
        center: ['50%', '50%'],
        data: [
          { value: aa.stock, name: '股票', itemStyle: { color: '#00d4aa' } },
          { value: aa.bond, name: '债券', itemStyle: { color: '#4a90e2' } },
          { value: aa.cash, name: '货币', itemStyle: { color: '#f5a623' } },
          { value: aa.other, name: '其他', itemStyle: { color: '#9b59b6' } },
        ],
        label: {
          color: '#fff',
          fontSize: 12,
          formatter: '{b|{b}}\n{d|{d}%}',
          rich: {
            b: { fontSize: 12, color: '#fff', lineHeight: 16 },
            d: { fontSize: 12, color: '#c8d4ff', lineHeight: 16 },
          },
          overflow: 'truncate',
          width: 80,
        },
        labelLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' }, length: 12, length2: 10 },
      },
    ],
  };
}

function buildIndustryOption() {
  const seed = store.getSeed();
  const dist = { 科技: 20 + seed * 2, 金融: 18 + seed, 消费: 16, 医药: 14, 能源: 12 + seed, 房地产: 10 - seed };
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)', textStyle: { color: '#fff' } },
    xAxis: {
      type: 'category',
      data: Object.keys(dist),
      axisLabel: { color: '#8892b0' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        data: Object.values(dist),
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4aa' },
            { offset: 1, color: '#4a90e2' },
          ]),
        },
      },
    ],
  };
}

function buildComparisonOption() {
  const seed = store.getSeed();
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)', textStyle: { color: '#fff' } },
    legend: { data: ['本基金', '同类平均', '基准指数'], textStyle: { color: '#fff' } },
    xAxis: {
      type: 'category',
      data: ['1个月', '3个月', '6个月', '1年', '3年'],
      axisLabel: { color: '#8892b0' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: '本基金',
        type: 'bar',
        data: [3.2 + seed, 8.9 + seed * 1.5, 15.7 + seed * 2, 12.3 + seed * 2.5, 45.6 + seed * 3],
        itemStyle: { color: '#00d4aa' },
      },
      {
        name: '同类平均',
        type: 'bar',
        data: [2.1 + seed * 0.8, 6.5 + seed, 12.3 + seed * 1.5, 9.8 + seed * 2, 38.2 + seed * 2.2],
        itemStyle: { color: '#4a90e2' },
      },
      {
        name: '基准指数',
        type: 'bar',
        data: [1.8 + seed * 0.6, 5.9 + seed * 0.9, 10.8 + seed * 1.2, 8.8 + seed * 1.5, 35.1 + seed * 1.8],
        itemStyle: { color: '#f5a623' },
      },
    ],
  };
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
              <a href="analysis.html" class="nav-item text-white border-b-2 border-green-400">分析</a>
              <a href="alerts.html" class="nav-item text-gray-300 hover:text-white transition-colors">提醒</a>
              <a href="chat.html" class="nav-item text-gray-300 hover:text-white transition-colors">AI助手</a>
              <a href="reports.html" class="nav-item text-gray-300 hover:text-white transition-colors">报告</a>
              <a href="vue-demo.html" class="nav-item text-gray-300 hover:text-white transition-colors">Vue Demo</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button @click="runAnalysis" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">开始分析</button>
            <button @click="exportAnalysis" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">导出分析</button>
          </div>
        </div>
      </div>
    </nav>

    <main class="container mx-auto px-6 py-8 space-y-6">
      <div class="glass-effect rounded-xl p-6 fade-in">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">基金深度分析</h1>
            <p class="text-gray-400">专业的基金分析工具，助您做出明智的投资决策</p>
          </div>
          <div class="flex items-center gap-3">
            <select class="bg-gray-800 text-white rounded px-3 py-2 text-sm" :value="activeFund" @change="onFundChange">
              <option v-for="f in store.funds" :key="f.code" :value="f.code">{{ f.name }}</option>
            </select>
            <select class="bg-gray-800 text-white rounded px-3 py-2 text-sm">
              <option>近1年</option>
              <option>近3年</option>
              <option>成立以来</option>
            </select>
            <select class="bg-gray-800 text-white rounded px-3 py-2 text-sm">
              <option>平衡型</option>
              <option>进取型</option>
              <option>保守型</option>
            </select>
          </div>
        </div>
      </div>

      <div class="glass-effect rounded-xl mb-4 fade-in">
        <div class="border-b border-gray-700">
          <nav class="flex space-x-6 px-6">
            <button
              v-for="tab in ['overview', 'performance', 'risk', 'portfolio', 'comparison']"
              :key="tab"
              class="tab-button py-4 px-2 text-sm font-medium"
              :class="activeTab === tab ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400'"
              @click="setTab(tab)"
            >
              {{
                tab === 'overview'
                  ? '概览'
                  : tab === 'performance'
                    ? '业绩分析'
                    : tab === 'risk'
                      ? '风险评估'
                      : tab === 'portfolio'
                        ? '持仓分析'
                        : '对比分析'
              }}
            </button>
          </nav>
        </div>

        <div class="p-6 space-y-6">
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div v-for="item in store.overviewMetrics" :key="item.label" class="metric-card rounded-lg p-4">
                <h3 class="text-gray-400 text-sm mb-2">{{ item.label }}</h3>
                <p class="text-2xl font-bold text-white">{{ item.value }}</p>
                <p class="text-sm" :class="item.deltaClass">{{ item.delta }}</p>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">业绩表现</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="performance-chart" class="h-64"></div>
              </div>
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">收益走势图</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="return-chart" class="h-64"></div>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">历史回撤分析</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="drawdown-chart" class="h-64"></div>
              </div>
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">资产配置</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="asset-allocation-detail" class="h-64"></div>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">行业分布</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="industry-allocation" class="h-64"></div>
              </div>
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">同类对比</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
                <div v-else id="comparison-chart" class="h-64"></div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'performance'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">业绩表现</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="performance-chart" class="h-64"></div>
            </div>
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">收益走势图</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="return-chart" class="h-64"></div>
            </div>
          </div>

          <div v-if="activeTab === 'risk'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">历史回撤分析</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="drawdown-chart" class="h-64"></div>
            </div>
          </div>

          <div v-if="activeTab === 'portfolio'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">资产配置</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="asset-allocation-detail" class="h-64"></div>
            </div>
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">行业分布</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="industry-allocation" class="h-64"></div>
            </div>
          </div>

          <div v-if="activeTab === 'comparison'" class="analysis-card p-6">
            <h3 class="text-lg font-semibold text-white mb-4">同类对比</h3>
            <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
            <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
            <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
            <div v-else id="comparison-chart" class="h-80"></div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
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
.analysis-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}
.analysis-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}
.metric-card {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.1), rgba(74, 144, 226, 0.1));
  border: 1px solid rgba(0, 212, 170, 0.3);
}
.tab-button {
  transition: all 0.3s ease;
  border-bottom: 2px solid transparent;
}
.risk-low {
  color: #10b981;
}
.risk-medium {
  color: #f59e0b;
}
.risk-high {
  color: #ef4444;
}
</style>
