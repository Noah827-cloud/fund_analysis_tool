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
const hasIndustryData = computed(() => Array.isArray(store.industryConfig?.industries) && store.industryConfig.industries.length > 0);
const industryAsOfDate = computed(() => String(store.industryConfig?.asOfDate || '').trim());
const hasAssetAllocationData = computed(() => Array.isArray(store.assetAllocation?.quarters) && store.assetAllocation.quarters.length > 0);
const assetAsOfDate = computed(() => String(store.assetAllocation?.asOfDate || '').trim());
const latestAssetQuarter = computed(() =>
  hasAssetAllocationData.value ? store.assetAllocation.quarters[store.assetAllocation.quarters.length - 1] : null
);
const prevAssetQuarter = computed(() =>
  Array.isArray(store.assetAllocation?.quarters) && store.assetAllocation.quarters.length > 1
    ? store.assetAllocation.quarters[store.assetAllocation.quarters.length - 2]
    : null
);

const currentTopHoldings = computed(() => store.topHoldingsComparison?.current?.holdings || []);
const hasTopHoldings = computed(() => Array.isArray(currentTopHoldings.value) && currentTopHoldings.value.length > 0);
const topHoldingsAsOfDate = computed(() => String(store.topHoldingsComparison?.current?.asOfDate || '').trim());
const prevTopHoldingsAsOfDate = computed(() => String(store.topHoldingsComparison?.previous?.asOfDate || '').trim());
const topHoldingsChanges = computed(() => store.topHoldingsComparison?.changes || { added: [], removed: [], changed: [] });

const hasGrandTotal = computed(
  () => Array.isArray(store.grandTotal?.series) && store.grandTotal.series.some((s) => Array.isArray(s?.points) && s.points.length)
);
const grandTotalRangeText = computed(() => {
  const start = String(store.grandTotal?.startDate || '').trim();
  const end = String(store.grandTotal?.endDate || '').trim();
  if (!start || !end) return '';
  return `${start} ~ ${end}`;
});

function fmtPctPlain(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  return `${num.toFixed(2)}%`;
}

function fmtPctSigned(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function fmtNum2(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(2);
}

function sum(arr) {
  return (arr || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function stddev(arr) {
  const list = (arr || []).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!list.length) return 0;
  const mean = sum(list) / list.length;
  const variance = sum(list.map((v) => Math.pow(v - mean, 2))) / list.length;
  return Math.sqrt(variance);
}

function computeReturnMetricsFromPctPoints(points) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) {
    return { cumulativeReturnPct: null, volatilityPct: null, sharpeRatio: null, maxDrawdownPct: null };
  }

  const idxValues = list.map((p) => 1 + (Number(p?.valuePct) || 0) / 100).filter((v) => Number.isFinite(v) && v > 0);
  if (idxValues.length < 2) {
    return { cumulativeReturnPct: null, volatilityPct: null, sharpeRatio: null, maxDrawdownPct: null };
  }

  const dailyReturns = [];
  for (let i = 1; i < idxValues.length; i++) {
    const prev = idxValues[i - 1];
    const curr = idxValues[i];
    if (!prev || !curr) continue;
    dailyReturns.push(curr / prev - 1);
  }

  const sd = stddev(dailyReturns);
  const mean = dailyReturns.length ? sum(dailyReturns) / dailyReturns.length : 0;
  const sharpeRatio = sd === 0 ? null : (mean / sd) * Math.sqrt(252);
  const volatilityPct = sd * Math.sqrt(252) * 100;

  let peak = idxValues[0];
  let mdd = 0;
  for (const v of idxValues) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? v / peak - 1 : 0;
    if (dd < mdd) mdd = dd;
  }

  const last = list[list.length - 1];
  const cumulativeReturnPct = Number(last?.valuePct);

  return {
    cumulativeReturnPct: Number.isFinite(cumulativeReturnPct) ? cumulativeReturnPct : null,
    volatilityPct: Number.isFinite(volatilityPct) ? volatilityPct : null,
    sharpeRatio: Number.isFinite(sharpeRatio) ? sharpeRatio : null,
    maxDrawdownPct: Number.isFinite(mdd) ? mdd * 100 : null,
  };
}

const grandTotalSummary = computed(() => {
  const series = Array.isArray(store.grandTotal?.series) ? store.grandTotal.series : [];
  return series
    .map((s) => {
      const points = Array.isArray(s?.points) ? s.points : [];
      const metrics = computeReturnMetricsFromPctPoints(points);
      return { name: String(s?.name || '').trim(), metrics };
    })
    .filter((row) => row.name);
});

