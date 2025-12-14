<script setup>
import { ref, onMounted, nextTick, watch, computed, reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { useDashboardStore } from '../stores/useDashboardStore.js';
import { inferFundTypeLabel, inferIndustryLabel } from '../utils/fundInference.js';

const dashboardStore = useDashboardStore();
const { data, loading, trendRange, trend, trendLoading, trendError, basicInfoByCode, industryConfigByCode } = storeToRefs(dashboardStore);
const fundData = computed(() => data.value || null);
const hasData = computed(() => !!(fundData.value && fundData.value.funds && fundData.value.funds.length));
const typeOptions = computed(() => {
  const defaults = ['混合型', '股票型', '债券型', '货币型', '指数型', 'QDII'];
  const set = new Set(defaults);
  for (const f of fundData.value?.funds || []) {
    const label = String(f?.type || '').trim();
    if (label) set.add(label);
  }
  return Array.from(set);
});
const industryOptions = computed(() => {
  const set = new Set();
  for (const f of fundData.value?.funds || []) {
    const label = String(f?.industry || '').trim();
    if (label) set.add(label);
  }
  return Array.from(set);
});

let echarts = null;
let anime = null;

async function ensureEcharts() {
  if (!echarts) {
    const mod = await import('../charts/echarts.js');
    echarts = mod.default || mod.echarts || mod;
  }
  return echarts;
}

async function ensureAnime() {
  if (!anime) {
    const mod = await import('animejs/lib/anime.es.js');
    anime = mod.default || mod;
  }
  return anime;
}

const showFundModal = ref(false);
const showAddFund = ref(false);
const modalFund = ref(null);
const toast = ref('');
let toastTimer = null;

const addFundForm = reactive({
  code: '',
  name: '',
  type: '',
  industry: '',
  shares: 1000,
  buyPrice: 1,
});

const addLookupLoading = ref(false);
const addLookupError = ref('');
let addLookupTimer = null;

const addLookupInfo = computed(() => {
  const code = String(addFundForm.code || '').trim();
  return code ? basicInfoByCode.value?.[code] || null : null;
});

const addTypeLocked = computed(() => String(addLookupInfo.value?.type || '').trim());
const addIndustryInfo = computed(() => {
  const code = String(addFundForm.code || '').trim();
  return code ? industryConfigByCode.value?.[code] || null : null;
});

onMounted(async () => {
  await loadDashboard();
  await initAnimations();
});

async function loadDashboard(force = false) {
  await dashboardStore.load(force);
  await nextTick();
  await initCharts();
  if (dashboardStore.error) showToast('获取数据失败，请稍后重试');
}

async function refreshData() {
  await dashboardStore.refresh();
  await nextTick();
  await initCharts();
  if (dashboardStore.error) showToast('刷新失败，请稍后重试');
  else showToast('数据已更新');
}

function showToast(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 3000);
}

function openFundDetail(fund) {
  modalFund.value = fund;
  const lockedType = String(basicInfoByCode.value?.[fund?.code]?.type || '').trim();
  Object.assign(editFundForm, {
    code: fund?.code || '',
    name: fund?.name || '',
    type: lockedType || fund?.type || '未知',
    industry: fund?.industry || '未知',
    shares: Number(fund?.holdShares) || 0,
    buyPrice: Number(fund?.buyPrice) || 0,
  });
  isEditingFund.value = false;
  showFundModal.value = true;
}

function closeFundModal() {
  showFundModal.value = false;
  isEditingFund.value = false;
}

function goToAlertsForFund(fund) {
  if (!fund) return;
  try {
    localStorage.setItem(
      'ui:alerts:draft',
      JSON.stringify({
        fundCode: fund.code,
        fundName: fund.name,
        createdAt: Date.now(),
      })
    );
  } catch {}
  window.location.href = 'alerts.html';
}

function goToAnalysisForFund(fund) {
  if (!fund) return;
  try {
    localStorage.setItem(
      'ui:analysis:selectedFund',
      JSON.stringify({
        fundCode: fund.code,
        fundName: fund.name,
        createdAt: Date.now(),
      })
    );
  } catch {}
  window.location.href = 'analysis.html';
}

async function initCharts() {
  if (!fundData.value) return;
  try {
    await ensureEcharts();
    renderAssetAllocation();
    renderIndustry();
    renderProfitTrend();
  } catch (e) {
    console.error('render dashboard charts failed', e);
    showToast('图表加载失败');
  }
}

