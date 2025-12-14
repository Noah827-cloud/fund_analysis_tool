import { defineStore } from 'pinia';
import { getReportResult as fetchReportResult } from '../services/dataService.js';

const STORAGE_KEY = 'reports:user:default:v1';

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizePeriod(value) {
  const p = String(value || '').trim();
  if (p === 'week' || p === 'month' || p === 'quarter' || p === 'year') return p;
  return 'month';
}

function loadPrefs() {
  if (typeof localStorage === 'undefined') return null;
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed) return null;
  return {
    period: normalizePeriod(parsed?.period),
    dateStr: String(parsed?.dateStr || '').trim(),
  };
}

function savePrefs({ period, dateStr }) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        period: normalizePeriod(period),
        dateStr: String(dateStr || '').trim(),
      })
    );
  } catch (e) {
    console.error('saveLocal reports failed', e);
  }
}

function formatCnySigned(num) {
  const n = Number(num) || 0;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const hasDecimals = Math.round(abs * 100) % 100 !== 0;
  const formatted = abs.toLocaleString('zh-CN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
  return `${sign}¥${formatted}`;
}

function formatPctSigned(num) {
  const n = Number(num) || 0;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function buildMetricsStrings(metricsRaw) {
  const profitCny = Number(metricsRaw?.profitCny) || 0;
  const profitRatePct = Number(metricsRaw?.profitRatePct) || 0;
  const annualReturnPct = Number(metricsRaw?.annualReturnPct) || 0;
  const maxDrawdownPct = Number(metricsRaw?.maxDrawdownPct) || 0;
  const sharpeRatio = metricsRaw?.sharpeRatio == null ? null : Number(metricsRaw?.sharpeRatio);

  return {
    profit: formatCnySigned(profitCny),
    profitRate: formatPctSigned(profitRatePct),
    annualReturn: `${annualReturnPct.toFixed(2)}%`,
    maxDrawdown: `${maxDrawdownPct.toFixed(2)}%`,
    sharpeRatio: sharpeRatio == null ? '—' : sharpeRatio.toFixed(2),
  };
}

export const useReportsStore = defineStore('reports', {
  state: () => {
    const prefs = loadPrefs();
    return {
      period: prefs?.period || 'month',
      metrics: { profit: '—', profitRate: '—', annualReturn: '—', maxDrawdown: '—', sharpeRatio: '—' },
      metricsRaw: { profitCny: 0, profitRatePct: 0, annualReturnPct: 0, maxDrawdownPct: 0, sharpeRatio: null },
      series: { dates: [], dailyReturns: [], cumulativeReturns: [], funds: [], holdingsStart: [], holdingsEnd: [] },
      dateStr: prefs?.dateStr || '',
      loading: false,
      error: null,
    };
  },
  actions: {
    setDate(dateStr) {
      this.dateStr = dateStr;
      savePrefs({ period: this.period, dateStr: this.dateStr });
    },
    async setPeriod(p) {
      this.period = normalizePeriod(p);
      savePrefs({ period: this.period, dateStr: this.dateStr });
      await this.load({ period: this.period });
    },
    async load({ period, date, force = false } = {}) {
      const p = period || this.period;
      const d = date != null ? date : this.dateStr;

      this.loading = true;
      this.error = null;
      try {
        this.period = normalizePeriod(p);
        this.dateStr = d || '';
        savePrefs({ period: this.period, dateStr: this.dateStr });

        const result = await fetchReportResult({ period: this.period, date: this.dateStr || '', force });
        this.metricsRaw = result.metrics;
        this.metrics = buildMetricsStrings(result.metrics);
        this.series = {
          dates: result.series.labels,
          dailyReturns: result.series.periodReturnPct,
          cumulativeReturns: result.series.cumulativePct,
          funds: result.holdings.funds,
          holdingsStart: result.holdings.startValueCny,
          holdingsEnd: result.holdings.endValueCny,
        };
      } catch (e) {
        this.error = e;
      } finally {
        this.loading = false;
      }
    },
    getSeries() {
      return this.series;
    },
    getReportResult() {
      return {
        period: this.period,
        date: this.dateStr || '',
        metrics: this.metricsRaw,
        series: {
          labels: this.series.dates,
          periodReturnPct: this.series.dailyReturns,
          cumulativePct: this.series.cumulativeReturns,
        },
        holdings: {
          funds: this.series.funds,
          startValueCny: this.series.holdingsStart,
          endValueCny: this.series.holdingsEnd,
        },
      };
    },
  },
});
