<script setup>
import { ref, computed, onMounted } from 'vue';
import { logger } from '../utils/logger.js';
import { useAlertsStore } from '../stores/useAlertsStore.js';
import { loadDashboardHoldings } from '../services/portfolioStorage.js';

const historyData = [
  {
    time: '2025-01-22 09:15',
    fundName: '华夏能源革新股票A',
    type: '收益止盈',
    condition: '收益 > 15%',
    currentValue: '18.5%',
    status: '已触发',
    action: '查看详情',
  },
  {
    time: '2025-01-21 14:30',
    fundName: '易方达蓝筹精选混合',
    type: '净值提醒',
    condition: '净值 > 1.9',
    currentValue: '1.8765',
    status: '未触发',
    action: '查看详情',
  },
  {
    time: '2025-01-20 10:45',
    fundName: '招商中证白酒指数A',
    type: '收益止盈',
    condition: '收益 > 8%',
    currentValue: '6.95%',
    status: '未触发',
    action: '查看详情',
  },
  {
    time: '2025-01-18 15:20',
    fundName: '华夏恒生ETF联接A',
    type: '亏损止损',
    condition: '亏损 < -5%',
    currentValue: '3.90%',
    status: '未触发',
    action: '查看详情',
  },
];

const DEFAULT_FUND_OPTIONS = [
  { code: '001071', name: '华夏恒生ETF联接A' },
  { code: '003834', name: '华夏能源革新股票A' },
  { code: '005827', name: '易方达蓝筹精选混合' },
  { code: '161725', name: '招商中证白酒指数A' },
  { code: '110011', name: '易方达中小盘混合' },
];

const fundOptions = ref([...DEFAULT_FUND_OPTIONS]);

const filterStatus = ref('all');
const sortBy = ref('created');
const showModal = ref(false);
const toast = ref('');
const toastTimer = ref(null);

const form = ref({
  fund: DEFAULT_FUND_OPTIONS[0].code,
  type: 'profit',
  condition: 'above',
  value: '',
  unit: 'percent',
});

const store = useAlertsStore();

const filteredAlerts = computed(() => {
  let list = [...store.alerts];
  if (filterStatus.value !== 'all') {
    list = list.filter((a) => a.status === filterStatus.value);
  }
  list.sort((a, b) => {
    if (sortBy.value === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy.value === 'trigger') return new Date(b.lastTriggered || 0) - new Date(a.lastTriggered || 0);
    if (sortBy.value === 'profit') return b.currentValue - a.currentValue;
    return 0;
  });
  return list;
});

const hasAlerts = computed(() => (store.alerts || []).length > 0);

function addNewAlert() {
  if (!form.value.value) {
    showToast('请输入目标值');
    return;
  }
  const fund = fundOptions.value.find((f) => f.code === form.value.fund);
  store
    .create({
      fundName: fund?.name || form.value.fund,
      fundCode: form.value.fund,
      type: form.value.type,
      condition: form.value.condition,
      targetValue: Number(parseFloat(form.value.value).toFixed(2)),
      unit: form.value.unit,
    })
    .then(() => {
      showModal.value = false;
      form.value.value = '';
      showToast('提醒添加成功');
    })
    .catch(() => showToast('提醒添加失败'));
}

function toggleAlert(id) {
  store
    .toggle(id)
    .then((updated) => {
      showToast(`提醒已${updated?.status === 'active' ? '开启' : '暂停'}`);
    })
    .catch(() => showToast('操作失败'));
}

function deleteAlert(id) {
  store
    .remove(id)
    .then((ok) => {
      if (ok) showToast('提醒已删除');
      else showToast('未找到该提醒');
    })
    .catch(() => showToast('删除失败'));
}

function showToast(message) {
  toast.value = message;
  clearTimeout(toastTimer.value);
  toastTimer.value = setTimeout(() => {
    toast.value = '';
  }, 3000);
}

function statusText(status) {
  return { active: '活跃', triggered: '已触发', paused: '已暂停' }[status] || status;
}

