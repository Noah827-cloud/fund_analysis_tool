// @ts-check

import { mockDashboard } from '../services/mockData.js';

/**
 * @typedef {import('../contracts/types.js').PortfolioSummary} PortfolioSummary
 * @typedef {import('../contracts/types.js').FundBasicInfo} FundBasicInfo
 * @typedef {import('../contracts/types.js').FundIndustryConfig} FundIndustryConfig
 * @typedef {import('../contracts/types.js').FundTopHoldings} FundTopHoldings
 * @typedef {import('../contracts/types.js').FundTopHoldingsComparison} FundTopHoldingsComparison
 * @typedef {import('../contracts/types.js').FundAssetAllocation} FundAssetAllocation
 * @typedef {import('../contracts/types.js').FundGrandTotal} FundGrandTotal
 * @typedef {import('../contracts/types.js').FundQuote} FundQuote
 * @typedef {import('../contracts/types.js').FundHistoryRange} FundHistoryRange
 * @typedef {import('../contracts/types.js').NavHistory} NavHistory
 * @typedef {import('../contracts/types.js').AnalysisResult} AnalysisResult
 * @typedef {import('../contracts/types.js').ReportResult} ReportResult
 * @typedef {import('../contracts/types.js').Alert} Alert
 * @typedef {import('../contracts/types.js').ChatMessage} ChatMessage
 * @typedef {import('./baseAdapter.js').FundAdapter} FundAdapter
 */

const SEED_MAP = {
  '001071': 1,
  '003834': 2,
  '005827': 3,
  161725: 4,
  110011: 5,
};

function toFixed2(num) {
  return Number((Number(num) || 0).toFixed(2));
}

function sum(arr) {
  return arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
}

const ALERTS_STORAGE_KEY = 'alerts:user:default:v1';

/** @type {Alert[]} */
export const DEFAULT_ALERTS = [
  {
    id: 1,
    fundName: '华夏恒生ETF联接A',
    fundCode: '001071',
    type: 'profit',
    condition: 'above',
    targetValue: 10,
    currentValue: 6.95,
    unit: 'percent',
    status: 'active',
    createdAt: '2025-01-15 10:30',
    lastTriggered: null,
  },
  {
    id: 2,
    fundName: '华夏能源革新股票A',
    fundCode: '003834',
    type: 'profit',
    condition: 'above',
    targetValue: 15,
    currentValue: 18.5,
    unit: 'percent',
    status: 'triggered',
    createdAt: '2025-01-10 14:20',
    lastTriggered: '2025-01-22 09:15',
  },
  {
    id: 3,
    fundName: '易方达蓝筹精选混合',
    fundCode: '005827',
    type: 'loss',
    condition: 'below',
    targetValue: -5,
    currentValue: 4.9,
    unit: 'percent',
    status: 'active',
    createdAt: '2025-01-08 16:45',
    lastTriggered: null,
  },
  {
    id: 4,
    fundName: '招商中证白酒指数A',
    fundCode: '161725',
    type: 'profit',
    condition: 'above',
    targetValue: 20,
    currentValue: 6.95,
    unit: 'percent',
    status: 'paused',
    createdAt: '2025-01-05 11:30',
    lastTriggered: null,
  },
  {
    id: 5,
    fundName: '易方达中小盘混合',
    fundCode: '110011',
    type: 'nav',
    condition: 'above',
    targetValue: 4.5,
    currentValue: 4.12,
    unit: 'amount',
    status: 'active',
    createdAt: '2025-01-03 13:20',
    lastTriggered: null,
  },
];

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {any} raw
 * @param {number} idx
 * @returns {Alert|null}
 */
function normalizeAlert(raw, idx) {
  const fundCode = String(raw?.fundCode || '').trim();
  const fundName = String(raw?.fundName || '').trim();
  if (!fundCode) return null;

  const type = raw?.type === 'loss' || raw?.type === 'price' || raw?.type === 'nav' ? raw.type : 'profit';
  const condition = raw?.condition === 'below' ? 'below' : 'above';
  const unit = raw?.unit === 'amount' ? 'amount' : 'percent';
  const status = raw?.status === 'paused' || raw?.status === 'triggered' ? raw.status : 'active';
  const createdAt = String(raw?.createdAt || '').trim() || new Date().toLocaleString('zh-CN');
  const lastTriggered = raw?.lastTriggered ? String(raw.lastTriggered) : null;

  return {
    id: raw?.id ?? idx + 1,
    fundCode,
    fundName: fundName || fundCode,
    type,
    condition,
    targetValue: toFixed2(raw?.targetValue),
    currentValue: toFixed2(raw?.currentValue),
    unit,
    status,
    createdAt,
    lastTriggered,
  };
}

