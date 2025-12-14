/**
 * 基础请求封装：超时 + 错误分类 + 简单缓存/去重占位
 * 目前主要服务于未来真实 API，对 Mock 保持兼容
 */

import { logger } from '../utils/logger.js';

const pending = new Map(); // key -> promise
const cache = new Map(); // key -> { data, expireAt }

export async function request(url, { method = 'GET', headers = {}, body, timeout = 8000, cacheTTL = 0, dedupe = true } = {}) {
  const key = `${method}:${url}:${body ? JSON.stringify(body) : ''}`;

  const now = Date.now();
  if (cacheTTL > 0) {
    const hit = cache.get(key);
    if (hit && hit.expireAt > now) {
      return structuredClone(hit.data);
    }
  }

  if (dedupe && pending.has(key)) {
    return pending.get(key);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  logger.info('request:start', { url, method, cacheTTL, dedupe });

  const exec = fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err.status = res.status;
        err.body = text;
        throw err;
      }
      return res.json();
    })
    .then((json) => {
      if (cacheTTL > 0) {
        cache.set(key, { data: json, expireAt: Date.now() + cacheTTL });
      }
      return structuredClone(json);
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        const e = new Error('Request timeout');
        e.code = 'TIMEOUT';
        throw e;
      }
      logger.error(err, { url, method, status: err.status, body: err.body });
      throw err;
    })
    .finally(() => {
      pending.delete(key);
      clearTimeout(timer);
      logger.info('request:finish', { url, method });
    });

  pending.set(key, exec);
  return exec;
}
