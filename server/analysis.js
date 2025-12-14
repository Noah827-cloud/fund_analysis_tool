// @ts-check

import { getFundNavHistory, getFundSimilarRanking } from './eastmoney.js';

function toFixed2(num) {
  return Number((Number(num) || 0).toFixed(2));
}

function toFixed4(num) {
  return Number((Number(num) || 0).toFixed(4));
}

function sum(arr) {
  return (arr || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function stddev(arr) {
  if (!arr.length) return 0;
  const mean = sum(arr) / arr.length;
  const variance = sum(arr.map((v) => Math.pow(v - mean, 2))) / arr.length;
  return Math.sqrt(variance);
}

function ymdToMs(ymd) {
  const raw = String(ymd || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return NaN;
  return Date.UTC(y, mo - 1, d);
}

function horizonToRange(horizon) {
  const h = String(horizon || '').trim().toLowerCase();
  if (h === '3y') return '3y';
  if (h === 'since') return 'since';
  return '1y';
}

function computeDrawdownsFromNav(points) {
  let peakNav = Number(points?.[0]?.nav) || 0;
  const drawdowns = [];
  let maxDrawdownPct = 0;
  for (const p of points || []) {
    const nav = Number(p?.nav) || 0;
    if (nav > peakNav) peakNav = nav;
    const dd = peakNav > 0 ? (nav / peakNav) * 100 - 100 : 0;
    const ddFixed = toFixed2(dd);
    drawdowns.push(ddFixed);
    if (ddFixed < maxDrawdownPct) maxDrawdownPct = ddFixed;
  }
  return { drawdowns, maxDrawdownPct: toFixed2(maxDrawdownPct) };
}

function computeMaxDrawdownRecoveryDays(points) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) return null;

  let peakNav = Number(list[0]?.nav) || 0;

  let maxDrawdown = 0;
  let troughIdx = null;
  let peakNavAtMax = peakNav;

  for (let i = 0; i < list.length; i++) {
    const nav = Number(list[i]?.nav) || 0;
    if (nav > peakNav) {
      peakNav = nav;
      continue;
    }
    if (peakNav <= 0) continue;
    const dd = nav / peakNav - 1; // negative decimal
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
      troughIdx = i;
      peakNavAtMax = peakNav;
    }
  }

  if (troughIdx == null) return 0;

  for (let j = troughIdx; j < list.length; j++) {
    const nav = Number(list[j]?.nav) || 0;
    if (nav >= peakNavAtMax) {
      const t1 = ymdToMs(list[troughIdx]?.date);
      const t2 = ymdToMs(list[j]?.date);
      if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
      return Math.max(0, Math.round((t2 - t1) / (24 * 60 * 60 * 1000)));
    }
  }

  return null;
}

function buildMonthlyReturns(dailyReturns, targetTotalPct) {
  const days = dailyReturns.length;
  const months = 12;
  const base = Math.floor(days / months);
  const remainder = days - base * months;
  const monthly = [];
  let idx = 0;
  for (let m = 0; m < months; m++) {
    const len = m < remainder ? base + 1 : base;
    monthly.push(toFixed2(sum(dailyReturns.slice(idx, idx + len))));
    idx += len;
  }
  const diff = toFixed2((Number(targetTotalPct) || 0) - sum(monthly));
  if (monthly.length) monthly[monthly.length - 1] = toFixed2(monthly[monthly.length - 1] + diff);
  return monthly;
}

/**
 * @param {{ fundCode: string, horizon?: '1y'|'3y'|'since' }} params
 * @returns {Promise<import('../src/contracts/types.js').AnalysisResult>}
 */
export async function buildAnalysisResultFromNavHistory(params) {
  const code = String(params?.fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const range = /** @type {import('../src/contracts/types.js').FundHistoryRange} */ (horizonToRange(params?.horizon));
  const [history, similar] = await Promise.all([getFundNavHistory({ fundCode: code, range }), getFundSimilarRanking({ fundCode: code })]);
  const points = Array.isArray(history?.points) ? history.points : [];
  if (points.length < 2) throw new Error('Not enough nav history points');

  const last = points[points.length - 1];
  const lastCumulative = toFixed2(Number(last?.cumulativePct) || 0);
  const lastReturn = toFixed2(Number(last?.returnPct) || 0);
  const nav = toFixed4(Number(last?.nav) || 0);

  const dailyRates = points
    .slice(1)
    .map((p, idx) => {
      const prev = Number(points[idx]?.nav) || 0;
      const curr = Number(p?.nav) || 0;
      if (!prev || !curr) return null;
      return curr / prev - 1; // decimal
    })
    .filter((v) => Number.isFinite(v) && v != null);

  const sd = stddev(dailyRates);
  const mean = dailyRates.length ? sum(dailyRates) / dailyRates.length : 0;
  const sharpeRatio = sd === 0 ? null : toFixed2((mean / sd) * Math.sqrt(252));
  const volatilityPct = toFixed2(sd * Math.sqrt(252) * 100);

  const { drawdowns, maxDrawdownPct } = computeDrawdownsFromNav(points);
  const maxDrawdownRecoveryDays = computeMaxDrawdownRecoveryDays(points);

  const fundCumulativePct = points.map((p) => toFixed2(Number(p?.cumulativePct) || 0));
  const benchmarkCumulativePct = fundCumulativePct.map((v) => toFixed2(v * 0.8));
  const dailyReturnPct = dailyRates.map((r) => toFixed2((Number(r) || 0) * 100));
  const monthlyReturnPct = buildMonthlyReturns(dailyReturnPct, lastCumulative);

  return {
    fundCode: code,
    metrics: {
      nav,
      navChangePct: lastReturn,
      yearReturnPct: lastCumulative,
      sharpeRatio,
      maxDrawdownPct,
      volatilityPct,
      maxDrawdownRecoveryDays,
      similarRank: similar?.rank ?? null,
      similarTotal: similar?.total ?? null,
      similarPercentile: similar?.percentile ?? null,
    },
    series: {
      dates: points.map((p) => String(p.date || '')),
      fundCumulativePct,
      benchmarkCumulativePct,
      drawdownPct: drawdowns,
      monthlyReturnPct,
    },
  };
}
