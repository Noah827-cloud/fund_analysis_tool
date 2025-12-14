// @ts-check

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createMockAdapter, DEFAULT_ALERTS } from '../src/apiAdapters/mockAdapter.js';
import { buildAnalysisResultFromNavHistory } from './analysis.js';
import {
  getFundAssetAllocation,
  getFundBasicInfo,
  getFundGrandTotal,
  getFundIndustryConfig,
  getFundNavHistory,
  getFundQuote,
  getFundTopHoldings,
  getFundTopHoldingsComparison,
} from './eastmoney.js';
import { createAlert, deleteAlertById, initDatabase, listAlerts, seedAlertsIfEmpty, updateAlert } from './sqlite.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || '127.0.0.1');

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

const mock = createMockAdapter();

function badRequest(reply, message) {
  return reply.code(400).send({ code: 'INVALID_PARAMS', message });
}

app.get('/api/health', async () => {
  return { ok: true, time: new Date().toISOString() };
});

app.get('/api/market/basic/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundBasicInfo({ fundCode });
});

app.get('/api/market/quote/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundQuote({ fundCode });
});

app.get('/api/market/navHistory/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  const range = String(req.query?.range || '').trim();
  const endDate = req.query?.endDate ? String(req.query.endDate).trim() : undefined;
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  if (!range) return badRequest(reply, 'range is required');
  return await getFundNavHistory({ fundCode, range: /** @type {any} */ (range), endDate });
});

app.get('/api/market/industryConfig/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundIndustryConfig({ fundCode });
});

app.get('/api/market/assetAllocation/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundAssetAllocation({ fundCode });
});

app.get('/api/market/topHoldings/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundTopHoldings({ fundCode });
});

app.get('/api/market/topHoldingsCompare/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundTopHoldingsComparison({ fundCode });
});

app.get('/api/market/grandTotal/:fundCode', async (req, reply) => {
  const fundCode = String(req.params?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await getFundGrandTotal({ fundCode });
});

app.get('/api/portfolio/summary', async () => {
  return await mock.getPortfolioSummary();
});

app.get('/api/analysis', async (req, reply) => {
  const fundCode = String(req.query?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  const horizonRaw = String(req.query?.horizon || '1y').trim();
  return await buildAnalysisResultFromNavHistory({ fundCode, horizon: /** @type {any} */ (horizonRaw) });
});

app.get('/api/reports', async (req, reply) => {
  const period = String(req.query?.period || '').trim();
  const date = String(req.query?.date || '').trim();
  if (!period) return badRequest(reply, 'period is required');
  return await mock.getReportResult({ period: /** @type {any} */ (period), date });
});

app.get('/api/alerts', async () => {
  return await listAlerts();
});

app.post('/api/alerts', async (req, reply) => {
  const body = req.body || {};
  const fundCode = String(body?.fundCode || '').trim();
  if (!fundCode) return badRequest(reply, 'fundCode is required');
  return await createAlert(body);
});

app.patch('/api/alerts/:id', async (req, reply) => {
  const id = String(req.params?.id || '').trim();
  if (!id) return badRequest(reply, 'id is required');
  return await updateAlert(id, req.body || {});
});

app.delete('/api/alerts/:id', async (req, reply) => {
  const id = String(req.params?.id || '').trim();
  if (!id) return badRequest(reply, 'id is required');
  const ok = await deleteAlertById(id);
  return ok;
});

app.post('/api/chat/complete', async (req, reply) => {
  const body = req.body || {};
  const message = String(body?.message || '').trim();
  if (!message) return badRequest(reply, 'message is required');
  return await mock.chatComplete({ message, history: Array.isArray(body?.history) ? body.history : undefined });
});

async function start() {
  await initDatabase();
  await seedAlertsIfEmpty(DEFAULT_ALERTS);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API ready: http://${HOST}:${PORT}`);
}

await start();