/**
 * @param {any} raw
 * @returns {Alert[]}
 */
function normalizeAlerts(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.alerts) ? raw.alerts : null;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAlert).filter(Boolean);
}

/**
 * @returns {Alert[]|null}
 */
function loadAlertsLocal() {
  if (typeof localStorage === 'undefined') return null;
  const parsed = safeParse(localStorage.getItem(ALERTS_STORAGE_KEY));
  const alerts = normalizeAlerts(parsed);
  return alerts.length ? alerts : null;
}

/**
 * @param {Alert[]} alerts
 */
function saveAlertsLocal(alerts) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(normalizeAlerts(alerts)));
  } catch {}
}

function randomCurrentValue(type, unit) {
  if (unit === 'amount') return toFixed2(1 + Math.random() * 5);
  if (type === 'nav' || type === 'price') return toFixed2(0.8 + Math.random() * 4.5);
  return toFixed2(Math.random() * 30 - 10);
}

const AI_RESPONSES = {
  分析我的持仓: `根据您的持仓情况，我为您分析如下：

🎯 **持仓概览**
• 总资产：¥258,750
• 总收益：¥15,850 (6.53%)
• 持有基金：5只

📊 **配置分析**
• 股票型基金：65% (偏高)
• 债券型基金：25% (适中)
• 货币型基金：10% (偏低)

⚠️ **风险提示**
股票型基金占比较高，建议适当增加债券基金配置以平衡风险。

💡 **优化建议**
1. 考虑增加10-15%的债券基金
2. 港股基金占比较高，注意汇率风险
3. 新能源基金表现良好，可继续持有`,
  市场趋势如何: `📈 **市场趋势分析**

🌟 **整体市场**
• A股市场：震荡向上，结构性机会明显
• 港股市场：估值修复中，关注政策变化
• 美股市场：高位震荡，注意回调风险

🏭 **板块机会**
• 新能源：政策支持，长期看好
• 科技板块：创新驱动，精选个股
• 消费板块：复苏确定，估值合理
• 医药板块：创新药机会，关注集采政策

💰 **投资策略**
建议采用定投策略，分散投资风险，关注优质基金的长期表现。`,
  推荐优质基金: `🏆 **优质基金推荐**

📊 **股票型基金**
• 易方达蓝筹精选混合 (005827)
  - 近1年收益：+18.45%
  - 基金经理经验丰富
  - 适合长期持有

• 华夏能源革新股票A (003834)
  - 近1年收益：+22.31%
  - 新能源主题，政策受益
  - 波动较大，注意风险

📈 **指数型基金**
• 华夏恒生ETF联接A (001071)
  - 港股投资，估值较低
  - 分散化投资工具
  - 适合定投

💎 **债券型基金**
• 易方达安心回报债券A (110027)
  - 稳健收益，波动较小
  - 适合风险厌恶型投资者
  - 可作为资产配置的稳定器

⚠️ **投资提醒**
基金投资有风险，建议根据个人风险承受能力选择合适的产品。`,
  风险评估: `🔍 **投资风险评估**

📊 **您的风险等级：R3 (中等风险)**

📈 **当前组合分析**
• 年化波动率：18.56%
• 最大回撤：-8.45%
• 夏普比率：1.25

⚠️ **主要风险点**
1. 股票型基金占比较高(65%)
2. 港股基金受汇率影响
3. 行业集中度偏高

🛡️ **风险控制建议**
1. 增加债券基金配置至35%
2. 分散投资不同市场
3. 设置止损线(建议-10%)
4. 定期调整资产配置

📅 **风险管理策略**
• 每月审视投资组合
• 季度调整资产配置
• 年度重新评估风险承受能力`,
  止盈建议: `💰 **止盈策略建议**

🎯 **目标收益法**
• 建议止盈线：+15%
• 当前最高收益基金：+6.95%
• 距离止盈线还有空间

📈 **分批止盈法**
建议当基金收益达到以下水平时：
• 收益+10%：止盈20%
• 收益+15%：止盈30%
• 收益+20%：止盈50%

⏰ **时间止盈法**
• 持有时间超过2年且收益为正
• 市场环境发生重大变化
• 基金基本面恶化

🔔 **当前建议**
1. 招商中证白酒指数A：收益6.95%，可继续持有
2. 易方达蓝筹精选混合：收益4.90%，观察市场
3. 华夏能源革新股票A：收益4.73%，关注政策

⚠️ **止盈提醒**
止盈不止损，建议设置自动提醒功能。`,
};

