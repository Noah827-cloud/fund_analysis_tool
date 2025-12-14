// @ts-check

const PINGZHONG_BASE = 'https://fund.eastmoney.com/pingzhongdata';
const FUNDGZ_BASE = 'https://fundgz.1234567.com.cn/js';
const F10_BASE = 'https://fundf10.eastmoney.com/jbgk_';
const F10_API_BASE = 'https://api.fund.eastmoney.com/f10';
const F10_ARCHIVES_BASE = 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx';

const cache = new Map(); // key -> { data, expireAt }
const pending = new Map(); // key -> Promise

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expireAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expireAt: Date.now() + ttlMs });
}

async function dedupe(key, fn) {
  if (pending.has(key)) return pending.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

async function fetchText(url, { timeoutMs = 10_000, headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OKComputer-FundDashboard/0.1 (+local dev)',
        Accept: '*/*',
        ...(headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Upstream HTTP ${res.status} ${res.statusText}`);
      // @ts-expect-error attach extra
      err.status = res.status;
      // @ts-expect-error attach extra
      err.body = text;
      throw err;
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripBom(text) {
  if (!text) return text;
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function stripTags(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDateText(text) {
  const raw = String(text || '');
  const m1 = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const m = String(m1[2]).padStart(2, '0');
    const d = String(m1[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const m2 = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m2) {
    const y = m2[1];
    const m = String(m2[2]).padStart(2, '0');
    const d = String(m2[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

function inferRiskLevelFromType(type) {
  const t = String(type || '');
  if (!t) return '';
  if (t.includes('货币')) return '低';
  if (t.includes('债券') && !t.includes('股票')) return '中';
  if (t.includes('混合')) return '中高';
  if (t.includes('QDII')) return '高';
  if (t.includes('股票') || t.includes('指数')) return '高';
  return '';
}

function extractVarString(text, varName) {
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*\\"([^\\"]*)\\";`);
  const m = text.match(re);
  return m ? m[1] : null;
}

function extractVarJsonLiteral(text, varName) {
  const needle = `var ${varName}`;
  const idx = text.indexOf(needle);
  if (idx < 0) return null;
  const eq = text.indexOf('=', idx);
  if (eq < 0) return null;

  let start = -1;
  for (let i = eq; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '{') {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function toFixed2(num) {
  return Number((Number(num) || 0).toFixed(2));
}

function toFixed4(num) {
  return Number((Number(num) || 0).toFixed(4));
}

function msToYmd(ms) {
  const date = new Date(Number(ms) || 0);
  try {
    // Eastmoney 的时间戳按中国时区（UTC+8）表示“净值日期”，用 UTC 直接 toISOString 会出现 -1 天的偏差。
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD
  } catch {
    // 兜底：按 UTC+8 偏移计算日期
    return new Date((Number(ms) || 0) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

function rangeToDays(range) {
  switch (String(range || '').toLowerCase()) {
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    case '3y':
      return 365 * 3;
    case 'since':
      return Infinity;
    default:
      return 30;
  }
}

async function getPingZhongData(fundCode) {
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `pingzhong:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const raw = await getPingZhongRaw(code);

    const name = extractVarString(raw, 'fS_name') || code;
    const fSCode = extractVarString(raw, 'fS_code') || code;

    const trendLiteral = extractVarJsonLiteral(raw, 'Data_netWorthTrend');
    if (!trendLiteral) throw new Error('Upstream missing Data_netWorthTrend');
    /** @type {any[]} */
    const parsedTrend = JSON.parse(trendLiteral);

    const points = parsedTrend
      .map((p) => ({
        ms: Number(p?.x),
        nav: Number(p?.y),
      }))
      .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.nav) && p.nav > 0)
      .sort((a, b) => a.ms - b.ms);

    const data = { fundCode: fSCode, name, points };
    cacheSet(cacheKey, data, 60 * 60 * 1000);
    return data;
  });
}

async function getPingZhongRaw(fundCode) {
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `pingzhongRaw:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const url = `${PINGZHONG_BASE}/${encodeURIComponent(code)}.js?v=${Date.now()}`;
    const raw = stripBom(await fetchText(url, { timeoutMs: 15_000 }));
    cacheSet(cacheKey, raw, 60 * 60 * 1000);
    return raw;
  });
}

async function getF10Basic(fundCode) {
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `f10:jbgk:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const url = `${F10_BASE}${encodeURIComponent(code)}.html`;
    const html = await fetchText(url, { timeoutMs: 15_000 });

    const tableMatch = html.match(/<table[^>]*class="info\s+w790"[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) throw new Error('Upstream missing F10 basic table');
    const tableHtml = tableMatch[1];

    const map = new Map();
    const re = /<th>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)(?=<th>|<\/tr>|<\/table>)/gi;
    let m;
    while ((m = re.exec(tableHtml))) {
      const key = stripTags(m[1]);
      const value = stripTags(m[2]);
      if (key) map.set(key, value);
    }

    const shortName = map.get('基金简称') || '';
    const fullName = map.get('基金全称') || '';
    const type = map.get('基金类型') || '';
    const company = map.get('基金管理人') || '';
    const inceptionRaw = map.get('成立日期/规模') || map.get('成立日期') || '';
    const inceptionDate = normalizeDateText(inceptionRaw);
    const benchmark = map.get('业绩比较基准') || '';
    const trackIndex = map.get('跟踪标的') || '';

    const riskLevel = inferRiskLevelFromType(type);

    const tags = [];
    if (trackIndex) tags.push(trackIndex);
    if (benchmark) tags.push(benchmark);
    if (fullName && !tags.includes(fullName)) tags.push(fullName);

    const data = {
      shortName,
      fullName,
      type,
      company,
      inceptionDate,
      riskLevel,
      tags,
    };

    cacheSet(cacheKey, data, 12 * 60 * 60 * 1000);
    return data;
  });
}

/**
 * @param {{ fundCode: string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundBasicInfo>}
 */
export async function getFundBasicInfo(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `basic:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await getPingZhongData(code);

  /** @type {any} */
  let f10 = null;
  try {
    f10 = await getF10Basic(code);
  } catch {
    f10 = null;
  }

  /** @type {import('../src/contracts/types.js').FundBasicInfo} */
  const info = {
    fundCode: data.fundCode,
    name: data.name,
    type: f10?.type ? String(f10.type).trim() : undefined,
    inceptionDate: f10?.inceptionDate ? String(f10.inceptionDate).trim() : undefined,
    company: f10?.company ? String(f10.company).trim() : undefined,
    riskLevel: f10?.riskLevel ? String(f10.riskLevel).trim() : undefined,
    tags: Array.isArray(f10?.tags) && f10.tags.length ? f10.tags : undefined,
  };

  cacheSet(cacheKey, info, 12 * 60 * 60 * 1000);
  return info;
}

function parseJsonp(text) {
  const trimmed = String(text || '').trim();
  const m = trimmed.match(/^jsonpgz\((.*)\);?$/);
  if (!m) throw new Error('Invalid JSONP response');
  return JSON.parse(m[1]);
}

function safeNumber(val) {
  if (val == null) return null;
  const num = Number(String(val).replace('%', '').trim());
  return Number.isFinite(num) ? num : null;
}

function stripNumberText(text) {
  return String(text || '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();
}

function parseJsStringValue(text, startIndex) {
  let out = '';
  let esc = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      if (ch === 'n') out += '\n';
      else if (ch === 'r') out += '\r';
      else if (ch === 't') out += '\t';
      else out += ch;
      esc = false;
      continue;
    }
    if (ch === '\\\\') {
      esc = true;
      continue;
    }
    if (ch === '"') return { value: out, end: i + 1 };
    out += ch;
  }
  return { value: out, end: text.length };
}

function extractApidataContent(jsText) {
  const raw = String(jsText || '');
  const idx = raw.indexOf('content:"');
  if (idx < 0) return '';
  const start = idx + 'content:"'.length;
  return parseJsStringValue(raw, start).value;
}

function parseTopHoldingsTableInnerHtml(tableHtml) {
  const theadMatch = String(tableHtml || '').match(/<thead>([\s\S]*?)<\/thead>/i);
  const headerCells = theadMatch
    ? [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1]).replace(/\s+/g, ''))
    : [];
  const idxCode = headerCells.findIndex((t) => t.includes('股票代码'));
  const idxName = headerCells.findIndex((t) => t.includes('股票名称'));
  const idxWeight = headerCells.findIndex((t) => t.replace(/\s+/g, '').includes('占净值比例'));
  const idxShares = headerCells.findIndex((t) => t.replace(/\s+/g, '').includes('持股数'));
  const idxValue = headerCells.findIndex((t) => t.replace(/\s+/g, '').includes('持仓市值'));

  const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const tbody = tbodyMatch ? tbodyMatch[1] : '';
  const rowHtmls = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);

  const holdings = [];
  for (const row of rowHtmls) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    const stockCode = idxCode >= 0 ? String(cells[idxCode] || '').trim() : '';
    const stockName = idxName >= 0 ? String(cells[idxName] || '').trim() : '';
    if (!stockCode || !stockName) continue;

    const weightPct = idxWeight >= 0 ? safeNumber(stripNumberText(cells[idxWeight])) ?? 0 : 0;
    const sharesWan = idxShares >= 0 ? safeNumber(stripNumberText(cells[idxShares])) ?? 0 : 0;
    const marketValueWan = idxValue >= 0 ? safeNumber(stripNumberText(cells[idxValue])) ?? 0 : 0;

    holdings.push({
      stockCode,
      stockName,
      weightPct: toFixed2(weightPct),
      sharesWan: toFixed2(sharesWan),
      marketValueWan: toFixed2(marketValueWan),
    });
  }

  return holdings;
}

function quarterEndDateFromYearMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return '';

  const qm = m <= 3 ? 3 : m <= 6 ? 6 : m <= 9 ? 9 : 12;
  const qd = qm === 3 ? 31 : qm === 12 ? 31 : 30;
  return `${String(y)}-${String(qm).padStart(2, '0')}-${String(qd).padStart(2, '0')}`;
}

function parseTopHoldingsFromHtml(html, { targetAsOfDate } = {}) {
  const content = String(html || '');

  /** @type {{ asOfDate: string, holdings: any[] }[]} */
  const blocks = [];
  const re =
    /截止至：<font[^>]*>(\d{4}-\d{2}-\d{2})<\/font>[\s\S]*?<table[^>]*class=['"][^'"]*tzxq[^'"]*['"][^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(content))) {
    const asOfDate = m[1];
    const tableHtml = m[2];
    blocks.push({ asOfDate, holdings: parseTopHoldingsTableInnerHtml(tableHtml) });
  }

  if (!blocks.length) {
    const asOfMatch = content.match(/截止至：<font[^>]*>(\d{4}-\d{2}-\d{2})<\/font>/);
    const asOfDate = asOfMatch ? asOfMatch[1] : '';
    const tableMatch = content.match(/<table[^>]*class=['"][^'"]*tzxq[^'"]*['"][^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return { asOfDate, holdings: [] };
    return { asOfDate, holdings: parseTopHoldingsTableInnerHtml(tableMatch[1]) };
  }

  const target = String(targetAsOfDate || '').trim();
  if (target) {
    const hit = blocks.find((b) => b.asOfDate === target);
    if (hit) return hit;
  }

  // 兜底：选最新季度
  blocks.sort((a, b) => String(a.asOfDate).localeCompare(String(b.asOfDate)));
  return blocks[blocks.length - 1];
}

/**
 * @param {{ fundCode: string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundQuote>}
 */
export async function getFundQuote(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `quote:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    // 用 pingzhongdata 的“最新净值”作为官方净值（与历史序列同源），避免 fundgz 的 dwjz/gsz 与页面显示不一致。
    const pz = await getPingZhongData(code);
    const pts = pz.points || [];
    if (!pts.length) throw new Error('Upstream missing net worth points');

    const last = pts[pts.length - 1];
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;

    const nav = Number(last?.nav) || 0;
    const navDate = msToYmd(last?.ms);
    const prevNav = prev ? Number(prev?.nav) || 0 : 0;

    const change = prevNav ? nav - prevNav : 0;
    const changePercent = prevNav ? (nav / prevNav) * 100 - 100 : 0;

    let estimatedNav;
    let estimatedChangePercent;
    let source = 'eastmoney:pingzhongdata';

    try {
      const url = `${FUNDGZ_BASE}/${encodeURIComponent(code)}.js?rt=${Date.now()}`;
      const raw = await fetchText(url, { timeoutMs: 8_000 });
      const json = parseJsonp(raw);
      const gsz = json?.gsz != null ? Number(json.gsz) : null;
      if (gsz != null && Number.isFinite(gsz) && gsz > 0) {
        estimatedNav = toFixed4(gsz);
        estimatedChangePercent = toFixed2(Number(json?.gszzl) || 0);
        source = 'eastmoney:pingzhongdata+fundgz';
      }
    } catch {
      // 上游估值失败时不影响官方净值展示
    }

    /** @type {import('../src/contracts/types.js').FundQuote} */
    const quote = {
      fundCode: code,
      nav: toFixed4(nav),
      navDate,
      change: toFixed4(change),
      changePercent: toFixed2(changePercent),
      updatedAt: new Date().toISOString(),
      source,
      estimatedNav: estimatedNav != null ? estimatedNav : undefined,
      estimatedChangePercent: estimatedChangePercent != null ? estimatedChangePercent : undefined,
    };

    cacheSet(cacheKey, quote, 30 * 1000);
    return quote;
  });
}

/**
 * @param {{ fundCode: string, range: import('../src/contracts/types.js').FundHistoryRange, endDate?: string }} params
 * @returns {Promise<import('../src/contracts/types.js').NavHistory>}
 */
export async function getFundNavHistory(params) {
  const { fundCode, range, endDate } = params || {};
  const code = String(fundCode || '').trim();
  const r = String(range || '').trim();
  if (!code) throw new Error('fundCode is required');
  if (!r) throw new Error('range is required');

  const cacheKey = `navHistory:${code}:${r}:${String(endDate || '')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await getPingZhongData(code);
  const rawPoints = data.points;
  if (!rawPoints.length) throw new Error('No net worth points');

  const lastMs = rawPoints[rawPoints.length - 1].ms;
  const endMs = endDate ? Date.parse(`${endDate}T23:59:59.999+08:00`) : lastMs;
  const days = rangeToDays(r);
  const minMs = Number.isFinite(days) ? endMs - days * 24 * 60 * 60 * 1000 : -Infinity;

  const sliced = rawPoints.filter((p) => p.ms <= endMs && p.ms >= minMs);
  if (!sliced.length) throw new Error('No points in range');

  const startNav = sliced[0].nav;
  let prevNav = startNav;

  const points = sliced.map((p, idx) => {
    const nav = p.nav;
    const returnPct = idx === 0 ? 0 : prevNav ? ((nav / prevNav) * 100 - 100) : 0;
    const cumulativePct = startNav ? ((nav / startNav) * 100 - 100) : 0;
    prevNav = nav;
    return {
      date: msToYmd(p.ms),
      nav: toFixed4(nav),
      returnPct: toFixed2(returnPct),
      cumulativePct: toFixed2(cumulativePct),
    };
  });

  /** @type {import('../src/contracts/types.js').NavHistory} */
  const history = {
    fundCode: code,
    range: /** @type {any} */ (r),
    points,
  };

  cacheSet(cacheKey, history, 5 * 60 * 1000);
  return history;
}

/**
 * 基金行业配置（F10 行业配置：按季度）
 * @param {{ fundCode: string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundIndustryConfig>}
 */
export async function getFundIndustryConfig(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `industryConfig:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const url = `${F10_API_BASE}/HYPZ/?fundCode=${encodeURIComponent(code)}&year=`;
    const referer = `https://fundf10.eastmoney.com/hytz_${encodeURIComponent(code)}.html`;

    /** @type {any} */
    let json = null;
    try {
      json = JSON.parse(
        await fetchText(url, {
          timeoutMs: 15_000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: referer,
          },
        })
      );
    } catch (e) {
      const err = new Error('Upstream industry config parse failed');
      // @ts-expect-error attach extra
      err.cause = e;
      throw err;
    }

    const errCode = safeNumber(json?.ErrCode);
    if (errCode != null && errCode !== 0) {
      const err = new Error(`Upstream industry config error: ${String(json?.ErrMsg || errCode)}`);
      // @ts-expect-error attach extra
      err.code = errCode;
      throw err;
    }

    const quarterInfos = Array.isArray(json?.Data?.QuarterInfos) ? json.Data.QuarterInfos : [];
    const latest = quarterInfos.find((q) => q && (Array.isArray(q.HYPZInfo) ? q.HYPZInfo.length : true)) || null;
    const asOfDate = String(latest?.JZRQ || latest?.HYPZInfo?.[0]?.FSRQ || '').trim();
    const list = Array.isArray(latest?.HYPZInfo) ? latest.HYPZInfo : [];

    const industries = list
      .map((row) => ({
        name: String(row?.HYMC || '').trim(),
        pct: safeNumber(row?.ZJZBL) ?? safeNumber(row?.ZJZBLDesc) ?? 0,
      }))
      .filter((i) => i.name)
      .sort((a, b) => b.pct - a.pct);

    /** @type {import('../src/contracts/types.js').FundIndustryConfig} */
    const out = {
      fundCode: code,
      asOfDate,
      industries,
      source: 'eastmoney:f10:HYPZ',
    };

    cacheSet(cacheKey, out, 12 * 60 * 60 * 1000);
    return out;
  });
}

