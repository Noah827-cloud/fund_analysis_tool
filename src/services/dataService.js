import { logger } from '../utils/logger.js';
import { getFundAdapter } from '../apiAdapters/index.js';

// 简单的内存缓存（按键存储 { data, expireAt }）
const cache = new Map();
const DEFAULT_TTL = 10 * 1000; // 10 秒缓存

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expireAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, { data, expireAt: Date.now() + ttl });
}

// 模拟网络延迟
function delay(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyRandomFluctuation(data) {
  const next = clone(data);
  // 模拟今日收益、净值小幅波动
  next.todayProfit = +(next.todayProfit + (Math.random() - 0.5) * 200).toFixed(2);
  next.totalProfit = +(next.totalProfit + (Math.random() - 0.5) * 500).toFixed(2);
  next.profitRate = +((next.totalProfit / next.totalAssets) * 100).toFixed(2);

  next.funds = next.funds.map((fund) => {
    const delta = (Math.random() - 0.5) * 0.02;
    const nav = fund.nav + delta;
    const change = delta;
    const changePercent = (change / fund.nav) * 100;
    const holdValue = nav * fund.holdShares;
    const profit = holdValue - fund.buyPrice * fund.holdShares;
    const profitPercent = (profit / (fund.buyPrice * fund.holdShares)) * 100;

    return {
      ...fund,
      nav: +nav.toFixed(4),
      change: +change.toFixed(4),
      changePercent: +changePercent.toFixed(2),
      holdValue: +holdValue.toFixed(2),
      profit: +profit.toFixed(2),
      profitPercent: +profitPercent.toFixed(2),
    };
  });

  return next;
}

/**
 * 获取仪表盘数据（模拟接口，可扩展为真实 API）
 * @param {Object} options
 * @param {boolean} options.force 是否跳过缓存
 */
export async function getDashboardData(options = {}) {
  const { force = false } = options;
  const cacheKey = 'dashboard';

  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:dashboard cache hit');
      return clone(hit);
    }
  }

  await delay(150);
  const adapter = getFundAdapter();
  const base = await adapter.getPortfolioSummary({ force });
  const fresh = applyRandomFluctuation(base);
  cacheSet(cacheKey, fresh);
  logger.info('dataService:dashboard fetch success');
  return clone(fresh);
}

/**
 * 手动刷新（跳过缓存）
 */
export async function refreshDashboardData() {
  return getDashboardData({ force: true });
}

/**
 * 获取业绩分析结果（Mock/真实 API 可切换）
 * @param {{ fundCode: string, horizon?: '1y'|'3y'|'since', force?: boolean }} params
 */
