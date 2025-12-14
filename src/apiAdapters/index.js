// @ts-check

import { createApiAdapter } from './apiAdapter.js';
import { createMockAdapter } from './mockAdapter.js';

let cached = null;

export function getFundAdapter() {
  if (cached) return cached;

  const kind = String(import.meta.env?.VITE_FUND_ADAPTER || 'mock').toLowerCase();
  switch (kind) {
    case 'api':
    case 'mock':
    default:
      cached = kind === 'api' ? createApiAdapter() : createMockAdapter();
      break;
  }
  return cached;
}