function getChatResponseText(text) {
  const q = String(text || '').trim();
  if (!q) return '请先输入问题，我会尽力为你分析。';

  if (q.includes('持仓') || q.includes('分析')) return AI_RESPONSES['分析我的持仓'];
  if (q.includes('市场') || q.includes('趋势')) return AI_RESPONSES['市场趋势如何'];
  if (q.includes('推荐') || q.includes('基金')) return AI_RESPONSES['推荐优质基金'];
  if (q.includes('风险') || q.includes('评估')) return AI_RESPONSES['风险评估'];
  if (q.includes('止盈') || q.includes('卖出')) return AI_RESPONSES['止盈建议'];

  return `我理解您的问题，让我为您分析一下：

🤖 **AI分析中**

我正在分析您的投资组合和市场数据，基于最新的市场信息和您的持仓情况，为您提供个性化的投资建议。

💡 **建议**
您可以尝试以下问题：
• 分析我的持仓
• 市场趋势如何
• 推荐优质基金
• 风险评估
• 止盈建议`;
}

function stddev(arr) {
  if (!arr.length) return 0;
  const mean = sum(arr) / arr.length;
  const variance = sum(arr.map((v) => Math.pow(v - mean, 2))) / arr.length;
  return Math.sqrt(variance);
}

function hashTo32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeCumulativeFromReturns(returns) {
  const cumulative = [0];
  for (let i = 0; i < returns.length; i++) {
    cumulative.push(toFixed2(cumulative[cumulative.length - 1] + returns[i]));
  }
  return cumulative;
}

function computeDrawdowns(cumulative) {
  let peak = cumulative[0] || 0;
  const drawdowns = [];
  let maxDrawdown = 0;
  for (const v of cumulative) {
    peak = Math.max(peak, v);
    const dd = toFixed2(v - peak);
    drawdowns.push(dd);
    maxDrawdown = Math.min(maxDrawdown, dd);
  }
  return { drawdowns, maxDrawdown: toFixed2(maxDrawdown) };
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
  const diff = toFixed2(targetTotalPct - sum(monthly));
  if (monthly.length) monthly[monthly.length - 1] = toFixed2(monthly[monthly.length - 1] + diff);
  return monthly;
}

function getFundMeta(fundCode) {
  const seed = SEED_MAP[fundCode] || 1;
  const baseNav = 1.2 + seed * 0.05;
  const targetYearReturnPct = toFixed2(8 + seed * 3);

  const fund = (mockDashboard?.funds || []).find((f) => f.code === fundCode);
  return {
    seed,
    baseNav,
    targetYearReturnPct,
    name: fund?.name || `基金${fundCode}`,
    type: fund?.type || '混合型',
  };
}

function buildDailyReturns({ fundCode, days, targetTotalPct }) {
  const rng = mulberry32(hashTo32(`${fundCode}|${days}|${targetTotalPct}`));
  const drift = targetTotalPct / days;
  const seed = SEED_MAP[fundCode] || 1;
  const amplitude = 0.9 + seed * 0.1;

  const raw = [];
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    const edge = Math.sin(progress * Math.PI);
    const noise = (rng() - 0.5) * 2 * amplitude * edge + Math.sin((i + seed * 13) / 18) * 0.18;
    raw.push(drift + noise);
  }

  const daily = raw.map((v) => toFixed2(v));
  const diff = toFixed2(targetTotalPct - sum(daily));
  daily[daily.length - 1] = toFixed2(daily[daily.length - 1] + diff);
  return daily;
}

