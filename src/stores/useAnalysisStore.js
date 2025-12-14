import { defineStore } from 'pinia';
import { getAnalysisResult as fetchAnalysisResult } from '../services/dataService.js';
import { loadDashboardHoldings } from '../services/portfolioStorage.js';

const DEFAULT_FUNDS = [
  { code: '001071', name: '华夏恒生ETF联接A' },
  { code: '003834', name: '华夏能源革新股票A' },
  { code: '005827', name: '易方达蓝筹精选混合' },
  { code: '161725', name: '招商中证白酒指数A' },
  { code: '110011', name: '易方达中小盘混合' },
];

function uniqueFunds(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const code = String(item?.code || '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: String(item?.name || code).trim() || code });
  }
  return out;
}

function loadFundsFromHoldings() {
  try {
    const holdings = loadDashboardHoldings();
    return (holdings || []).map((h) => ({ code: h.code, name: h.name || h.code }));
  } catch {
    return [];
  }
}

function hashTo32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seedFromFundCode(code) {
  const str = String(code || '').trim() || 'default';
  return (hashTo32(str) % 9) + 1; // 1..9
}

function formatPct(num) {
  const n = Number(num) || 0;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function toFixed2(num) {
  return Number((Number(num) || 0).toFixed(2));
}

function buildOverviewMetrics(metrics) {
  const nav = Number(metrics?.nav) || 0;
  const navChangePct = Number(metrics?.navChangePct) || 0;
  const yearReturnPct = Number(metrics?.yearReturnPct) || 0;
  const sharpeRatio = metrics?.sharpeRatio == null ? null : Number(metrics?.sharpeRatio);
  const maxDrawdownPct = Number(metrics?.maxDrawdownPct) || 0;

  const navDeltaClass = navChangePct >= 0 ? 'text-green-400' : 'text-red-400';

  const benchmarkEnd = toFixed2(yearReturnPct * 0.8);
  const beatBenchmark = yearReturnPct >= benchmarkEnd;

  const sharpeClass =
    sharpeRatio == null ? 'text-gray-400' : sharpeRatio >= 1.2 ? 'text-green-400' : sharpeRatio >= 0.8 ? 'text-yellow-400' : 'text-red-400';
  const sharpeHint =
    sharpeRatio == null ? '—' : sharpeRatio >= 1.2 ? '风险调整收益良好' : sharpeRatio >= 0.8 ? '风险收益均衡' : '风险收益偏低';

  const mddAbs = Math.abs(maxDrawdownPct);
  const mddClass = mddAbs <= 5 ? 'text-green-400' : mddAbs <= 10 ? 'text-yellow-400' : 'text-red-400';
  const mddHint = mddAbs <= 5 ? '低风险' : mddAbs <= 10 ? '中等风险' : '高风险';

  return [
    { label: '当前净值', value: nav.toFixed(4), delta: formatPct(navChangePct), deltaClass: navDeltaClass },
    {
      label: '近1年收益',
      value: formatPct(yearReturnPct),
      delta: beatBenchmark ? '跑赢基准' : '落后基准',
      deltaClass: beatBenchmark ? 'text-green-400' : 'text-red-400',
    },
    { label: '夏普比率', value: sharpeRatio == null ? '—' : sharpeRatio.toFixed(2), delta: sharpeHint, deltaClass: sharpeClass },
    { label: '最大回撤', value: `${maxDrawdownPct.toFixed(2)}%`, delta: mddHint, deltaClass: mddClass },
  ];
}

export const useAnalysisStore = defineStore('analysis', {
  state: () => {
    const mergedFunds = uniqueFunds([...loadFundsFromHoldings(), ...DEFAULT_FUNDS]);
    return {
      activeTab: 'overview',
      activeFund: '001071',
      funds: mergedFunds,
      overviewMetrics: [],
      series: { dates: [], fundCumulative: [], benchmarkCumulative: [], drawdowns: [], monthlyReturns: [] },
      metricsRaw: { nav: 0, navChangePct: 0, yearReturnPct: 0, sharpeRatio: null, maxDrawdownPct: 0 },
      loading: false,
      error: null,
    };
  },
  actions: {
    setTab(tab) {
      this.activeTab = tab;
    },
    async setFund(code) {
      const nextCode = String(code || '').trim();
      if (!nextCode) return;
      this.activeFund = nextCode;
      if (!this.funds.some((f) => f.code === nextCode)) {
        const name = loadFundsFromHoldings().find((f) => f.code === nextCode)?.name || nextCode;
        this.funds = uniqueFunds([...this.funds, { code: nextCode, name }]);
      }
      await this.load({ fundCode: nextCode });
    },
    async load({ fundCode, force = false } = {}) {
      const code = fundCode || this.activeFund;
      if (!code) return;

      this.loading = true;
      this.error = null;
      try {
        const result = await fetchAnalysisResult({ fundCode: code, horizon: '1y', force });
        this.metricsRaw = result.metrics;
        this.overviewMetrics = buildOverviewMetrics(result.metrics);
        this.series = {
          dates: result.series.dates,
          fundCumulative: result.series.fundCumulativePct,
          benchmarkCumulative: result.series.benchmarkCumulativePct,
          drawdowns: result.series.drawdownPct,
          monthlyReturns: result.series.monthlyReturnPct,
        };
      } catch (e) {
        this.error = e;
      } finally {
        this.loading = false;
      }
    },
    getSeed() {
      return seedFromFundCode(this.activeFund);
    },
    getAnalysisResult() {
      return {
        fundCode: this.activeFund,
        metrics: this.metricsRaw,
        series: {
          dates: this.series.dates,
          fundCumulativePct: this.series.fundCumulative,
          benchmarkCumulativePct: this.series.benchmarkCumulative,
          drawdownPct: this.series.drawdowns,
          monthlyReturnPct: this.series.monthlyReturns,
        },
      };
    },
  },
});