/**
 * 基金重仓股票（按季披露，TopN）
 * @param {{ fundCode: string, topline?: number, year?: number|string, month?: number|string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundTopHoldings>}
 */
export async function getFundTopHoldings(params) {
  const { fundCode, topline = 10, year, month } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `topHoldings:${code}:${String(topline || 10)}:${String(year || '')}:${String(month || '')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const y = year != null ? String(year).trim() : '';
    const m = month != null ? String(month).trim() : '';
    const targetAsOfDate = y && m ? quarterEndDateFromYearMonth(y, m) : '';
    const rt = Math.random();
    const url = `${F10_ARCHIVES_BASE}?type=jjcc&code=${encodeURIComponent(code)}&topline=${encodeURIComponent(String(topline || 10))}&year=${encodeURIComponent(
      y
    )}&month=${encodeURIComponent(m)}&rt=${rt}`;

    const jsText = await fetchText(url, {
      timeoutMs: 15_000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: `https://fundf10.eastmoney.com/ccmx_${encodeURIComponent(code)}.html`,
      },
    });

    const html = extractApidataContent(jsText);
    const parsed = parseTopHoldingsFromHtml(html, { targetAsOfDate });
    const limit = Math.max(1, Number(topline) || 10);
    const holdings = Array.isArray(parsed?.holdings) ? parsed.holdings.slice(0, limit) : [];

    /** @type {import('../src/contracts/types.js').FundTopHoldings} */
    const out = {
      fundCode: code,
      asOfDate: parsed.asOfDate,
      holdings,
      source: 'eastmoney:f10:FundArchivesDatas:jjcc',
    };

    cacheSet(cacheKey, out, 12 * 60 * 60 * 1000);
    return out;
  });
}

