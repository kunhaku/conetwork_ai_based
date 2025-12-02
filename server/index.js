import express from 'express';
import cors from 'cors';
import yahooFinance from 'yahoo-finance2';
import { hasSupabaseEnv } from './dbClient.js';
import {
  upsertGraph,
  searchNodes,
  getNodeProfile,
  enqueueCrawlTask,
  getNextCrawlTasks,
  completeCrawlTask,
  pingDb,
} from './dbOps.js';

const app = express();
const PORT = process.env.PORT || 8787;
const PUTER_URL = process.env.PUTER_API_URL || 'https://api.puter.com/v2/openai/chat/completions';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEBUG = process.env.DEBUG_LOG === '1';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Simple request logger
app.use((req, _res, next) => {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check / connectivity probe
app.get('/api/ping', (_req, res) => {
  return res.json({ ok: true, message: 'api server ok' });
});

// --- Supabase connectivity checks ---
app.get('/api/db/ping', async (_req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ ok: false, error: 'Supabase env not configured' });
  try {
    await pingDb();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'db error' });
  }
});

// --- Graph persistence endpoints ---
app.get('/api/db/search', async (req, res) => {
  const query = req.query.q || req.query.query;
  const type = req.query.type;
  if (!query) return res.status(400).json({ error: 'Missing query param q' });
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  try {
    const results = await searchNodes({ query, type });
    return res.json({ results });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

app.get('/api/db/node/:id/profile', async (req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  try {
    const profile = await getNodeProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'node_not_found' });
    return res.json(profile);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

app.post('/api/db/graph/upsert', async (req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  const graph = req.body?.graph || req.body;
  if (!graph || !graph.nodes) {
    return res.status(400).json({ error: 'Graph payload missing' });
  }
  try {
    const result = await upsertGraph(graph);
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[graph upsert] error', e);
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

// --- Crawl task queue ---
app.post('/api/crawl/enqueue', async (req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  try {
    const id = await enqueueCrawlTask(req.body || {});
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

app.get('/api/crawl/next', async (req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  const limit = Number(req.query.limit || 10);
  try {
    const tasks = await getNextCrawlTasks(limit);
    return res.json({ tasks });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

app.post('/api/crawl/complete', async (req, res) => {
  if (!hasSupabaseEnv()) return res.status(500).json({ error: 'Supabase env not configured' });
  const { taskId, status, errorMessage } = req.body || {};
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    await completeCrawlTask({ taskId, status, errorMessage });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'db error' });
  }
});

// --- Finance helpers (yfinance) ---
const formatMoney = (value, currency = 'USD') => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return undefined;
  const n = Number(value);
  const abs = Math.abs(n);
  const units = [
    { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
  ];
  for (const u of units) {
    if (abs >= u.v) return `${n >= 0 ? '' : '-'}${currency === 'USD' ? '$' : ''}${(abs / u.v).toFixed(2)}${u.s}`;
  }
  return `${currency === 'USD' ? '$' : ''}${n.toFixed(2)}`;
};

const sizeBucketFromCap = (cap) => {
  if (!cap || Number.isNaN(Number(cap))) return undefined;
  const v = Number(cap);
  if (v >= 200e9) return 'Mega';
  if (v >= 10e9) return 'Large';
  if (v >= 2e9) return 'Mid';
  if (v >= 300e6) return 'Small';
  return 'Micro';
};

app.post('/api/finance/quote', async (req, res) => {
  const { names } = req.body || {};
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'names must be a non-empty array' });
  }
  const updates = {};

  for (const name of names) {
    try {
      const search = await yahooFinance.search(name, { quotesCount: 1, newsCount: 0 });
      const symbol = search?.quotes?.[0]?.symbol;
      if (!symbol) {
        updates[name] = { note: 'ticker_not_found' };
        continue;
      }

      const summary = await yahooFinance.quoteSummary(symbol, { modules: ['price', 'summaryProfile'] });
      const price = summary?.price;
      const profile = summary?.summaryProfile;
      const capRaw = price?.marketCap?.raw ?? price?.marketCap;
      const currency = price?.currency || 'USD';
      updates[name] = {
        ticker: symbol,
        primaryExchange: price?.exchangeName || price?.market || undefined,
        latestPrice: formatMoney(price?.regularMarketPrice?.raw ?? price?.regularMarketPrice, currency),
        marketCap: formatMoney(capRaw, currency),
        sector: profile?.sector,
        industry: profile?.industry,
        country: profile?.country,
        sizeBucket: sizeBucketFromCap(capRaw),
      };
    } catch (e) {
      updates[name] = { note: `lookup_failed: ${e?.message || e}` };
    }
  }

  return res.json({ updates });
});

async function callPuter(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const response = await fetch(PUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Some gateways require an Origin to be present
      'Origin': 'https://js.puter.com',
      'User-Agent': 'nexusgraph-proxy',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`puter_api_error ${response.status}: ${text}`);
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  const content =
    parsed?.choices?.[0]?.message?.content ??
    parsed?.message?.content ??
    parsed?.content ??
    text;
  return { content, raw: parsed ?? text };
}

async function callOpenAI(body) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const base = OPENAI_BASE_URL.replace(/\/+$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: body.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: body.systemInstruction },
        { role: 'user', content: body.userContent },
      ],
      temperature: body.temperature ?? 0.1,
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`openai_api_error ${response.status}: ${text}`);
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  const content =
    parsed?.choices?.[0]?.message?.content ??
    parsed?.message?.content ??
    parsed?.content ??
    text;
  return { content, raw: parsed ?? text };
}

app.post('/api/run', async (req, res) => {
  const { model = 'gpt-5.1', systemInstruction, userContent, temperature = 0.1 } = req.body || {};
  if (!systemInstruction || !userContent) {
    return res.status(400).json({ error: 'Missing systemInstruction or userContent' });
  }

  const body = {
    model,
    systemInstruction,
    userContent,
    temperature,
  };

  try {
    let result;
    if (OPENAI_KEY) {
      if (DEBUG) console.log('Using OpenAI path');
      result = await callOpenAI(body);
    } else {
      if (DEBUG) console.log('Using Puter path');
      result = await callPuter(body);
    }
    if (!result.content) {
      return res.status(502).json({ error: 'empty_content_from_model' });
    }
    return res.json(result);
  } catch (e) {
    console.error('Server error', e);
    const msg = e?.message?.includes('puter_api_error') ? 'Puter API error: ' + e.message
              : e?.message?.includes('openai_api_error') ? 'OpenAI API error: ' + e.message
              : e?.name === 'AbortError' ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms (check PUTER_API_URL or OpenAI reachability)`
              : e?.message || 'Server error';
    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