function buildAnalysisResultForFund(fundCode) {
  const { targetYearReturnPct, baseNav } = getFundMeta(fundCode);
  const days = 365;

  // 每日收益（%）确定性生成，并强制总和=targetYearReturnPct
  const dailyReturns = buildDailyReturns({ fundCode, days, targetTotalPct: targetYearReturnPct });

  const fundCumulative = computeCumulativeFromReturns(dailyReturns);
  fundCumulative[fundCumulative.length - 1] = targetYearReturnPct;

  const benchmarkEnd = toFixed2(targetYearReturnPct * 0.8);
  const benchmarkCumulative = fundCumulative.map((v, idx) => (idx === fundCumulative.length - 1 ? benchmarkEnd : toFixed2(v * 0.8)));

  const { drawdowns, maxDrawdown } = computeDrawdowns(fundCumulative);

  const sd = stddev(dailyReturns);
  const mean = dailyReturns.length ? sum(dailyReturns) / dailyReturns.length : 0;
  const sharpeRatio = sd === 0 ? null : toFixed2((mean / sd) * Math.sqrt(252));

  const monthlyReturnPct = buildMonthlyReturns(dailyReturns, targetYearReturnPct);

  const dates = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
  }

  const lastDaily = dailyReturns[dailyReturns.length - 1] || 0;

  /** @type {AnalysisResult} */
  const result = {
    fundCode,
    metrics: {
      nav: Number(baseNav.toFixed(4)),
      navChangePct: Number(lastDaily.toFixed(2)),
      yearReturnPct: targetYearReturnPct,
      sharpeRatio: sharpeRatio == null ? null : Number(sharpeRatio.toFixed(2)),
      maxDrawdownPct: maxDrawdown,
    },
    series: {
      dates,
      fundCumulativePct: fundCumulative,
      benchmarkCumulativePct: benchmarkCumulative,
      drawdownPct: drawdowns,
      monthlyReturnPct,
    },
  };

  return result;
}

/**
 * @param {string} fundCode
 * @returns {FundBasicInfo}
 */
function buildFundBasicInfo(fundCode) {
  const { seed, name, type } = getFundMeta(fundCode);
  const inception = new Date(Date.now() - 365 * (3 + seed) * 24 * 60 * 60 * 1000);

  return {
    fundCode,
    name,
    type,
    inceptionDate: inception.toISOString().slice(0, 10),
    company: seed % 2 === 0 ? '示例基金公司' : '示例资产管理',
    riskLevel: seed <= 2 ? '中' : seed <= 4 ? '中高' : '高',
    tags: ['mock', 'demo'],
  };
}

/**
 * @param {string} fundCode
 * @returns {FundIndustryConfig}
 */
function buildFundIndustryConfig(fundCode) {
  return {
    fundCode,
    asOfDate: '',
    industries: [],
    source: 'mock',
  };
}

/**
 * @param {string} fundCode
 * @returns {FundQuote}
 */
function buildFundQuote(fundCode) {
  const analysis = buildAnalysisResultForFund(fundCode);
  const nav = Number(analysis.metrics.nav) || 0;
  const changePercent = Number(analysis.metrics.navChangePct) || 0;
  const change = Number((nav * (changePercent / 100)).toFixed(4));
  const today = new Date().toISOString().slice(0, 10);

  return {
    fundCode,
    nav: Number(nav.toFixed(4)),
    navDate: today,
    change,
    changePercent: Number(changePercent.toFixed(2)),
    updatedAt: new Date().toISOString(),
    source: 'mock',
  };
}

/**
 * @param {{ fundCode: string, range: FundHistoryRange, endDate?: string }} params
 * @returns {NavHistory}
 */
function buildNavHistory({ fundCode, range, endDate }) {
  const { baseNav, targetYearReturnPct } = getFundMeta(fundCode);

  const daysMap = { '30d': 30, '90d': 90, '1y': 365, '3y': 365 * 3, since: 365 * 5 };
  const days = daysMap[range] || 365;

  const targetTotalPct =
    range === '1y'
      ? targetYearReturnPct
      : range === '3y'
        ? toFixed2(targetYearReturnPct * 3 * 0.85)
        : range === 'since'
          ? toFixed2(targetYearReturnPct * 5 * 0.75)
          : toFixed2(targetYearReturnPct * (days / 365));

  const dailyReturns = buildDailyReturns({ fundCode, days, targetTotalPct });
  const cumulative = computeCumulativeFromReturns(dailyReturns); // days+1

  const navStart = baseNav / (1 + targetTotalPct / 100);
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();

  const points = [];
  for (let i = 0; i <= days; i++) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (days - i));
    const cumulativePct = cumulative[i] || 0;
    const nav = navStart * (1 + cumulativePct / 100);
    points.push({
      date: date.toISOString().slice(0, 10),
      nav: Number(nav.toFixed(4)),
      returnPct: i === 0 ? 0 : dailyReturns[i - 1] || 0,
      cumulativePct,
    });
  }

  return { fundCode, range, points };
}

