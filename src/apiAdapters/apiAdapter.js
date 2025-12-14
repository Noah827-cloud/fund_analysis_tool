// @ts-check

import { request } from '../services/request.js';

/**
 * @typedef {import('./baseAdapter.js').FundAdapter} FundAdapter
 */

function apiBase() {
  const raw = import.meta.env?.VITE_API_BASE_URL || '/api';
  return String(raw).replace(/\/$/, '');
}

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * @returns {FundAdapter}
 */
export function createApiAdapter() {
  const base = apiBase();
  return {
    async getPortfolioSummary() {
      return await request(`${base}/portfolio/summary`, { cacheTTL: 2_000 });
    },

    async getFundBasicInfo({ fundCode }) {
      return await request(`${base}/market/basic/${encodeURIComponent(String(fundCode || '').trim())}`, { cacheTTL: 12 * 60 * 60 * 1000 });
    },

    async getFundIndustryConfig({ fundCode }) {
      return await request(`${base}/market/industryConfig/${encodeURIComponent(String(fundCode || '').trim())}`, {
        cacheTTL: 12 * 60 * 60 * 1000,
      });
    },

    async getFundTopHoldings({ fundCode }) {
      return await request(`${base}/market/topHoldings/${encodeURIComponent(String(fundCode || '').trim())}`, {
        cacheTTL: 12 * 60 * 60 * 1000,
      });
    },

    async getFundTopHoldingsComparison({ fundCode }) {
      return await request(`${base}/market/topHoldingsCompare/${encodeURIComponent(String(fundCode || '').trim())}`, {
        cacheTTL: 12 * 60 * 60 * 1000,
      });
    },

    async getFundAssetAllocation({ fundCode }) {
      return await request(`${base}/market/assetAllocation/${encodeURIComponent(String(fundCode || '').trim())}`, {
        cacheTTL: 24 * 60 * 60 * 1000,
      });
    },

    async getFundGrandTotal({ fundCode }) {
      return await request(`${base}/market/grandTotal/${encodeURIComponent(String(fundCode || '').trim())}`, { cacheTTL: 60 * 60 * 1000 });
    },

    async getFundQuote({ fundCode }) {
      return await request(`${base}/market/quote/${encodeURIComponent(String(fundCode || '').trim())}`, { cacheTTL: 25_000 });
    },

    async getFundNavHistory({ fundCode, range, endDate }) {
      return await request(`${base}/market/navHistory/${encodeURIComponent(String(fundCode || '').trim())}${qs({ range, endDate })}`, {
        cacheTTL: 5 * 60 * 1000,
      });
    },

    async getAnalysisResult({ fundCode, horizon }) {
      return await request(`${base}/analysis${qs({ fundCode, horizon })}`, { cacheTTL: 30_000 });
    },

    async getReportResult({ period, date }) {
      return await request(`${base}/reports${qs({ period, date })}`, { cacheTTL: 30_000 });
    },

    async getAlerts() {
      return await request(`${base}/alerts`, { cacheTTL: 2_000 });
    },

    async createAlert({ fundCode, fundName, type, condition, targetValue, unit }) {
      return await request(`${base}/alerts`, {
        method: 'POST',
        body: { fundCode, fundName, type, condition, targetValue, unit },
      });
    },

    async updateAlert({ id, patch }) {
      return await request(`${base}/alerts/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: patch || {},
      });
    },

    async deleteAlert({ id }) {
      return await request(`${base}/alerts/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      });
    },

    async chatComplete({ message, history }) {
      return await request(`${base}/chat/complete`, {
        method: 'POST',
        body: { message, history },
      });
    },
  };
}