export async function getAnalysisResult(params) {
  const { fundCode, horizon = '1y', force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `analysis:${fundCode}:${horizon}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:analysis cache hit', { fundCode, horizon });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getAnalysisResult({ fundCode, horizon });
  cacheSet(cacheKey, fresh, 30 * 1000);
  logger.info('dataService:analysis fetch success', { fundCode, horizon });
  return clone(fresh);
}

/**
 * 获取总结报告结果（Mock/真实 API 可切换）
 * @param {{ period: 'week'|'month'|'quarter'|'year', date: string, force?: boolean }} params
 */
export async function getReportResult(params) {
  const { period, date, force = false } = params || {};
  if (!period) throw new Error('period is required');

  const cacheKey = `reports:${period}:${date || ''}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:reports cache hit', { period, date });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getReportResult({ period, date: date || '' });
  cacheSet(cacheKey, fresh, 30 * 1000);
  logger.info('dataService:reports fetch success', { period, date });
  return clone(fresh);
}

/**
 * 获取基金基础信息（Mock/真实 API 可切换）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundBasicInfo(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:basic:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundBasic cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundBasicInfo({ fundCode });
  cacheSet(cacheKey, fresh, 24 * 60 * 60 * 1000);
  logger.info('dataService:fundBasic fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金行业配置（F10 行业配置，按季度）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundIndustryConfig(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:industryConfig:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundIndustryConfig cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundIndustryConfig({ fundCode });
  cacheSet(cacheKey, fresh, 12 * 60 * 60 * 1000);
  logger.info('dataService:fundIndustryConfig fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金重仓股票（F10 持仓明细 TopN，按季度）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundTopHoldings(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:topHoldings:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundTopHoldings cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundTopHoldings({ fundCode });
  cacheSet(cacheKey, fresh, 12 * 60 * 60 * 1000);
  logger.info('dataService:fundTopHoldings fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金重仓股票季度对比（新增/移除/占比变化）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundTopHoldingsComparison(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:topHoldingsCompare:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundTopHoldingsCompare cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(150);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundTopHoldingsComparison({ fundCode });
  cacheSet(cacheKey, fresh, 12 * 60 * 60 * 1000);
  logger.info('dataService:fundTopHoldingsCompare fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金资产配置（按季度）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundAssetAllocation(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:assetAllocation:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundAssetAllocation cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(150);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundAssetAllocation({ fundCode });
  cacheSet(cacheKey, fresh, 24 * 60 * 60 * 1000);
  logger.info('dataService:fundAssetAllocation fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取同类平均/基准指数对比序列（近阶段）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundGrandTotal(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:grandTotal:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundGrandTotal cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(150);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundGrandTotal({ fundCode });
  cacheSet(cacheKey, fresh, 60 * 60 * 1000);
  logger.info('dataService:fundGrandTotal fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金最新行情（Mock/真实 API 可切换）
 * @param {{ fundCode: string, force?: boolean }} params
 */
export async function getFundQuote(params) {
  const { fundCode, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  const cacheKey = `fund:quote:${fundCode}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundQuote cache hit', { fundCode });
      return clone(hit);
    }
  }

  await delay(120);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundQuote({ fundCode });
  cacheSet(cacheKey, fresh, 60 * 1000);
  logger.info('dataService:fundQuote fetch success', { fundCode });
  return clone(fresh);
}

/**
 * 获取基金历史净值与收益序列（Mock/真实 API 可切换）
 * @param {{ fundCode: string, range: '30d'|'90d'|'1y'|'3y'|'since', endDate?: string, force?: boolean }} params
 */
export async function getFundNavHistory(params) {
  const { fundCode, range, endDate, force = false } = params || {};
  if (!fundCode) throw new Error('fundCode is required');
  if (!range) throw new Error('range is required');

  const cacheKey = `fund:navHistory:${fundCode}:${range}:${endDate || ''}`;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:fundNavHistory cache hit', { fundCode, range, endDate });
      return clone(hit);
    }
  }

  await delay(150);
  const adapter = getFundAdapter();
  const fresh = await adapter.getFundNavHistory({ fundCode, range, endDate });
  cacheSet(cacheKey, fresh, 10 * 60 * 1000);
  logger.info('dataService:fundNavHistory fetch success', { fundCode, range, endDate });
  return clone(fresh);
}

/**
 * 获取提醒列表（Mock/真实 API 可切换）
 * @param {{ force?: boolean }} options
 */
export async function getAlerts(options = {}) {
  const { force = false } = options || {};
  const cacheKey = 'alerts';

  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      logger.info('dataService:alerts cache hit');
      return clone(hit);
    }
  }

  await delay(80);
  const adapter = getFundAdapter();
  const fresh = await adapter.getAlerts({ force });
  cacheSet(cacheKey, fresh, 5 * 1000);
  logger.info('dataService:alerts fetch success');
  return clone(fresh);
}

/**
 * 创建提醒（Mock/真实 API 可切换）
 * @param {{ fundCode: string, fundName: string, type: import('../contracts/types.js').Alert['type'], condition: import('../contracts/types.js').Alert['condition'], targetValue: number, unit: import('../contracts/types.js').Alert['unit'] }} params
 */
export async function createAlert(params) {
  const { fundCode, fundName, type, condition, targetValue, unit } = params || {};
  if (!fundCode) throw new Error('fundCode is required');

  await delay(80);
  const adapter = getFundAdapter();
  const created = await adapter.createAlert({ fundCode, fundName: fundName || fundCode, type, condition, targetValue, unit });
  cache.delete('alerts');
  logger.info('dataService:alerts create success', { fundCode });
  return clone(created);
}

/**
 * 更新提醒（Mock/真实 API 可切换）
 * @param {{ id: string|number, patch: Partial<import('../contracts/types.js').Alert> }} params
 */
export async function updateAlert(params) {
  const { id, patch } = params || {};
  if (id == null) throw new Error('id is required');

  await delay(80);
  const adapter = getFundAdapter();
  const updated = await adapter.updateAlert({ id, patch: patch || {} });
  cache.delete('alerts');
  logger.info('dataService:alerts update success', { id });
  return clone(updated);
}

/**
 * 删除提醒（Mock/真实 API 可切换）
 * @param {{ id: string|number }} params
 */
export async function deleteAlert(params) {
  const { id } = params || {};
  if (id == null) throw new Error('id is required');

  await delay(80);
  const adapter = getFundAdapter();
  const ok = await adapter.deleteAlert({ id });
  cache.delete('alerts');
  logger.info('dataService:alerts delete success', { id, ok });
  return ok;
}

/**
 * Chat completion（Mock/真实 API 可切换）
 * @param {{ message: string, history?: import('../contracts/types.js').ChatMessage[] }} params
 */
export async function chatComplete(params) {
  const { message, history } = params || {};
  if (!message) throw new Error('message is required');

  await delay(120);
  const adapter = getFundAdapter();
  const reply = await adapter.chatComplete({ message, history });
  logger.info('dataService:chat complete success');
  return clone(reply);
}
