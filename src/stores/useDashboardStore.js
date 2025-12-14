// @ts-check

import { defineStore } from 'pinia';
import { getDashboardData, getFundBasicInfo, getFundNavHistory, getFundQuote } from '../services/dataService.js';
import {
  DASHBOARD_STORAGE_KEY_V1,
  DASHBOARD_STORAGE_KEY_V2,
  loadDashboardHoldings,
  normalizeHolding,
  normalizeHoldings,
  saveDashboardHoldings,
} from '../services/portfolioStorage.js';
import { logger } from '../utils/logger.js';

function toFixed2(num) {
  return Number((Number(num) || 0).toFixed(2));
}

function toFixed4(num) {
  return Number((Number(num) || 0).toFixed(4));
}

function sum(arr) {
  return (arr || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function classifyAsset(type) {
  const t = String(type || '');
  if (t.includes('债券')) return 'bond';
  if (t.includes('货币') || t.includes('现金')) return 'cash';
  return 'stock';
}

function computeAllocationByValue(funds, totalAssets) {
  const buckets = { stock: 0, bond: 0, cash: 0 };
  for (const f of funds) {
    const k = classifyAsset(f.type);
    buckets[k] += Number(f.holdValue) || 0;
  }
  if (totalAssets <= 0) return { stock: 0, bond: 0, cash: 0 };
  return {
    stock: toFixed2((buckets.stock / totalAssets) * 100),
    bond: toFixed2((buckets.bond / totalAssets) * 100),
    cash: toFixed2((buckets.cash / totalAssets) * 100),
  };
}

function computeIndustryDistribution(funds, totalAssets) {
  const buckets = new Map();
  for (const f of funds) {
    const key = String(f.industry || '未知');
    const value = Number(f.holdValue) || 0;
    buckets.set(key, (buckets.get(key) || 0) + value);
  }

  const out = {};
  if (totalAssets <= 0) return out;
  for (const [k, v] of buckets.entries()) {
    out[k] = toFixed2((v / totalAssets) * 100);
  }
  return out;
}

function inferIndustryLabel({ name, type }) {
  const n = String(name || '');
  const t = String(type || '');

  if (t.includes('QDII') || n.includes('恒生') || n.includes('港股') || n.includes('H股')) return '港股';
  if (n.includes('蓝筹')) return '蓝筹股';
  if (n.includes('中小盘') || n.includes('小盘')) return '中小盘';
  if (n.includes('白酒')) return '白酒';
  if (n.includes('新能源')) return '新能源';
  if (n.includes('医药')) return '医药';
  if (n.includes('消费')) return '消费';
  if (n.includes('科技')) return '科技';
  return '';
}

function buildFundView(holding, quote) {
  const nav = quote?.nav != null ? Number(quote.nav) : Number(holding.buyPrice) || 0;
  const change = quote?.change != null ? Number(quote.change) : 0;
  const changePercent = quote?.changePercent != null ? Number(quote.changePercent) : 0;

  const holdShares = Number(holding.holdShares) || 0;
  const buyPrice = Number(holding.buyPrice) || 0;
  const holdValue = nav * holdShares;
  const cost = buyPrice * holdShares;
  const profit = holdValue - cost;
  const profitPercent = cost ? (profit / cost) * 100 : 0;

  return {
    code: holding.code,
    name: holding.name,
    type: holding.type,
    nav: toFixed4(nav),
    change: toFixed4(change),
    changePercent: toFixed2(changePercent),
    holdShares,
    holdValue: toFixed2(holdValue),
    buyPrice: toFixed4(buyPrice),
    profit: toFixed2(profit),
    profitPercent: toFixed2(profitPercent),
    industry: holding.industry || '未知',
  };
}

function buildPortfolioSummary(holdings, quotes) {
  const funds = holdings.map((h) => buildFundView(h, quotes[h.code]));
  const totalAssets = toFixed2(sum(funds.map((f) => f.holdValue)));
  const totalProfit = toFixed2(sum(funds.map((f) => f.profit)));
  const profitRate = totalAssets ? toFixed2((totalProfit / totalAssets) * 100) : 0;

  // “今日收益”用净值变动估算：sum(shares * change)
  const todayProfit = toFixed2(
    sum(
      holdings.map((h) => {
        const q = quotes[h.code];
        return (Number(h.holdShares) || 0) * (Number(q?.change) || 0);
      })
    )
  );

  return {
    totalAssets,
    todayProfit,
    totalProfit,
    profitRate,
    funds,
    assetAllocation: computeAllocationByValue(funds, totalAssets),
    industryDistribution: computeIndustryDistribution(funds, totalAssets),
  };
}

function formatTrendLabel(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false,
    error: null,
    data: null,

    holdings: [],
    basicInfoByCode: {},
    quotes: {},

    trendRange: '30d',
    trend: { dates: [], profits: [] },
    trendLoading: false,
    trendError: null,
  }),
  actions: {
    async load(force = false) {
      this.loading = true;
      this.error = null;
      try {
        const persisted = loadDashboardHoldings();
        const hasPersistedKey =
          typeof localStorage !== 'undefined' &&
          (localStorage.getItem(DASHBOARD_STORAGE_KEY_V2) != null || localStorage.getItem(DASHBOARD_STORAGE_KEY_V1) != null);

        if (persisted.length || hasPersistedKey) {
          this.holdings = persisted;
        } else {
          const base = await getDashboardData({ force });
          this.holdings = normalizeHoldings((base?.funds || []).map((f) => ({ ...f, holdShares: f.holdShares, buyPrice: f.buyPrice })));
          saveDashboardHoldings(this.holdings);
        }

        await this.refreshBasicInfo({ force });
        await this.refreshQuotes({ force });
        this.data = buildPortfolioSummary(this.holdings, this.quotes);
        await this.loadTrend(this.trendRange, { force });
      } catch (err) {
        this.error = err;
      } finally {
        this.loading = false;
      }
    },

    async refresh() {
      await this.load(true);
    },

    async refreshBasicInfo({ force = false, fundCodes } = {}) {
      const holdings = Array.isArray(this.holdings) ? this.holdings : [];
      const codes =
        Array.isArray(fundCodes) && fundCodes.length
          ? [...new Set(fundCodes.map((c) => String(c || '').trim()).filter(Boolean))]
          : holdings.map((h) => h.code);
      if (!codes.length) return;

      const results = await Promise.allSettled(codes.map((c) => getFundBasicInfo({ fundCode: c, force })));
      const nextMap = { ...(this.basicInfoByCode || {}) };
      const nextHoldings = [...holdings];
      let holdingsChanged = false;

      results.forEach((res, idx) => {
        const code = codes[idx];
        if (!code) return;
        if (res.status === 'fulfilled') {
          nextMap[code] = res.value;
          const apiType = String(res.value?.type || '').trim();
          if (apiType) {
            const hIdx = nextHoldings.findIndex((h) => h.code === code);
            if (hIdx >= 0 && String(nextHoldings[hIdx]?.type || '').trim() !== apiType) {
              nextHoldings[hIdx] = { ...nextHoldings[hIdx], type: apiType };
              holdingsChanged = true;
            }
          }
        } else {
          logger.warn('dashboard:basicInfo failed', { fundCode: code, error: String(res.reason) });
        }
      });

      this.basicInfoByCode = nextMap;
      if (holdingsChanged) {
        this.holdings = nextHoldings;
        saveDashboardHoldings(this.holdings);
      }
    },

    async refreshQuotes({ force = false } = {}) {
      const holdings = Array.isArray(this.holdings) ? this.holdings : [];
      const results = await Promise.allSettled(holdings.map((h) => getFundQuote({ fundCode: h.code, force })));
      const next = { ...(this.quotes || {}) };

      results.forEach((res, idx) => {
        const code = holdings[idx]?.code;
        if (!code) return;
        if (res.status === 'fulfilled') {
          next[code] = res.value;
        } else {
          logger.warn('dashboard:quote failed', { fundCode: code, error: String(res.reason) });
        }
      });

      this.quotes = next;
    },

    async loadTrend(range, { force = false } = {}) {
      this.trendLoading = true;
      this.trendError = null;
      try {
        const holdings = Array.isArray(this.holdings) ? this.holdings : [];
        if (!holdings.length) {
          this.trend = { dates: [], profits: [] };
          return;
        }

        const endDate = todayStr();
        const results = await Promise.allSettled(holdings.map((h) => getFundNavHistory({ fundCode: h.code, range, endDate, force })));
        const histories = new Map();

        results.forEach((res, idx) => {
          const code = holdings[idx]?.code;
          if (!code) return;
          if (res.status === 'fulfilled') histories.set(code, res.value);
          else logger.warn('dashboard:navHistory failed', { fundCode: code, range, error: String(res.reason) });
        });

        const first = histories.values().next().value;
        const basePoints = Array.isArray(first?.points) ? first.points : [];
        if (!basePoints.length) throw new Error('No nav history points');

        const navMaps = new Map();
        for (const [code, history] of histories.entries()) {
          const m = new Map();
          for (const p of history.points || []) m.set(p.date, p.nav);
          navMaps.set(code, m);
        }

        const costTotal = sum(holdings.map((h) => (Number(h.buyPrice) || 0) * (Number(h.holdShares) || 0)));
        const profits = basePoints.map((p) => {
          const date = p.date;
          const totalValue = sum(
            holdings.map((h) => {
              const m = navMaps.get(h.code);
              const nav = m?.get(date);
              const fallback = Number(this.quotes?.[h.code]?.nav) || Number(h.buyPrice) || 0;
              return (Number(h.holdShares) || 0) * (Number(nav) || fallback);
            })
          );
          return toFixed2(totalValue - costTotal);
        });

        // 末值对齐当前累计收益（避免历史序列与摘要不一致）
        if (this.data && profits.length) {
          profits[profits.length - 1] = toFixed2(this.data.totalProfit);
        }

        this.trendRange = range;
        this.trend = {
          dates: basePoints.map((p) => formatTrendLabel(p.date)),
          profits,
        };
      } catch (err) {
        this.trendError = err;
        this.trend = { dates: [], profits: [] };
      } finally {
        this.trendLoading = false;
      }
    },

    async setTrendRange(range) {
      this.trendRange = range;
      await this.loadTrend(range);
    },

    async addFund(payload) {
      const code = String(payload?.code || '').trim();
      const name = String(payload?.name || '').trim();
      const type = String(payload?.type || '').trim() || '未知';
      const industry = String(payload?.industry || '').trim();
      const shares = Number(payload?.shares) || 0;
      const buyPrice = Number(payload?.buyPrice) || 0;
      if (!code || !name || shares <= 0 || buyPrice <= 0) return;

      const next = normalizeHolding({
        code,
        name,
        type,
        holdShares: shares,
        buyPrice,
        industry: industry || inferIndustryLabel({ name, type }) || '未知',
      });

      const idx = (this.holdings || []).findIndex((h) => h.code === code);
      if (idx >= 0) {
        const prev = this.holdings[idx];
        const totalShares = (Number(prev.holdShares) || 0) + (Number(next.holdShares) || 0);
        const totalCost =
          (Number(prev.buyPrice) || 0) * (Number(prev.holdShares) || 0) + (Number(next.buyPrice) || 0) * (Number(next.holdShares) || 0);
        const avgBuyPrice = totalShares ? totalCost / totalShares : next.buyPrice;

        this.holdings[idx] = {
          ...prev,
          name: next.name,
          type: next.type,
          industry: prev.industry || next.industry,
          holdShares: totalShares,
          buyPrice: toFixed4(avgBuyPrice),
        };
      } else {
        this.holdings = [...(this.holdings || []), next];
      }

      saveDashboardHoldings(this.holdings);
      await this.refreshBasicInfo({ force: true, fundCodes: [code] });
      await this.refreshQuotes({ force: true });
      this.data = buildPortfolioSummary(this.holdings, this.quotes);
      await this.loadTrend(this.trendRange, { force: true });
    },

    async updateHolding(payload) {
      const code = String(payload?.code || '').trim();
      if (!code) return;

      const idx = (this.holdings || []).findIndex((h) => h.code === code);
      if (idx < 0) return;

      const prev = this.holdings[idx];
      const next = normalizeHolding({
        ...prev,
        name: payload?.name != null ? String(payload.name).trim() : prev.name,
        type: payload?.type != null ? String(payload.type).trim() : prev.type,
        industry: payload?.industry != null ? String(payload.industry).trim() : prev.industry,
        holdShares: payload?.shares != null ? Number(payload.shares) : prev.holdShares,
        buyPrice: payload?.buyPrice != null ? Number(payload.buyPrice) : prev.buyPrice,
      });

      this.holdings[idx] = next;
      saveDashboardHoldings(this.holdings);
      this.data = buildPortfolioSummary(this.holdings, this.quotes);
      await this.loadTrend(this.trendRange);
    },

    async removeFund(code) {
      const fundCode = String(code || '').trim();
      if (!fundCode) return;

      const nextHoldings = (this.holdings || []).filter((h) => h.code !== fundCode);
      if (nextHoldings.length === (this.holdings || []).length) return;

      this.holdings = nextHoldings;

      const nextQuotes = { ...(this.quotes || {}) };
      delete nextQuotes[fundCode];
      this.quotes = nextQuotes;

      saveDashboardHoldings(this.holdings);
      this.data = buildPortfolioSummary(this.holdings, this.quotes);
      await this.loadTrend(this.trendRange);
    },
  },
});