function displayGrandTotalName(raw) {
  const name = String(raw || '').trim();
  if (!name) return '';
  if (name.includes('同类平均')) return '同类平均';
  if (name.includes('沪深') || name.includes('中证') || name.includes('标普') || name.includes('纳斯达克')) return `基准指数（${name}）`;
  return '本基金';
}

function classifyRisk(metrics) {
  const volatility = Number(metrics?.volatilityPct);
  const maxDrawdownAbs = Math.abs(Number(metrics?.maxDrawdownPct) || 0);
  if (!Number.isFinite(volatility)) {
    return { level: '—', css: 'text-gray-400', hint: '缺少波动率数据' };
  }

  if (volatility <= 12 && maxDrawdownAbs <= 6) return { level: '低', css: 'risk-low', hint: '波动与回撤较低' };
  if (volatility <= 20 && maxDrawdownAbs <= 12) return { level: '中', css: 'risk-medium', hint: '波动/回撤中等' };
  return { level: '高', css: 'risk-high', hint: '波动或回撤偏高' };
}

const riskSnapshot = computed(() => {
  const m = store.metricsRaw || {};
  const risk = classifyRisk(m);

  const recoveryDays = m?.maxDrawdownRecoveryDays;
  const recoveryText = recoveryDays == null ? '未修复' : `${Number(recoveryDays)} 天`;

  const rank = m?.similarRank;
  const total = m?.similarTotal;
  const rankText = rank != null && total != null ? `${rank}/${total}` : '—';
  const percentileText = m?.similarPercentile == null ? '—' : `${Number(m.similarPercentile).toFixed(2)}%`;

  return {
    risk,
    volatilityText: fmtPctPlain(m?.volatilityPct),
    maxDrawdownText: fmtPctPlain(m?.maxDrawdownPct),
    recoveryText,
    sharpeText: m?.sharpeRatio == null ? '—' : Number(m.sharpeRatio).toFixed(2),
    rankText,
    percentileText,
  };
});

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
  const latest = latestAssetQuarter.value;
  const aa = latest
    ? {
        stock: Number(latest.stockPct) || 0,
        bond: Number(latest.bondPct) || 0,
        cash: Number(latest.cashPct) || 0,
        other: Number(latest.otherPct) || 0,
      }
    : { stock: 0, bond: 0, cash: 0, other: 0 };
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      formatter: ({ name, value }) => `${name}: ${Number(value).toFixed(2)}%`,
    },
    series: [
      {
        type: 'pie',
        radius: ['30%', '70%'],
        center: ['50%', '50%'],
        data: [
          { value: aa.stock, name: '股票', itemStyle: { color: '#00d4aa' } },
          { value: aa.bond, name: '债券', itemStyle: { color: '#4a90e2' } },
          { value: aa.cash, name: '现金', itemStyle: { color: '#f5a623' } },
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
  const items = Array.isArray(store.industryConfig?.industries) ? store.industryConfig.industries : [];
  const top = items.slice(0, 10);
  const rows = top
    .map((i) => ({ name: String(i?.name || '').trim(), pct: Number(i?.pct) || 0 }))
    .filter((i) => i.name)
    .sort((a, b) => b.pct - a.pct);

  const names = rows.map((r) => r.name).reverse();
  const values = rows.map((r) => r.pct).reverse();
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${Number(val).toFixed(2)}%`,
    },
    grid: { left: 150, right: 24, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: '#8892b0',
        width: 130,
        overflow: 'truncate',
        formatter: (val) => String(val || '').replace(/\s+/g, ' '),
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [
      {
        data: values,
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4aa' },
            { offset: 1, color: '#4a90e2' },
          ]),
        },
        label: { show: true, position: 'right', color: '#c8d4ff', formatter: ({ value }) => `${Number(value).toFixed(2)}%` },
      },
    ],
  };
}

function buildComparisonOption() {
  const seriesList = Array.isArray(store.grandTotal?.series) ? store.grandTotal.series : [];
  const dates = seriesList.length ? (seriesList[0]?.points || []).map((p) => p.date) : [];

  const mapped = seriesList.map((s) => {
    const rawName = String(s?.name || '').trim();
    const name = rawName.includes('同类平均')
      ? '同类平均'
      : rawName.includes('沪深') || rawName.includes('中证') || rawName.includes('标普')
        ? `基准指数（${rawName}）`
        : '本基金';
    const color = name === '本基金' ? '#00d4aa' : name.includes('同类平均') ? '#4a90e2' : '#f5a623';
    const points = Array.isArray(s?.points) ? s.points : [];
    return {
      name,
      type: 'line',
      data: points.map((p) => Number(p?.valuePct) || 0),
      smooth: true,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      showSymbol: false,
    };
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => `${Number(val).toFixed(2)}%`,
    },
    legend: { data: mapped.map((s) => s.name), textStyle: { color: '#fff' } },
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
    series: mapped,
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
                <div class="flex items-end justify-between mb-1">
                  <h3 class="text-lg font-semibold text-white">资产配置</h3>
                  <div v-if="assetAsOfDate" class="text-xs text-gray-400">截至 {{ assetAsOfDate }}</div>
                </div>
                <div class="text-xs text-gray-500 mb-4">来自季报披露（非实时）</div>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="store.assetAllocationError" class="text-yellow-300 text-sm">资产配置获取失败，可稍后重试</div>
                <div v-else-if="!hasAssetAllocationData" class="text-gray-400 text-sm">暂无资产配置（季报）</div>
                <div v-else id="asset-allocation-detail" class="h-80"></div>
                <div v-if="prevAssetQuarter && latestAssetQuarter" class="text-xs text-gray-500 mt-3">
                  较上季：股票 {{ fmtPctSigned((latestAssetQuarter.stockPct || 0) - (prevAssetQuarter.stockPct || 0)) }}，债券
                  {{ fmtPctSigned((latestAssetQuarter.bondPct || 0) - (prevAssetQuarter.bondPct || 0)) }}，现金
                  {{ fmtPctSigned((latestAssetQuarter.cashPct || 0) - (prevAssetQuarter.cashPct || 0)) }}
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="analysis-card p-6">
                <div class="flex items-end justify-between mb-1">
                  <h3 class="text-lg font-semibold text-white">行业分布</h3>
                  <div v-if="industryAsOfDate" class="text-xs text-gray-400">截至 {{ industryAsOfDate }}</div>
                </div>
                <div class="text-xs text-gray-500 mb-4">来自 F10 季报持仓行业配置（非主题标签）</div>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="store.industryError" class="text-yellow-300 text-sm">行业配置获取失败，可稍后重试</div>
                <div v-else-if="!hasIndustryData" class="text-gray-400 text-sm">暂无行业配置（F10 季报）</div>
                <div v-else id="industry-allocation" class="h-80"></div>
              </div>
              <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-white mb-4">同类对比</h3>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="store.grandTotalError" class="text-yellow-300 text-sm">对比序列获取失败，可稍后重试</div>
                <div v-else-if="!hasGrandTotal" class="text-gray-400 text-sm">暂无对比数据</div>
                <div v-else id="comparison-chart" class="h-64"></div>
                <div v-if="grandTotalRangeText" class="text-xs text-gray-500 mt-2">区间：{{ grandTotalRangeText }}（近阶段）</div>
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
              <h3 class="text-lg font-semibold text-white mb-4">风险概览</h3>
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">风险等级</span>
                  <span :class="riskSnapshot.risk.css">{{ riskSnapshot.risk.level }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">年化波动率</span>
                  <span>{{ riskSnapshot.volatilityText }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">最大回撤</span>
                  <span>{{ riskSnapshot.maxDrawdownText }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">回撤修复天数</span>
                  <span>{{ riskSnapshot.recoveryText }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">夏普比率</span>
                  <span>{{ riskSnapshot.sharpeText }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">同类排名</span>
                  <span>{{ riskSnapshot.rankText }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">同类百分位</span>
                  <span>{{ riskSnapshot.percentileText }}</span>
                </div>
              </div>
              <div class="text-xs text-gray-500 mt-3">{{ riskSnapshot.risk.hint }}</div>
              <div class="text-xs text-gray-500 mt-2">注：同类排名口径来自 Eastmoney（同类型基金）。</div>
            </div>
            <div class="analysis-card p-6">
              <h3 class="text-lg font-semibold text-white mb-4">历史回撤分析</h3>
              <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
              <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
              <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
              <div v-else id="drawdown-chart" class="h-64"></div>
            </div>
          </div>

          <div v-if="activeTab === 'portfolio'">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="analysis-card p-6">
                <div class="flex items-end justify-between mb-1">
                  <h3 class="text-lg font-semibold text-white">资产配置</h3>
                  <div v-if="assetAsOfDate" class="text-xs text-gray-400">截至 {{ assetAsOfDate }}</div>
                </div>
                <div class="text-xs text-gray-500 mb-4">来自季报披露（非实时）</div>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="store.assetAllocationError" class="text-yellow-300 text-sm">资产配置获取失败，可稍后重试</div>
                <div v-else-if="!hasAssetAllocationData" class="text-gray-400 text-sm">暂无资产配置（季报）</div>
                <div v-else id="asset-allocation-detail" class="h-80"></div>
                <div v-if="prevAssetQuarter && latestAssetQuarter" class="text-xs text-gray-500 mt-3">
                  较上季：股票 {{ fmtPctSigned((latestAssetQuarter.stockPct || 0) - (prevAssetQuarter.stockPct || 0)) }}，债券
                  {{ fmtPctSigned((latestAssetQuarter.bondPct || 0) - (prevAssetQuarter.bondPct || 0)) }}，现金
                  {{ fmtPctSigned((latestAssetQuarter.cashPct || 0) - (prevAssetQuarter.cashPct || 0)) }}
                </div>
              </div>
              <div class="analysis-card p-6">
                <div class="flex items-end justify-between mb-1">
                  <h3 class="text-lg font-semibold text-white">行业分布</h3>
                  <div v-if="industryAsOfDate" class="text-xs text-gray-400">截至 {{ industryAsOfDate }}</div>
                </div>
                <div class="text-xs text-gray-500 mb-4">来自 F10 季报持仓行业配置（非主题标签）</div>
                <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
                <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
                <div v-else-if="store.industryError" class="text-yellow-300 text-sm">行业配置获取失败，可稍后重试</div>
                <div v-else-if="!hasIndustryData" class="text-gray-400 text-sm">暂无行业配置（F10 季报）</div>
                <div v-else id="industry-allocation" class="h-80"></div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div class="analysis-card p-6">
                <div class="flex items-end justify-between mb-4">
                  <h3 class="text-lg font-semibold text-white">重仓股票（Top 10）</h3>
                  <div v-if="topHoldingsAsOfDate" class="text-xs text-gray-400">截至 {{ topHoldingsAsOfDate }}</div>
                </div>
                <div v-if="store.loading" class="text-gray-400 text-sm">加载中...</div>
                <div v-else-if="store.topHoldingsError" class="text-yellow-300 text-sm">重仓股数据获取失败，可稍后重试</div>
                <div v-else-if="!hasTopHoldings" class="text-gray-400 text-sm">暂无重仓股数据（季报披露）</div>
                <div v-else class="overflow-x-auto">
                  <table class="min-w-full text-sm">
                    <thead>
                      <tr class="text-gray-400 text-left">
                        <th class="py-2 pr-4 font-medium">股票</th>
                        <th class="py-2 pr-4 font-medium text-right">占净值比</th>
                        <th class="py-2 pr-4 font-medium text-right">市值(万)</th>
                        <th class="py-2 font-medium text-right">持股(万股)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, idx) in currentTopHoldings" :key="row.stockCode || idx" class="border-t border-white/10">
                        <td class="py-2 pr-4 whitespace-nowrap">
                          <span class="text-white">{{ row.stockName }}</span>
                          <span class="text-xs text-gray-400 ml-2">{{ row.stockCode }}</span>
                        </td>
                        <td class="py-2 pr-4 text-right">{{ fmtPctPlain(row.weightPct) }}</td>
                        <td class="py-2 pr-4 text-right">{{ fmtNum2(row.marketValueWan) }}</td>
                        <td class="py-2 text-right">{{ fmtNum2(row.sharesWan) }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="text-xs text-gray-500 mt-2">占净值比例来自基金季报披露（Top 10）。</div>
                </div>
              </div>

              <div class="analysis-card p-6">
                <div class="flex items-end justify-between mb-4">
                  <h3 class="text-lg font-semibold text-white">较上季度变动</h3>
                  <div v-if="prevTopHoldingsAsOfDate" class="text-xs text-gray-400">
                    {{ prevTopHoldingsAsOfDate }} → {{ topHoldingsAsOfDate }}
                  </div>
                </div>
                <div v-if="store.loading" class="text-gray-400 text-sm">加载中...</div>
                <div v-else-if="store.topHoldingsError" class="text-yellow-300 text-sm">变动数据获取失败，可稍后重试</div>
                <div
                  v-else-if="!topHoldingsChanges.added.length && !topHoldingsChanges.removed.length && !topHoldingsChanges.changed.length"
                  class="text-gray-400 text-sm"
                >
                  暂无对比数据
                </div>
                <div v-else class="space-y-4 text-sm">
                  <div>
                    <div class="text-gray-400 mb-2">新增进入 Top10</div>
                    <div v-if="!topHoldingsChanges.added.length" class="text-gray-500">无</div>
                    <div v-else class="space-y-1">
                      <div
                        v-for="row in topHoldingsChanges.added.slice(0, 6)"
                        :key="row.stockCode"
                        class="flex items-center justify-between"
                      >
                        <span class="truncate pr-2">{{ row.stockName }}</span>
                        <span class="text-gray-300">{{ fmtPctPlain(row.currWeightPct) }}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="text-gray-400 mb-2">移出 Top10</div>
                    <div v-if="!topHoldingsChanges.removed.length" class="text-gray-500">无</div>
                    <div v-else class="space-y-1">
                      <div
                        v-for="row in topHoldingsChanges.removed.slice(0, 6)"
                        :key="row.stockCode"
                        class="flex items-center justify-between"
                      >
                        <span class="truncate pr-2">{{ row.stockName }}</span>
                        <span class="text-gray-300">{{ fmtPctPlain(row.prevWeightPct) }}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="text-gray-400 mb-2">占比变化（Top）</div>
                    <div v-if="!topHoldingsChanges.changed.length" class="text-gray-500">无</div>
                    <div v-else class="space-y-1">
                      <div
                        v-for="row in topHoldingsChanges.changed.slice(0, 6)"
                        :key="row.stockCode"
                        class="flex items-center justify-between"
                      >
                        <span class="truncate pr-2">{{ row.stockName }}</span>
                        <span class="text-gray-300">{{ fmtPctSigned(row.deltaWeightPct) }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-xs text-gray-500">注：季报披露按季度更新，不代表实时调仓。</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'comparison'" class="analysis-card p-6">
            <div class="flex items-end justify-between mb-1">
              <h3 class="text-lg font-semibold text-white">同类对比</h3>
              <div v-if="grandTotalRangeText" class="text-xs text-gray-400">区间 {{ grandTotalRangeText }}</div>
            </div>
            <div class="text-xs text-gray-500 mb-4">同类平均：同类型基金平均表现（东财口径）；基准指数：对比指数（如 沪深300）。</div>
            <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
            <div v-else-if="error" class="text-red-300 text-sm">{{ error }}</div>
            <div v-else-if="store.grandTotalError" class="text-yellow-300 text-sm">对比序列获取失败，可稍后重试</div>
            <div v-else-if="!hasGrandTotal" class="text-gray-400 text-sm">暂无对比数据</div>
            <div v-else id="comparison-chart" class="h-80"></div>

            <div v-if="hasGrandTotal" class="mt-6 overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-gray-400 text-left">
                    <th class="py-2 pr-4 font-medium">对象</th>
                    <th class="py-2 pr-4 font-medium text-right">累计收益</th>
                    <th class="py-2 pr-4 font-medium text-right">年化波动</th>
                    <th class="py-2 pr-4 font-medium text-right">最大回撤</th>
                    <th class="py-2 font-medium text-right">夏普</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in grandTotalSummary" :key="row.name" class="border-t border-white/10">
                    <td class="py-2 pr-4 whitespace-nowrap text-white">{{ displayGrandTotalName(row.name) }}</td>
                    <td class="py-2 pr-4 text-right">{{ fmtPctPlain(row.metrics.cumulativeReturnPct) }}</td>
                    <td class="py-2 pr-4 text-right">{{ fmtPctPlain(row.metrics.volatilityPct) }}</td>
                    <td class="py-2 pr-4 text-right">{{ fmtPctPlain(row.metrics.maxDrawdownPct) }}</td>
                    <td class="py-2 text-right">
                      {{ row.metrics.sharpeRatio == null ? '—' : Number(row.metrics.sharpeRatio).toFixed(2) }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="text-xs text-gray-500 mt-2">注：该对比序列通常为近 ~6 个月，指标为该区间内估算值（用于横向比较）。</div>
            </div>
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