const REPORT_TARGETS = {
  week: { profitCny: 3250, profitRatePct: 5.67, annualReturnPct: 12.34, maxDrawdownPct: -2.15, sharpeRatio: 1.85 },
  month: { profitCny: 12450, profitRatePct: 18.23, annualReturnPct: 15.67, maxDrawdownPct: -4.32, sharpeRatio: 1.92 },
  quarter: { profitCny: 28750, profitRatePct: 35.12, annualReturnPct: 18.45, maxDrawdownPct: -6.78, sharpeRatio: 2.01 },
  year: { profitCny: 58320, profitRatePct: 68.45, annualReturnPct: 22.31, maxDrawdownPct: -8.45, sharpeRatio: 2.15 },
};

const REPORT_AXES = {
  week: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  month: ['第1周', '第2周', '第3周', '第4周'],
  quarter: ['1月', '2月', '3月'],
  year: ['Q1', 'Q2', 'Q3', 'Q4'],
};

const REPORT_RETURN_PATTERNS = {
  week: [1.2, -0.8, 2.1, 0.5, -1.1, 1.8, 0.3],
  month: [2.5, -1.2, 3.1, 1.4],
  quarter: [4.2, -2.5, 3.8],
  year: [6.5, -3.2, 4.9, 5.1],
};

const BASE_HOLDING_WEIGHTS = [60000, 70000, 45000, 38000, 60000];
const BASE_FUND_NAMES = ['华夏恒生ETF', '华夏能源革新', '易方达蓝筹', '招商中证白酒', '易方达中小盘'];

function computeCumulativeSeries(values) {
  const cumulative = [];
  for (let i = 0; i < values.length; i++) {
    const prev = cumulative[i - 1] || 0;
    cumulative.push(toFixed2(prev + values[i]));
  }
  return cumulative;
}

function scalePatternToTarget(pattern, targetPct) {
  const target = toFixed2(targetPct);
  const baseSum = sum(pattern);
  if (!baseSum) {
    const equal = pattern.map(() => 0);
    if (equal.length) equal[equal.length - 1] = target;
    return equal;
  }
  const factor = target / baseSum;
  const scaled = pattern.map((v) => toFixed2(v * factor));
  const diff = toFixed2(target - sum(scaled));
  if (scaled.length) scaled[scaled.length - 1] = toFixed2(scaled[scaled.length - 1] + diff);
  return scaled;
}

function buildHoldings(baseAssets, profit) {
  const startTotal = Math.max(0, Number(baseAssets) || 0);
  const profitAmt = Number(profit) || 0;
  const weights = BASE_HOLDING_WEIGHTS.map((v) => v / sum(BASE_HOLDING_WEIGHTS));

  const start = weights.map((w) => Math.round(startTotal * w));
  if (start.length) start[start.length - 1] += Math.round(startTotal) - sum(start);

  const end = start.map((v, idx) => Math.round(v + profitAmt * weights[idx]));
  const targetEnd = Math.round(startTotal + profitAmt);
  if (end.length) end[end.length - 1] += targetEnd - sum(end);

  return { start, end };
}

function buildReportResult(period, date) {
  const targets = REPORT_TARGETS[period] || REPORT_TARGETS.month;
  const labels = REPORT_AXES[period] || REPORT_AXES.month;

  const profit = Number(targets.profitCny) || 0;
  const profitRatePct = Number(targets.profitRatePct) || 0;
  const profitRateRatio = profitRatePct / 100;

  // 反推期初资产，让摘要收益与持仓变化一致
  const baseAssets = profitRateRatio !== 0 ? profit / profitRateRatio : 100000;

  const pattern = REPORT_RETURN_PATTERNS[period] || REPORT_RETURN_PATTERNS.month;
  const periodReturnPct = scalePatternToTarget(pattern, profitRatePct);
  const cumulativePct = computeCumulativeSeries(periodReturnPct);

  const holdings = buildHoldings(baseAssets, profit);

  /** @type {ReportResult} */
  const result = {
    period,
    date: date || '',
    metrics: {
      profitCny: profit,
      profitRatePct: toFixed2(profitRatePct),
      annualReturnPct: toFixed2(targets.annualReturnPct),
      maxDrawdownPct: toFixed2(targets.maxDrawdownPct),
      sharpeRatio: targets.sharpeRatio == null ? null : toFixed2(targets.sharpeRatio),
    },
    series: {
      labels,
      periodReturnPct,
      cumulativePct,
    },
    holdings: {
      funds: [...BASE_FUND_NAMES],
      startValueCny: holdings.start,
      endValueCny: holdings.end,
    },
  };

  return result;
}