/**
 * 同类排名（来自 pingzhongdata）
 * @param {{ fundCode: string }} params
 * @returns {Promise<{ fundCode: string, asOfDate: string, rank: number|null, total: number|null, percentile: number|null, source?: string }>}
 */
export async function getFundSimilarRanking(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `similarRanking:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const raw = await getPingZhongRaw(code);

    let rank = null;
    let total = null;
    let percentile = null;
    let asOfDate = '';

    try {
      const rankLiteral = extractVarJsonLiteral(raw, 'Data_rateInSimilarType');
      if (rankLiteral) {
        /** @type {any[]} */
        const list = JSON.parse(rankLiteral);
        const last = Array.isArray(list) && list.length ? list[list.length - 1] : null;
        const ms = safeNumber(last?.x);
        asOfDate = ms != null ? msToYmd(ms) : '';
        rank = safeNumber(last?.y);
        total = safeNumber(last?.sc);
      }

      const percentLiteral = extractVarJsonLiteral(raw, 'Data_rateInSimilarPersent');
      if (percentLiteral) {
        /** @type {any[]} */
        const list = JSON.parse(percentLiteral);
        const last = Array.isArray(list) && list.length ? list[list.length - 1] : null;
        const ms = Array.isArray(last) ? safeNumber(last[0]) : null;
        if (!asOfDate && ms != null) asOfDate = msToYmd(ms);
        percentile = Array.isArray(last) ? safeNumber(last[1]) : null;
      }
    } catch {
      // ignore parse errors
    }

    const out = {
      fundCode: code,
      asOfDate,
      rank: rank != null ? Number(rank) : null,
      total: total != null ? Number(total) : null,
      percentile: percentile != null ? Number(percentile) : null,
      source: 'eastmoney:pingzhongdata',
    };

    cacheSet(cacheKey, out, 6 * 60 * 60 * 1000);
    return out;
  });
}

function parseQuarterEndToPrevYearMonth(asOfDate) {
  const raw = String(asOfDate || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || !month) return null;

  const quarterMonth = month <= 3 ? 3 : month <= 6 ? 6 : month <= 9 ? 9 : 12;
  let prevMonth = quarterMonth - 3;
  let prevYear = year;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  return { year: prevYear, month: prevMonth };
}

/**
 * 重仓股季度对比（TopN：新增/移除/占比变化）
 * @param {{ fundCode: string, topline?: number }} params
 * @returns {Promise<import('../src/contracts/types.js').FundTopHoldingsComparison>}
 */
export async function getFundTopHoldingsComparison(params) {
  const { fundCode, topline = 10 } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `topHoldingsCompare:${code}:${String(topline || 10)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const current = await getFundTopHoldings({ fundCode: code, topline });
    const prevInfo = parseQuarterEndToPrevYearMonth(current?.asOfDate);

    let previous = { fundCode: code, asOfDate: '', holdings: [], source: current?.source };
    if (prevInfo) {
      try {
        previous = await getFundTopHoldings({ fundCode: code, topline, year: prevInfo.year, month: prevInfo.month });
      } catch {
        previous = { fundCode: code, asOfDate: '', holdings: [], source: current?.source };
      }
    }

    const prevMap = new Map((previous?.holdings || []).map((h) => [String(h.stockCode || '').trim(), h]));
    const currMap = new Map((current?.holdings || []).map((h) => [String(h.stockCode || '').trim(), h]));

    /** @type {import('../src/contracts/types.js').FundTopHoldingsChangeItem[]} */
    const added = [];
    /** @type {import('../src/contracts/types.js').FundTopHoldingsChangeItem[]} */
    const removed = [];
    /** @type {import('../src/contracts/types.js').FundTopHoldingsChangeItem[]} */
    const changed = [];

    for (const [stockCode, curr] of currMap.entries()) {
      if (!stockCode) continue;
      const prev = prevMap.get(stockCode);
      if (!prev) {
        added.push({
          stockCode,
          stockName: String(curr.stockName || '').trim(),
          prevWeightPct: null,
          currWeightPct: toFixed2(curr.weightPct),
          deltaWeightPct: null,
        });
        continue;
      }
      const delta = toFixed2(toFixed2(curr.weightPct) - toFixed2(prev.weightPct));
      changed.push({
        stockCode,
        stockName: String(curr.stockName || prev.stockName || '').trim(),
        prevWeightPct: toFixed2(prev.weightPct),
        currWeightPct: toFixed2(curr.weightPct),
        deltaWeightPct: delta,
      });
    }

    for (const [stockCode, prev] of prevMap.entries()) {
      if (!stockCode || currMap.has(stockCode)) continue;
      removed.push({
        stockCode,
        stockName: String(prev.stockName || '').trim(),
        prevWeightPct: toFixed2(prev.weightPct),
        currWeightPct: null,
        deltaWeightPct: null,
      });
    }

    added.sort((a, b) => (b.currWeightPct || 0) - (a.currWeightPct || 0));
    removed.sort((a, b) => (b.prevWeightPct || 0) - (a.prevWeightPct || 0));
    changed.sort((a, b) => Math.abs(b.deltaWeightPct || 0) - Math.abs(a.deltaWeightPct || 0));

    /** @type {import('../src/contracts/types.js').FundTopHoldingsComparison} */
    const out = {
      fundCode: code,
      current: { asOfDate: String(current?.asOfDate || ''), holdings: current?.holdings || [] },
      previous: { asOfDate: String(previous?.asOfDate || ''), holdings: previous?.holdings || [] },
      changes: { added, removed, changed },
      source: 'eastmoney:f10:FundArchivesDatas:jjcc:compare',
    };

    cacheSet(cacheKey, out, 12 * 60 * 60 * 1000);
    return out;
  });
}