function renderAssetAllocation() {
  if (!fundData.value || !hasData.value) return;
  const dom = document.getElementById('asset-allocation-chart');
  if (!dom) return;
  const chart = echarts.getInstanceByDom(dom) || echarts.init(dom);
  const palette = ['#00d4aa', '#4a90e2', '#f5a623', '#9b59b6', '#ff6b6b', '#2ecc71', '#00c2ff', '#f39c12'];

  const totals = new Map();
  for (const f of fundData.value.funds || []) {
    const type = String(f.type || '未知');
    const value = Number(f.holdValue) || 0;
    totals.set(type, (totals.get(type) || 0) + value);
  }
  const data = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], idx) => ({
      value: Number(value.toFixed(2)),
      name,
      itemStyle: { color: palette[idx % palette.length] },
    }));

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      formatter: (p) => `${p.name}: ${formatCurrency(p.value)} (${Number(p.percent || 0).toFixed(2)}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data,
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
  });
}

function renderIndustry() {
  if (!fundData.value || !hasData.value) return;
  const dom = document.getElementById('industry-chart');
  if (!dom) return;
  const chart = echarts.getInstanceByDom(dom) || echarts.init(dom);
  const entries = Object.entries(fundData.value.industryDistribution || {})
    .map(([k, v]) => [String(k || '').trim() || '未知', Number(v) || 0])
    .filter(([k, v]) => k && Number.isFinite(v))
    .sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)', textStyle: { color: '#fff' } },
    grid: { left: 40, right: 20, top: 10, bottom: 55, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        color: '#8892b0',
        fontSize: 10,
        interval: 0,
        hideOverlap: false,
        rotate: labels.length > 4 ? 25 : 0,
        formatter: (value) => {
          const text = String(value || '');
          if (text.length <= 6) return text;
          return `${text.slice(0, 6)}…`;
        },
      },
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
        data: values,
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4aa' },
            { offset: 1, color: '#4a90e2' },
          ]),
        },
        barWidth: '60%',
      },
    ],
  });
}

function renderProfitTrend() {
  if (!fundData.value || !hasData.value) return;
  const dom = document.getElementById('profit-trend-chart');
  if (!dom) return;
  const chart = echarts.getInstanceByDom(dom) || echarts.init(dom);
  const dates = Array.isArray(trend.value?.dates) ? trend.value.dates : [];
  const profits = Array.isArray(trend.value?.profits) ? trend.value.profits : [];
  if (!dates.length || !profits.length) {
    chart.clear();
    return;
  }
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: { color: '#fff' },
      valueFormatter: (val) => formatCurrency(val),
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8892b0', fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', formatter: '¥{value}' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        data: profits,
        type: 'line',
        smooth: true,
        lineStyle: { color: '#00d4aa', width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 170, 0.3)' },
            { offset: 1, color: 'rgba(0, 212, 170, 0.05)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#00d4aa' },
        name: '累计收益',
      },
    ],
  });
}

async function initAnimations() {
  const a = await ensureAnime();
  a({
    targets: '.fade-in',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: a.stagger(100),
    easing: 'easeOutQuart',
  });
}

function formatCurrency(val) {
  return '¥' + Number(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const isEditingFund = ref(false);
const editFundForm = reactive({
  code: '',
  name: '',
  type: '混合型',
  industry: '未知',
  shares: 0,
  buyPrice: 0,
});

function startEditFund() {
  if (!modalFund.value) return;
  isEditingFund.value = true;
}

function cancelEditFund() {
  if (!modalFund.value) {
    isEditingFund.value = false;
    return;
  }
  const lockedType = String(basicInfoByCode.value?.[modalFund.value.code]?.type || '').trim();
  Object.assign(editFundForm, {
    code: modalFund.value.code,
    name: modalFund.value.name,
    type: lockedType || modalFund.value.type,
    industry: modalFund.value.industry || '未知',
    shares: Number(modalFund.value.holdShares) || 0,
    buyPrice: Number(modalFund.value.buyPrice) || 0,
  });
  isEditingFund.value = false;
}

async function saveEditFund() {
  if (!modalFund.value) return;
  const name = String(editFundForm.name || '').trim();
  const type = String(editFundForm.type || '').trim();
  const industry = String(editFundForm.industry || '').trim();
  const shares = Number(editFundForm.shares) || 0;
  const buyPrice = Number(editFundForm.buyPrice) || 0;

  const lockedType = String(basicInfoByCode.value?.[modalFund.value.code]?.type || '').trim();
  const nextType = lockedType || type || '未知';

  if (!name) {
    showToast('请输入基金名称');
    return;
  }
  if (!shares || shares <= 0 || !buyPrice || buyPrice <= 0) {
    showToast('请输入有效的份额和买入价格');
    return;
  }

  await dashboardStore.updateHolding({
    code: modalFund.value.code,
    name,
    type: nextType,
    industry,
    shares,
    buyPrice,
  });

  await nextTick();
  await initCharts();

  const updated = fundData.value?.funds?.find((f) => f.code === modalFund.value.code);
  if (updated) modalFund.value = updated;
  isEditingFund.value = false;
  showToast('持仓已更新');
}

async function deleteHolding() {
  if (!modalFund.value) return;
  const ok = window.confirm(`确认删除 ${modalFund.value.name}（${modalFund.value.code}）？`);
  if (!ok) return;

  await dashboardStore.removeFund(modalFund.value.code);
  await nextTick();
  await initCharts();
  closeFundModal();
  showToast('已删除基金');
}

function isFundCodeValid(code) {
  return /^\d{6}$/.test(String(code || '').trim());
}

async function lookupAddFundCode({ force = true } = {}) {
  const code = String(addFundForm.code || '').trim();
  addLookupError.value = '';
  if (!isFundCodeValid(code)) return null;

  const requestCode = code;
  addLookupLoading.value = true;
  try {
    await dashboardStore.refreshBasicInfo({ force, fundCodes: [requestCode] });
    await dashboardStore.refreshIndustryConfig({ force, fundCodes: [requestCode] });
    const info = basicInfoByCode.value?.[requestCode];
    const apiName = String(info?.name || '').trim();
    if (!apiName) {
      addLookupError.value = '未识别到基金名称，可手动填写';
      return null;
    }

    if (String(addFundForm.code || '').trim() !== requestCode) return info;

    const currentName = String(addFundForm.name || '').trim();
    if (!currentName || currentName === requestCode) addFundForm.name = apiName;

    const currentType = String(addFundForm.type || '').trim();
    if (!currentType) addFundForm.type = String(info?.type || '').trim() || inferFundTypeLabel(apiName) || '';

    const currentIndustry = String(addFundForm.industry || '').trim();
    const inferredIndustry = inferIndustryLabel({ name: apiName, type: addFundForm.type }) || '';
    if (!currentIndustry) addFundForm.industry = inferredIndustry || '';

    return info;
  } catch {
    addLookupError.value = '识别失败，请检查网络或基金代码';
    return null;
  } finally {
    addLookupLoading.value = false;
  }
}

async function submitAddFund() {
  const code = String(addFundForm.code || '').trim();
  if (!code) {
    showToast('请输入基金代码');
    return;
  }
  const shares = Number(addFundForm.shares);
  const buyPrice = Number(addFundForm.buyPrice);
  if (!shares || shares <= 0 || !buyPrice || buyPrice <= 0) {
    showToast('请输入有效的份额和买入价格');
    return;
  }

  const nameBefore = String(addFundForm.name || '').trim();
  if (!nameBefore && isFundCodeValid(code)) {
    await lookupAddFundCode({ force: true });
  }
  const name = String(addFundForm.name || '').trim();
  if (!name) {
    showToast('未识别到基金名称，请手动填写');
    return;
  }

  await dashboardStore.addFund({
    code,
    name,
    type: addFundForm.type?.trim(),
    industry: addFundForm.industry?.trim(),
    shares,
    buyPrice,
  });

  showAddFund.value = false;
  Object.assign(addFundForm, { code: '', name: '', type: '', industry: '', shares: 1000, buyPrice: 1 });
  showToast('已添加到持仓');
  await nextTick();
  await initCharts();
}

async function changeTrendRange(range) {
  if (trendLoading.value || loading.value) return;
  await dashboardStore.setTrendRange(range);
  await nextTick();
  await ensureEcharts();
  renderProfitTrend();
  if (trendError.value) showToast('收益趋势加载失败');
}

watch(
  () => fundData.value,
  async (val) => {
    if (val) {
      await nextTick();
      initCharts();
    }
  },
  { deep: true }
);

watch(
  () => addFundForm.code,
  (val) => {
    addLookupError.value = '';
    const code = String(val || '').trim();
    if (addLookupTimer) clearTimeout(addLookupTimer);
    if (!isFundCodeValid(code)) return;
    addLookupTimer = setTimeout(() => {
      lookupAddFundCode({ force: false });
    }, 400);
  }
);
</script>

<template>
  <div class="text-white bg-slate-900 min-h-screen">
    <nav class="glass-effect sticky top-0 z-40 backdrop-blur-md">
      <div class="container mx-auto px-6">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-8">
            <div class="text-gradient font-bold text-xl">智能基金分析工具</div>
            <div class="hidden md:flex space-x-6">
              <a href="index.html" class="nav-item text-white border-b-2 border-green-400">仪表板</a>
              <a href="analysis.html" class="nav-item text-gray-300 hover:text-white transition-colors">分析</a>
              <a href="alerts.html" class="nav-item text-gray-300 hover:text-white transition-colors">提醒</a>
              <a href="chat.html" class="nav-item text-gray-300 hover:text-white transition-colors">AI助手</a>
              <a href="reports.html" class="nav-item text-gray-300 hover:text-white transition-colors">报告</a>
              <a href="vue-demo.html" class="nav-item text-gray-300 hover:text-white transition-colors">Vue Demo</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button @click="refreshData" class="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
              <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button @click="showAddFund = true" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              添加基金
            </button>
          </div>
        </div>
      </div>
    </nav>

    <div v-if="dashboardStore.error" class="container mx-auto px-6 pt-4">
      <div class="bg-red-500 bg-opacity-20 border border-red-500 text-red-100 rounded-lg px-4 py-3 text-sm">
        加载数据失败：{{ dashboardStore.error?.message || '未知错误' }}
      </div>
    </div>

    <main class="container mx-auto px-6 py-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="glass-effect rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-400 text-sm font-medium">总资产</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ formatCurrency(fundData?.totalAssets || 0) }}</p>
          <p class="text-xs text-gray-400 mt-1">实时更新</p>
        </div>
        <div class="glass-effect rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-400 text-sm font-medium">今日收益</h3>
          </div>
          <p class="text-2xl font-bold" :class="(fundData?.todayProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'">
            {{ formatCurrency(fundData?.todayProfit || 0) }}
          </p>
          <p class="text-xs text-gray-400 mt-1">今日变化</p>
        </div>
        <div class="glass-effect rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-400 text-sm font-medium">累计收益</h3>
          </div>
          <p class="text-2xl font-bold" :class="(fundData?.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'">
            {{ formatCurrency(fundData?.totalProfit || 0) }}
          </p>
          <p class="text-xs text-gray-400 mt-1">{{ (fundData?.profitRate || 0).toFixed(2) }}%</p>
        </div>
        <div class="glass-effect rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-400 text-sm font-medium">持有基金</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ fundData?.funds?.length || 0 }}</p>
          <p class="text-xs text-gray-400 mt-1">活跃持仓</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2">
          <div class="glass-effect rounded-xl p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-semibold text-white">我的基金</h2>
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-400">排序:</span>
                <select class="bg-gray-700 text-white text-sm rounded px-2 py-1">
                  <option>按收益</option>
                  <option>按市值</option>
                  <option>按涨幅</option>
                </select>
              </div>
            </div>
            <div v-if="loading" class="text-gray-400 text-sm">数据加载中...</div>
            <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无持仓数据，请添加基金。</div>
            <div v-else class="space-y-4">
              <div
                v-for="fund in fundData?.funds || []"
                :key="fund.code"
                class="fund-item bg-gray-800 bg-opacity-50 rounded-lg p-4 hover:bg-opacity-70 transition-all duration-300 cursor-pointer"
                @click="openFundDetail(fund)"
              >
                <div class="flex justify-between items-start mb-2">
                  <div class="flex-1">
                    <h3 class="text-white font-medium text-sm">{{ fund.name }}</h3>
                    <p class="text-gray-400 text-xs">{{ fund.code }}</p>
                  </div>
                  <span class="px-2 py-1 bg-blue-600 text-white text-xs rounded">{{ fund.type }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <div>
                    <p class="text-white font-semibold">{{ formatCurrency(fund.holdValue) }}</p>
                    <p class="text-xs" :class="fund.profit >= 0 ? 'text-green-400' : 'text-red-400'">
                      {{ fund.profit >= 0 ? '+' : '' }}{{ fund.profit.toFixed(2) }} ({{ fund.profitPercent.toFixed(2) }}%)
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-white font-medium">{{ fund.nav.toFixed(4) }}</p>
                    <p class="text-xs" :class="fund.change >= 0 ? 'text-green-400' : 'text-red-400'">
                      {{ fund.change >= 0 ? '+' : '' }}{{ fund.changePercent.toFixed(2) }}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="glass-effect rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">类型分布</h3>
            <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
            <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
            <div v-else id="asset-allocation-chart" class="h-48"></div>
          </div>
          <div class="glass-effect rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">主题/风格分布</h3>
            <div v-if="loading" class="text-gray-400 text-sm">图表加载中...</div>
            <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
            <div v-else id="industry-chart" class="h-48"></div>
          </div>
        </div>
      </div>

      <div class="mt-8 glass-effect rounded-xl p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">收益趋势</h2>
          <div class="flex items-center space-x-2">
            <button
              :disabled="trendLoading || loading"
              @click="changeTrendRange('30d')"
              :class="trendRange === '30d' ? 'bg-green-600' : 'bg-gray-600'"
              class="px-3 py-1 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              30天
            </button>
            <button
              :disabled="trendLoading || loading"
              @click="changeTrendRange('90d')"
              :class="trendRange === '90d' ? 'bg-green-600' : 'bg-gray-600'"
              class="px-3 py-1 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              90天
            </button>
            <button
              :disabled="trendLoading || loading"
              @click="changeTrendRange('1y')"
              :class="trendRange === '1y' ? 'bg-green-600' : 'bg-gray-600'"
              class="px-3 py-1 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              1年
            </button>
          </div>
        </div>
        <div v-if="loading || trendLoading" class="text-gray-400 text-sm">图表加载中...</div>
        <div v-else-if="!hasData" class="text-gray-400 text-sm">暂无数据</div>
        <div v-else-if="trendError" class="text-gray-400 text-sm">收益趋势加载失败，请稍后重试。</div>
        <div v-else id="profit-trend-chart" class="h-64"></div>
      </div>

      <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="glass-effect rounded-xl p-6 text-center hover-card fade-in">
          <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="h-6 w-6 text-white" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">基金分析</h3>
          <p class="text-gray-400 text-sm mb-4">深度分析基金表现和风险指标</p>
          <a href="analysis.html" class="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"> 开始分析 </a>
        </div>
        <div class="glass-effect rounded-xl p-6 text-center hover-card fade-in">
          <div class="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="h-6 w-6 text-white" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">智能对话</h3>
          <p class="text-gray-400 text-sm mb-4">AI助手提供投资建议和市场分析</p>
          <a href="chat.html" class="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"> 开始对话 </a>
        </div>
        <div class="glass-effect rounded-xl p-6 text-center hover-card fade-in">
          <div class="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="h-6 w-6 text-white" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5V7a9.5 9.5 0 0119 0v10z"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">止盈提醒</h3>
          <p class="text-gray-400 text-sm mb-4">设置止盈止损，自动提醒调仓</p>
          <a href="alerts.html" class="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"> 设置提醒 </a>
        </div>
      </div>
    </main>

    <footer class="mt-16 py-8 border-t border-gray-700">
      <div class="container mx-auto px-6 text-center">
        <p class="text-gray-400 text-sm">© 2025 智能基金分析工具. 专业的投资管理平台，助力您的财富增长.</p>
      </div>
    </footer>

    <!-- 基金详情模态框 -->
    <div v-if="showFundModal && modalFund" class="fixed inset-0 z-50">
      <div class="modal-backdrop absolute inset-0" @click="closeFundModal"></div>
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="glass-effect rounded-xl max-w-md w-full">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h2 class="text-xl font-bold text-white">{{ isEditingFund ? '编辑持仓' : modalFund.name }}</h2>
                <p class="text-gray-400">
                  {{ modalFund.code }}<span v-if="!isEditingFund"> · {{ modalFund.type }}</span>
                </p>
              </div>
              <button @click="closeFundModal" class="text-gray-400 hover:text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <template v-if="!isEditingFund">
              <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-800 rounded-lg p-4">
                  <p class="text-gray-400 text-sm">当前净值</p>
                  <p class="text-white text-xl font-bold">{{ modalFund.nav.toFixed(4) }}</p>
                  <p v-if="modalFund.navDate" class="text-gray-400 text-xs mt-1">净值日期：{{ modalFund.navDate }}</p>
                  <p class="text-sm" :class="modalFund.change >= 0 ? 'text-green-400' : 'text-red-400'">
                    {{ modalFund.change >= 0 ? '+' : '' }}{{ modalFund.changePercent.toFixed(2) }}%
                  </p>
                  <p v-if="modalFund.estimatedNav != null" class="text-gray-400 text-xs mt-1">
                    估算：{{ Number(modalFund.estimatedNav).toFixed(4) }}
                    <span v-if="modalFund.estimatedChangePercent != null"
                      >（{{ Number(modalFund.estimatedChangePercent).toFixed(2) }}%）</span
                    >
                  </p>
                </div>
                <div class="bg-gray-800 rounded-lg p-4">
                  <p class="text-gray-400 text-sm">持仓市值</p>
                  <p class="text-white text-xl font-bold">{{ formatCurrency(modalFund.holdValue) }}</p>
                  <p class="text-sm text-blue-400">{{ modalFund.holdShares.toLocaleString() }}份</p>
                </div>
              </div>

              <div class="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 class="text-white font-medium mb-3">持仓分析</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-gray-400">买入价格</span>
                    <span class="text-white">{{ modalFund.buyPrice.toFixed(4) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">持仓收益</span>
                    <span :class="modalFund.profit >= 0 ? 'text-green-400' : 'text-red-400'">
                      {{ modalFund.profit >= 0 ? '+' : '' }}¥{{ modalFund.profit.toFixed(2) }} ({{ modalFund.profitPercent.toFixed(2) }}%)
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">投资行业</span>
                    <span class="text-white">{{ modalFund.industry }}</span>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button
                  @click="goToAlertsForFund(modalFund)"
                  class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
                >
                  设置提醒
                </button>
                <button
                  @click="goToAnalysisForFund(modalFund)"
                  class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
                >
                  深度分析
                </button>
              </div>
              <div class="flex gap-3 mt-3">
                <button @click="startEditFund" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors">
                  编辑
                </button>
                <button @click="deleteHolding" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors">
                  删除
                </button>
              </div>
            </template>

            <template v-else>
              <div class="space-y-4 mb-6">
                <div>
                  <label class="block text-gray-400 text-sm mb-2" for="edit-fund-name">基金名称</label>
                  <input
                    id="edit-fund-name"
                    name="editFundName"
                    v-model="editFundForm.name"
                    type="text"
                    placeholder="请输入基金名称"
                    class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label class="block text-gray-400 text-sm mb-2" for="edit-fund-type">类型</label>
                  <input
                    id="edit-fund-type"
                    name="editFundType"
                    v-model="editFundForm.type"
                    type="text"
                    list="type-options"
                    :disabled="basicInfoByCode?.[modalFund?.code]?.type"
                    placeholder="如：混合型/股票型/债券型/货币型/QDII/指数型"
                    class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
                  />
                  <p v-if="basicInfoByCode?.[modalFund?.code]?.type" class="text-gray-400 text-xs mt-2">
                    类型来自基金基础信息（API），如需手动维护请在 API 无类型返回时填写。
                  </p>
                </div>
                <div>
                  <label class="block text-gray-400 text-sm mb-2" for="edit-fund-industry">主题/风格</label>
                  <input
                    id="edit-fund-industry"
                    name="editFundIndustry"
                    v-model="editFundForm.industry"
                    type="text"
                    list="industry-options"
                    placeholder="如：新能源/白酒/港股/蓝筹股/中小盘"
                    class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <p v-if="industryConfigByCode?.[modalFund?.code]?.industries?.length" class="text-gray-400 text-xs mt-2">
                    F10 持仓行业配置 Top1：{{ industryConfigByCode?.[modalFund?.code]?.industries?.[0]?.name }}
                    {{ Number(industryConfigByCode?.[modalFund?.code]?.industries?.[0]?.pct || 0).toFixed(2) }}%（{{
                      industryConfigByCode?.[modalFund?.code]?.asOfDate || '最新季度'
                    }}） ——仅供参考，不代表主题标签。
                  </p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-gray-400 text-sm mb-2" for="edit-fund-shares">持有份额</label>
                    <input
                      id="edit-fund-shares"
                      name="editFundShares"
                      v-model.number="editFundForm.shares"
                      type="number"
                      placeholder="份额"
                      class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label class="block text-gray-400 text-sm mb-2" for="edit-fund-buyprice">买入价格</label>
                    <input
                      id="edit-fund-buyprice"
                      name="editFundBuyPrice"
                      v-model="editFundForm.buyPrice"
                      type="number"
                      step="0.0001"
                      placeholder="买入价"
                      class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button @click="cancelEditFund" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors">
                  取消
                </button>
                <button @click="saveEditFund" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
                  保存
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加基金模态框 -->
    <div v-if="showAddFund" class="fixed inset-0 z-50">
      <div class="modal-backdrop absolute inset-0" @click="showAddFund = false"></div>
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="glass-effect rounded-xl max-w-md w-full p-6">
          <h2 class="text-xl font-bold text-white mb-4">添加基金</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-code-input">基金代码</label>
              <div class="flex gap-2">
                <input
                  id="fund-code-input"
                  name="fundCode"
                  v-model="addFundForm.code"
                  type="text"
                  placeholder="请输入 6 位基金代码（如：018927）"
                  class="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  @click="lookupAddFundCode({ force: true })"
                  :disabled="addLookupLoading || !isFundCodeValid(addFundForm.code)"
                  class="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ addLookupLoading ? '识别中' : '识别' }}
                </button>
              </div>
              <p v-if="addLookupError" class="text-red-400 text-xs mt-2">{{ addLookupError }}</p>
              <p v-else-if="addLookupInfo?.name" class="text-gray-400 text-xs mt-2">已识别：{{ addLookupInfo.name }}</p>
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-name-input">基金名称（自动识别，可修改）</label>
              <input
                id="fund-name-input"
                name="fundName"
                v-model="addFundForm.name"
                type="text"
                placeholder="可留空，输入基金代码后自动识别"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-shares-input">买入份额</label>
              <input
                id="fund-shares-input"
                name="fundShares"
                v-model.number="addFundForm.shares"
                type="number"
                placeholder="请输入买入份额"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-buyprice-input">买入价格</label>
              <input
                id="fund-buyprice-input"
                name="fundBuyPrice"
                v-model="addFundForm.buyPrice"
                type="number"
                step="0.0001"
                placeholder="请输入买入价格"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-type-input">类型</label>
              <input
                id="fund-type-input"
                name="fundType"
                v-model="addFundForm.type"
                type="text"
                list="type-options"
                :disabled="addTypeLocked"
                placeholder="可留空自动识别（如：QDII/股票型/债券型…）"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
              />
              <p v-if="addTypeLocked" class="text-gray-400 text-xs mt-2">
                类型来自基金基础信息（API），如需手动维护请在 API 无类型返回时填写。
              </p>
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2" for="fund-industry-input">主题/风格</label>
              <input
                id="fund-industry-input"
                name="fundIndustry"
                v-model="addFundForm.industry"
                type="text"
                list="industry-options"
                placeholder="如：新能源/白酒/港股/蓝筹股/中小盘"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <p v-if="addIndustryInfo?.industries?.length" class="text-gray-400 text-xs mt-2">
                F10 持仓行业配置 Top1：{{ addIndustryInfo.industries[0].name }}
                {{ Number(addIndustryInfo.industries[0].pct || 0).toFixed(2) }}%（{{
                  addIndustryInfo.asOfDate || '最新季度'
                }}）——仅供参考，不代表主题标签。
              </p>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button
              @click="showAddFund = false"
              class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              取消
            </button>
            <button @click="submitAddFund" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
              添加
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {{ toast }}
    </div>

    <datalist id="industry-options">
      <option v-for="opt in industryOptions" :key="opt" :value="opt"></option>
    </datalist>

    <datalist id="type-options">
      <option v-for="opt in typeOptions" :key="opt" :value="opt"></option>
    </datalist>
  </div>
</template>

<style scoped>
.hero-bg {
  background-image: url('../assets/hero-bg.jpg');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
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
.hover-card {
  transition: all 0.3s ease;
}
.hover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}
.fund-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}
.modal-backdrop {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
}
</style>
