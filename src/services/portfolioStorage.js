// @ts-check

import { logger } from '../utils/logger.js';

export const DASHBOARD_STORAGE_KEY_V2 = 'dashboard:user:default:v2';
export const DASHBOARD_STORAGE_KEY_V1 = 'dashboard:user:default:v1';

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toFixed4(num) {
  return Number((Number(num) || 0).toFixed(4));
}

/**
 * @param {any} raw
 */
export function normalizeHolding(raw) {
  const code = String(raw?.code || '').trim();
  const name = String(raw?.name || '').trim();
  const type = String(raw?.type || '未知').trim() || '未知';
  const industry = String(raw?.industry || '未知').trim() || '未知';

  return {
    code,
    name,
    type,
    holdShares: Number(raw?.holdShares) || 0,
    buyPrice: toFixed4(raw?.buyPrice),
    industry,
  };
}

/**
 * @param {any} list
 */
export function normalizeHoldings(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeHolding).filter((h) => h.code && h.name && h.holdShares > 0 && h.buyPrice > 0);
}

/**
 * @param {any} holdings
 */
export function saveDashboardHoldings(holdings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      DASHBOARD_STORAGE_KEY_V2,
      JSON.stringify({
        version: 2,
        holdings: normalizeHoldings(holdings),
      })
    );
  } catch (e) {
    logger.warn('dashboard:saveHoldings failed', { error: String(e) });
  }
}

export function loadDashboardHoldings() {
  if (typeof localStorage === 'undefined') return [];

  // v2
  const v2 = safeParse(localStorage.getItem(DASHBOARD_STORAGE_KEY_V2));
  if (Array.isArray(v2?.holdings)) return normalizeHoldings(v2.holdings);
  if (Array.isArray(v2)) return normalizeHoldings(v2);

  // v1（旧版存的是完整 PortfolioSummary）
  const legacy = safeParse(localStorage.getItem(DASHBOARD_STORAGE_KEY_V1));
  if (legacy && Array.isArray(legacy.funds)) {
    const migrated = normalizeHoldings(
      legacy.funds.map((f) => ({
        code: f.code,
        name: f.name,
        type: f.type,
        holdShares: f.holdShares,
        buyPrice: f.buyPrice,
        industry: f.industry,
      }))
    );
    if (migrated.length) {
      saveDashboardHoldings(migrated);
      return migrated;
    }
  }
  return [];
}