/**
 * 基金资产配置（来自 pingzhongdata Data_assetAllocation，按季度）
 * @param {{ fundCode: string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundAssetAllocation>}
 */
export async function getFundAssetAllocation(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `assetAllocation:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const raw = await getPingZhongRaw(code);
    const literal = extractVarJsonLiteral(raw, 'Data_assetAllocation');
    if (!literal) throw new Error('Upstream missing Data_assetAllocation');

    /** @type {any} */
    const json = JSON.parse(literal);
    const categories = Array.isArray(json?.categories) ? json.categories.map((d) => String(d || '').trim()).filter(Boolean) : [];
    const series = Array.isArray(json?.series) ? json.series : [];

    const stockData = series.find((s) => String(s?.name || '').includes('股票'))?.data;
    const bondData = series.find((s) => String(s?.name || '').includes('债券'))?.data;
    const cashData = series.find((s) => String(s?.name || '').includes('现金'))?.data;

    /** @type {import('../src/contracts/types.js').FundAssetAllocationQuarter[]} */
    const quarters = categories.map((date, idx) => {
      const stockPct = safeNumber(stockData?.[idx]) ?? 0;
      const bondPct = safeNumber(bondData?.[idx]) ?? 0;
      const cashPct = safeNumber(cashData?.[idx]) ?? 0;
      const otherPct = Math.max(0, toFixed2(100 - stockPct - bondPct - cashPct));
      return {
        date,
        stockPct: toFixed2(stockPct),
        bondPct: toFixed2(bondPct),
        cashPct: toFixed2(cashPct),
        otherPct,
      };
    });

    const asOfDate = quarters.length ? String(quarters[quarters.length - 1].date) : '';

    /** @type {import('../src/contracts/types.js').FundAssetAllocation} */
    const out = {
      fundCode: code,
      asOfDate,
      quarters,
      source: 'eastmoney:pingzhongdata:Data_assetAllocation',
    };

    cacheSet(cacheKey, out, 24 * 60 * 60 * 1000);
    return out;
  });
}

/**
 * 同类平均/基准指数对比序列（来自 pingzhongdata Data_grandTotal，近 ~6 个月）
 * @param {{ fundCode: string }} params
 * @returns {Promise<import('../src/contracts/types.js').FundGrandTotal>}
 */
export async function getFundGrandTotal(params) {
  const { fundCode } = params || {};
  const code = String(fundCode || '').trim();
  if (!code) throw new Error('fundCode is required');

  const cacheKey = `grandTotal:${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await dedupe(cacheKey, async () => {
    const raw = await getPingZhongRaw(code);
    const literal = extractVarJsonLiteral(raw, 'Data_grandTotal');
    if (!literal) throw new Error('Upstream missing Data_grandTotal');

    /** @type {any[]} */
    const parsed = JSON.parse(literal);

    /** @type {import('../src/contracts/types.js').FundGrandTotalSeries[]} */
    const series = (parsed || [])
      .map((s) => {
        const name = String(s?.name || '').trim();
        const points = Array.isArray(s?.data)
          ? s.data
              .map((row) => {
                const ms = Array.isArray(row) ? row[0] : null;
                const val = Array.isArray(row) ? row[1] : null;
                const date = msToYmd(ms);
                const valuePct = safeNumber(val) ?? 0;
                return { date, valuePct: toFixed2(valuePct) };
              })
              .filter((p) => p.date)
          : [];
        return { name, points };
      })
      .filter((s) => s.name && Array.isArray(s.points) && s.points.length);

    const firstSeries = series[0]?.points || [];
    const startDate = firstSeries.length ? String(firstSeries[0].date) : '';
    const endDate = firstSeries.length ? String(firstSeries[firstSeries.length - 1].date) : '';

    /** @type {import('../src/contracts/types.js').FundGrandTotal} */
    const out = {
      fundCode: code,
      startDate,
      endDate,
      series,
      source: 'eastmoney:pingzhongdata:Data_grandTotal',
    };

    cacheSet(cacheKey, out, 60 * 60 * 1000);
    return out;
  });
}