/**
 * @returns {FundAdapter}
 */
export function createMockAdapter() {
  return {
    async getPortfolioSummary() {
      /** @type {PortfolioSummary} */
      const data = JSON.parse(JSON.stringify(mockDashboard));
      return data;
    },
    async getFundBasicInfo({ fundCode }) {
      return buildFundBasicInfo(fundCode);
    },
    async getFundIndustryConfig({ fundCode }) {
      return buildFundIndustryConfig(fundCode);
    },
    async getFundTopHoldings({ fundCode }) {
      /** @type {FundTopHoldings} */
      const data = { fundCode: String(fundCode || '').trim(), asOfDate: '', holdings: [], source: 'mock' };
      return data;
    },
    async getFundTopHoldingsComparison({ fundCode }) {
      /** @type {FundTopHoldingsComparison} */
      const data = {
        fundCode: String(fundCode || '').trim(),
        current: { asOfDate: '', holdings: [] },
        previous: { asOfDate: '', holdings: [] },
        changes: { added: [], removed: [], changed: [] },
        source: 'mock',
      };
      return data;
    },
    async getFundAssetAllocation({ fundCode }) {
      /** @type {FundAssetAllocation} */
      const data = { fundCode: String(fundCode || '').trim(), asOfDate: '', quarters: [], source: 'mock' };
      return data;
    },
    async getFundGrandTotal({ fundCode }) {
      /** @type {FundGrandTotal} */
      const data = { fundCode: String(fundCode || '').trim(), startDate: '', endDate: '', series: [], source: 'mock' };
      return data;
    },
    async getFundQuote({ fundCode }) {
      return buildFundQuote(fundCode);
    },
    async getFundNavHistory({ fundCode, range, endDate }) {
      return buildNavHistory({ fundCode, range, endDate });
    },
    async getAnalysisResult({ fundCode }) {
      return buildAnalysisResultForFund(fundCode);
    },
    async getReportResult({ period, date }) {
      return buildReportResult(period, date);
    },
    async getAlerts() {
      const local = loadAlertsLocal();
      return JSON.parse(JSON.stringify(local || DEFAULT_ALERTS));
    },
    async createAlert({ fundCode, fundName, type, condition, targetValue, unit }) {
      const existing = loadAlertsLocal() || JSON.parse(JSON.stringify(DEFAULT_ALERTS));

      const normalizedType = type === 'loss' || type === 'price' || type === 'nav' ? type : 'profit';
      const normalizedUnit = unit === 'amount' ? 'amount' : 'percent';

      /** @type {Alert} */
      const created = {
        id: Date.now(),
        fundCode: String(fundCode || '').trim(),
        fundName: String(fundName || '').trim() || String(fundCode || '').trim(),
        type: normalizedType,
        condition: condition === 'below' ? 'below' : 'above',
        targetValue: toFixed2(targetValue),
        currentValue: randomCurrentValue(normalizedType, normalizedUnit),
        unit: normalizedUnit,
        status: 'active',
        createdAt: new Date().toLocaleString('zh-CN'),
        lastTriggered: null,
      };

      existing.push(created);
      saveAlertsLocal(existing);
      return JSON.parse(JSON.stringify(created));
    },
    async updateAlert({ id, patch }) {
      const existing = loadAlertsLocal() || JSON.parse(JSON.stringify(DEFAULT_ALERTS));
      const idx = existing.findIndex((a) => String(a.id) === String(id));
      if (idx < 0) throw new Error('Alert not found');

      const prev = existing[idx];
      const next = normalizeAlert({ ...prev, ...(patch || {}) }, idx) || prev;
      existing[idx] = next;
      saveAlertsLocal(existing);
      return JSON.parse(JSON.stringify(next));
    },
    async deleteAlert({ id }) {
      const existing = loadAlertsLocal() || JSON.parse(JSON.stringify(DEFAULT_ALERTS));
      const next = existing.filter((a) => String(a.id) !== String(id));
      if (next.length === existing.length) return false;
      saveAlertsLocal(next);
      return true;
    },

    async chatComplete({ message }) {
      /** @type {ChatMessage} */
      const reply = {
        id: Date.now(),
        sender: 'ai',
        text: getChatResponseText(message),
      };
      return JSON.parse(JSON.stringify(reply));
    },
  };
}
