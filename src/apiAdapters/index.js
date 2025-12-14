// @ts-check

import { createMockAdapter } from './mockAdapter.js';

let cached = null;

export function getFundAdapter() {
  if (cached) return cached;

  const kind = String(import.meta.env?.VITE_FUND_ADAPTER || 'mock').toLowerCase();
  switch (kind) {
    case 'mock':
    default:
      cached = createMockAdapter();
      break;
  }
  return cached;
}
