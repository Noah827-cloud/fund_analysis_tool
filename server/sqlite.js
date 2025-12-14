// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDbPath = path.join(rootDir, 'server', 'data.sqlite');

let SQL = null;
let db = null;
let dbPath = defaultDbPath;
let writeQueue = Promise.resolve();

function locateWasm(file) {
  return path.join(rootDir, 'node_modules', 'sql.js', 'dist', file);
}

async function ensureSqlJs() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: locateWasm,
  });
  return SQL;
}

function exec(sql) {
  if (!db) throw new Error('DB not initialized');
  db.exec(sql);
}

async function persist() {
  if (!db) return;
  const data = db.export();
  const tmp = `${dbPath}.tmp`;
  await fs.writeFile(tmp, Buffer.from(data));
  await fs.rename(tmp, dbPath);
}

function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

function ensureMigrations() {
  exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      fundCode TEXT NOT NULL,
      fundName TEXT NOT NULL,
      type TEXT NOT NULL,
      condition TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastTriggered TEXT
    );
  `);
}

function readRows(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

export async function initDatabase(options = {}) {
  const nextPath = String(options?.dbPath || defaultDbPath);
  dbPath = nextPath;

  await ensureSqlJs();

  try {
    const buf = await fs.readFile(dbPath);
    db = new SQL.Database(new Uint8Array(buf));
  } catch {
    db = new SQL.Database();
  }

  ensureMigrations();
  await enqueueWrite(persist);
  return db;
}

export async function getDatabase() {
  if (db) return db;
  await initDatabase();
  return db;
}

export async function listAlerts() {
  await getDatabase();
  const rows = readRows(
    `SELECT id, fundCode, fundName, type, condition, targetValue, currentValue, unit, status, createdAt, lastTriggered
     FROM alerts
     ORDER BY createdAt DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    fundCode: r.fundCode,
    fundName: r.fundName,
    type: r.type,
    condition: r.condition,
    targetValue: Number(r.targetValue),
    currentValue: Number(r.currentValue),
    unit: r.unit,
    status: r.status,
    createdAt: r.createdAt,
    lastTriggered: r.lastTriggered ? String(r.lastTriggered) : null,
  }));
}

function randomCurrentValue(type, unit) {
  if (unit === 'amount') return Number((1 + Math.random() * 5).toFixed(2));
  if (type === 'nav' || type === 'price') return Number((0.8 + Math.random() * 4.5).toFixed(2));
  return Number((Math.random() * 30 - 10).toFixed(2));
}

export async function seedAlertsIfEmpty(defaultAlerts) {
  await getDatabase();
  const count = readRows('SELECT COUNT(1) as cnt FROM alerts')[0]?.cnt ?? 0;
  if (Number(count) > 0) return;

  await enqueueWrite(async () => {
    for (const a of defaultAlerts || []) {
      run(
        `INSERT INTO alerts
         (id, fundCode, fundName, type, condition, targetValue, currentValue, unit, status, createdAt, lastTriggered)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(a.id),
          String(a.fundCode),
          String(a.fundName),
          String(a.type),
          String(a.condition),
          Number(a.targetValue) || 0,
          Number(a.currentValue) || 0,
          String(a.unit),
          String(a.status),
          String(a.createdAt),
          a.lastTriggered ? String(a.lastTriggered) : null,
        ]
      );
    }
    await persist();
  });
}

export async function createAlert(payload) {
  await getDatabase();
  const now = new Date().toLocaleString('zh-CN');

  const id = String(Date.now());
  const fundCode = String(payload?.fundCode || '').trim();
  const fundName = String(payload?.fundName || '').trim() || fundCode;
  const type = payload?.type === 'loss' || payload?.type === 'price' || payload?.type === 'nav' ? payload.type : 'profit';
  const condition = payload?.condition === 'below' ? 'below' : 'above';
  const unit = payload?.unit === 'amount' ? 'amount' : 'percent';
  const targetValue = Number(payload?.targetValue) || 0;
  const currentValue = randomCurrentValue(type, unit);
  const status = 'active';

  const row = {
    id,
    fundCode,
    fundName,
    type,
    condition,
    targetValue: Number(targetValue.toFixed(2)),
    currentValue,
    unit,
    status,
    createdAt: now,
    lastTriggered: null,
  };

  await enqueueWrite(async () => {
    run(
      `INSERT INTO alerts
       (id, fundCode, fundName, type, condition, targetValue, currentValue, unit, status, createdAt, lastTriggered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.fundCode,
        row.fundName,
        row.type,
        row.condition,
        row.targetValue,
        row.currentValue,
        row.unit,
        row.status,
        row.createdAt,
        row.lastTriggered,
      ]
    );
    await persist();
  });

  return row;
}

export async function updateAlert(id, patch) {
  await getDatabase();
  const rows = readRows('SELECT * FROM alerts WHERE id = ?', [String(id)]);
  if (!rows.length) throw new Error('Alert not found');
  const prev = rows[0];

  const next = {
    id: String(prev.id),
    fundCode: String(patch?.fundCode ?? prev.fundCode),
    fundName: String(patch?.fundName ?? prev.fundName),
    type: String(patch?.type ?? prev.type),
    condition: String(patch?.condition ?? prev.condition),
    targetValue: Number(patch?.targetValue ?? prev.targetValue),
    currentValue: Number(patch?.currentValue ?? prev.currentValue),
    unit: String(patch?.unit ?? prev.unit),
    status: String(patch?.status ?? prev.status),
    createdAt: String(prev.createdAt),
    lastTriggered: patch?.lastTriggered != null ? String(patch.lastTriggered) : prev.lastTriggered != null ? String(prev.lastTriggered) : null,
  };

  await enqueueWrite(async () => {
    run(
      `UPDATE alerts SET
        fundCode = ?,
        fundName = ?,
        type = ?,
        condition = ?,
        targetValue = ?,
        currentValue = ?,
        unit = ?,
        status = ?,
        lastTriggered = ?
       WHERE id = ?`,
      [
        next.fundCode,
        next.fundName,
        next.type,
        next.condition,
        Number(next.targetValue),
        Number(next.currentValue),
        next.unit,
        next.status,
        next.lastTriggered,
        next.id,
      ]
    );
    await persist();
  });

  return {
    ...next,
    targetValue: Number(Number(next.targetValue).toFixed(2)),
    currentValue: Number(Number(next.currentValue).toFixed(2)),
  };
}

export async function deleteAlertById(id) {
  await getDatabase();
  const before = readRows('SELECT COUNT(1) as cnt FROM alerts WHERE id = ?', [String(id)])[0]?.cnt ?? 0;
  if (!Number(before)) return false;

  await enqueueWrite(async () => {
    run('DELETE FROM alerts WHERE id = ?', [String(id)]);
    await persist();
  });
  return true;
}