function formatValue(value, unit, withSign = false) {
  const num = Number(value || 0);
  const prefix = withSign && num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}${unit === 'percent' ? '%' : '元'}`;
}

function consumeDraftAlert() {
  try {
    const raw = localStorage.getItem('ui:alerts:draft');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logger.warn('alerts:draft parse failed', { error: String(e) });
    return null;
  } finally {
    try {
      localStorage.removeItem('ui:alerts:draft');
    } catch {}
  }
}

onMounted(async () => {
  await store.load();
  try {
    const holdings = loadDashboardHoldings();
    const fromHoldings = holdings.map((h) => ({ code: h.code, name: h.name || h.code }));
    const merged = [...fromHoldings, ...DEFAULT_FUND_OPTIONS].filter(
      (item, idx, arr) => arr.findIndex((x) => x.code === item.code) === idx
    );
    if (merged.length) fundOptions.value = merged;
    if (!fundOptions.value.some((f) => f.code === form.value.fund)) {
      form.value.fund = fundOptions.value[0]?.code || form.value.fund;
    }
  } catch (e) {
    logger.warn('alerts:load holdings failed', { error: String(e) });
  }

  const draft = consumeDraftAlert();
  if (!draft?.fundCode) return;

  const code = String(draft.fundCode || '').trim();
  const name = String(draft.fundName || '').trim();
  if (code && !fundOptions.value.some((f) => f.code === code)) {
    fundOptions.value.unshift({ code, name: name || code });
  }
  form.value.fund = code || fundOptions.value[0]?.code || form.value.fund;
  showModal.value = true;
  logger.info('alerts:prefill from dashboard', { fundCode: code });
});
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
              <a href="alerts.html" class="nav-item text-white border-b-2 border-green-400">提醒</a>
              <a href="chat.html" class="nav-item text-gray-300 hover:text-white transition-colors">AI助手</a>
              <a href="reports.html" class="nav-item text-gray-300 hover:text-white transition-colors">报告</a>
              <a href="vue-demo.html" class="nav-item text-gray-300 hover:text-white transition-colors">Vue Demo</a>
            </div>
          </div>
          <button @click="showModal = true" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">添加提醒</button>
        </div>
      </div>
    </nav>

    <main class="container mx-auto px-6 py-8 space-y-6">
      <div class="glass-effect p-6 rounded-xl">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-white mb-1">提醒管理</h1>
            <p class="text-gray-400 text-sm">创建、筛选、管理你的止盈止损/净值提醒</p>
          </div>
          <div class="flex items-center gap-3">
            <select v-model="filterStatus" class="bg-gray-800 text-white rounded px-3 py-2 text-sm">
              <option value="all">全部状态</option>
              <option value="active">活跃</option>
              <option value="paused">暂停</option>
              <option value="triggered">已触发</option>
            </select>
            <select v-model="sortBy" class="bg-gray-800 text-white rounded px-3 py-2 text-sm">
              <option value="created">按创建时间</option>
              <option value="trigger">按触发时间</option>
              <option value="profit">按当前收益</option>
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="glass-effect p-6 rounded-xl lg:col-span-2 space-y-4" id="alerts-list">
          <div v-if="store.loading" class="text-gray-400 text-sm">提醒加载中...</div>
          <div v-else-if="store.error" class="text-gray-400 text-sm">提醒加载失败，请刷新重试。</div>
          <div v-else-if="!hasAlerts" class="text-gray-400 text-sm">暂无提醒，请点击右上角“添加提醒”。</div>
          <div
            v-else
            v-for="alert in filteredAlerts"
            :key="alert.id"
            class="alert-card p-4"
            :class="{
              'alert-active': alert.status === 'active',
              'alert-triggered': alert.status === 'triggered',
            }"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-3">
                <span class="status-indicator" :class="`status-${alert.status}`"></span>
                <div>
                  <h3 class="text-white font-medium">{{ alert.fundName }}</h3>
                  <p class="text-gray-400 text-sm">{{ alert.fundCode }}</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                  {{
                    alert.type === 'profit'
                      ? '收益止盈'
                      : alert.type === 'loss'
                        ? '亏损止损'
                        : alert.type === 'price'
                          ? '价格提醒'
                          : '净值提醒'
                  }}
                </span>
                <button @click="toggleAlert(alert.id)" class="text-gray-400 hover:text-white">
                  <span class="text-sm">{{ alert.status === 'active' ? '暂停' : '启用' }}</span>
                </button>
                <button @click="deleteAlert(alert.id)" class="text-gray-400 hover:text-red-400">
                  <span class="text-sm">删除</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <p class="text-gray-400 text-sm">目标{{ alert.type === 'loss' ? '止损' : '止盈' }}</p>
                <p class="text-white font-semibold">{{ formatValue(alert.targetValue, alert.unit) }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">当前{{ alert.type === 'loss' ? '亏损' : '收益' }}</p>
                <p class="text-white font-semibold" :class="alert.currentValue >= 0 ? 'text-green-400' : 'text-red-400'">
                  {{ formatValue(alert.currentValue, alert.unit, true) }}
                </p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">状态</p>
                <p class="text-white font-semibold">{{ statusText(alert.status) }}</p>
              </div>
            </div>

            <div class="mb-3">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-400">完成度</span>
                <span class="text-white">{{ Math.min((alert.currentValue / alert.targetValue) * 100, 100).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div
                  class="progress-bar rounded-full"
                  :style="{ width: Math.min((alert.currentValue / alert.targetValue) * 100, 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="flex justify-between items-center text-xs text-gray-400">
              <span>创建时间：{{ alert.createdAt }}</span>
              <span v-if="alert.lastTriggered">触发时间：{{ alert.lastTriggered }}</span>
            </div>
          </div>
        </div>

        <div class="glass-effect p-6 rounded-xl">
          <h3 class="text-lg font-semibold text-white mb-4">提醒历史</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <tbody>
                <tr v-for="item in historyData" :key="item.time" class="border-b border-gray-800">
                  <td class="py-3 text-gray-400 pr-4">{{ item.time }}</td>
                  <td class="py-3 text-white pr-4">{{ item.fundName }}</td>
                  <td class="py-3 text-gray-400 pr-4">{{ item.type }}</td>
                  <td class="py-3 text-gray-400 pr-4">{{ item.condition }}</td>
                  <td class="py-3 text-white pr-4">{{ item.currentValue }}</td>
                  <td class="py-3 pr-4">
                    <span
                      class="px-2 py-1 rounded text-xs"
                      :class="item.status === '已触发' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'"
                    >
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="py-3">
                    <button @click="showToast('详情功能开发中...')" class="text-blue-400 hover:text-blue-300 text-sm">
                      {{ item.action }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <footer class="glass-effect mt-16 py-8">
      <div class="container mx-auto px-6 text-center text-gray-400">
        <p>© 2025 智能基金分析工具 - 专业的基金投资分析平台</p>
      </div>
    </footer>

    <!-- 添加提醒模态框 -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="modal-backdrop absolute inset-0" @click="showModal = false"></div>
      <div class="glass-effect rounded-xl max-w-md w-full p-6 relative z-10">
        <h2 class="text-xl font-bold text-white mb-4">添加提醒</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-gray-400 text-sm mb-2">选择基金</label>
            <select v-model="form.fund" class="w-full bg-gray-700 text-white rounded-lg px-3 py-2">
              <option v-for="f in fundOptions" :key="f.code" :value="f.code">{{ f.name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-gray-400 text-sm mb-2">提醒类型</label>
              <select v-model="form.type" class="w-full bg-gray-700 text-white rounded-lg px-3 py-2">
                <option value="profit">收益止盈</option>
                <option value="loss">亏损止损</option>
                <option value="price">价格提醒</option>
                <option value="nav">净值提醒</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2">条件</label>
              <select v-model="form.condition" class="w-full bg-gray-700 text-white rounded-lg px-3 py-2">
                <option value="above">高于</option>
                <option value="below">低于</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-gray-400 text-sm mb-2">目标值</label>
              <input
                id="alert-target-input"
                name="alertTarget"
                v-model="form.value"
                type="number"
                class="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-2">单位</label>
              <select v-model="form.unit" class="w-full bg-gray-700 text-white rounded-lg px-3 py-2">
                <option value="percent">%</option>
                <option value="amount">元</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showModal = false" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors">
            取消
          </button>
          <button @click="addNewAlert" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {{ toast }}
    </div>
  </div>
</template>
