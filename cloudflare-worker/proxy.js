import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const formatMoney = (value, currency = 'USD') => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return undefined;
  const n = Number(value);
  const abs = Math.abs(n);
  const prefix = currency === 'USD' ? '$' : '';
  if (abs >= 1e12) return `${n >= 0 ? '' : '-'}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${n >= 0 ? '' : '-'}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n >= 0 ? '' : '-'}${prefix}${(abs / 1e6).toFixed(2)}M`;
  return `${prefix}${n.toFixed(2)}`;
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

const normalizeName = (name = '') =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const relationTypeMap = {
  SupplyChain: 'supply_chain',
  Equity: 'equity',
  Competitor: 'competitor',
  Partner: 'partner',
  Acquisition: 'acquisition',
  Customer: 'customer',
};
const toRelationType = (type = '') => relationTypeMap[type] || type?.toString().toLowerCase();

const evidenceToConfidence = (strength) => {
  if (!strength) return 0.6;
  const s = strength.toString().toLowerCase();
  if (s === 'confirmed') return 0.9;
  if (s === 'speculative') return 0.5;
  return 0.6;
};

const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return null;
  }
};

const aliasTickers = {
  'intel': 'INTC',
  'tsmc': 'TSM',
  'taiwan semiconductor': 'TSM',
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'amazon': 'AMZN',
  'meta': 'META',
  'facebook': 'META',
  'nvidia': 'NVDA',
};

const cleanSymbol = (sym) => {
  if (!sym) return sym;
  if (sym.endsWith('.US')) return sym.slice(0, -3);
  return sym;
};

const pickBestSymbol = (results = []) => {
  const firstMatch = results.find((r) => r?.symbol);
  const isUs = (s) => s && (s.endsWith('.US') || s.endsWith('.O') || s.endsWith('.N'));
  const filtered = results.filter((r) => r?.symbol && r.type === 'Common Stock');
  const usMatch = filtered.find((r) => isUs(r.symbol)) || filtered.find((r) => !r.symbol.includes('.'));
  return cleanSymbol((usMatch || filtered[0] || firstMatch || {}).symbol);
};

async function resolveSymbol(name, env, cache) {
  const key = String(name || '').trim();
  if (!key) return null;
  const lower = key.toLowerCase();

  if (aliasTickers[lower]) return aliasTickers[lower];
  if (cache[lower]) return cache[lower];

  try {
    const resp = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(key)}&token=${encodeURIComponent(env.FINNHUB_API_KEY)}`
    );
    const json = await resp.json();
    const symbol = pickBestSymbol(json?.result || []);
    if (symbol) cache[lower] = symbol;
    return symbol;
  } catch (_) {
    return null;
  }
}

const jsonResponse = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const getSupabase = (env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env missing');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: (url, opts) => fetch(url, opts) },
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

async function ensureSources(supabase, sources = []) {
  const sourceIdMap = {};
  for (const src of sources) {
    if (!src?.url) continue;
    const url = src.url;
    const domain = extractDomain(url);
    const { data, error } = await supabase
      .from('sources')
      .upsert(
        {
          url,
          domain,
          metadata: { title: src.title, note: src.note },
        },
        { onConflict: 'url' }
      )
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data?.id) sourceIdMap[src.id ?? url] = data.id;
  }
  return sourceIdMap;
}

async function ensureNodes(supabase, nodes = []) {
  const nodeIdMap = {};
  for (const node of nodes) {
    if (!node?.name) continue;
    const canonical = node.name.trim();
    const norm = normalizeName(canonical);
    const type = node.type || 'company';
    const ext = node.ticker ? { ticker: node.ticker } : {};
    const importance = node.role === 'Core' ? 5 : 1;
    const { data, error } = await supabase
      .from('nodes')
      .upsert(
        {
          type,
          canonical_name: canonical,
          normalized_name: norm,
          external_ids: ext,
          importance_score: importance,
        },
        { onConflict: 'type,normalized_name' }
      )
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data?.id) nodeIdMap[node.id ?? canonical] = data.id;
  }
  return nodeIdMap;
}

async function ensureAliases(supabase, nodeIdMap, nodes = []) {
  for (const node of nodes) {
    if (!node?.name) continue;
    const dbId = nodeIdMap[node.id ?? node.name];
    if (!dbId) continue;
    const aliases = [node.name, node.displayName].filter(Boolean);
    for (const alias of aliases) {
      const { error } = await supabase
        .from('node_aliases')
        .upsert(
          { node_id: dbId, alias },
          { onConflict: 'node_id,alias' }
        );
      if (error) throw error;
    }
  }
}

async function upsertFacts(supabase, nodeIdMap, nodes = [], sourceIdMap = {}) {
  for (const node of nodes) {
    const dbId = nodeIdMap[node.id ?? node.name];
    if (!dbId) continue;
    const facts = [];
    const pushText = (attribute, value) => {
      if (value) facts.push({ attribute, value_text: value });
    };
    pushText('role', node.role);
    pushText('country', node.country);
    pushText('ticker', node.ticker);
    pushText('primary_exchange', node.primaryExchange);
    pushText('sector', node.sector);
    pushText('industry', node.industry);
    pushText('size_bucket', node.sizeBucket);
    pushText('growth_profile', node.growthProfile);
    pushText('latest_price', node.latestPrice);
    pushText('market_cap', node.marketCap);
    pushText('revenue', node.revenue);
    pushText('net_income', node.netIncome);
    pushText('note', node.note);
    if (node.riskNotes) facts.push({ attribute: 'risk_notes', value_text: node.riskNotes });
    if (Array.isArray(node.keyThemes) && node.keyThemes.length > 0) {
      facts.push({ attribute: 'key_themes', value_json: { items: node.keyThemes } });
    }

    for (const fact of facts) {
      const base = {
        node_id: dbId,
        attribute: fact.attribute,
        value_text: fact.value_text ?? null,
        value_numeric: fact.value_numeric ?? null,
        value_json: fact.value_json ?? null,
        confidence_score: 0.6,
        source_id: fact.source_id ? sourceIdMap[fact.source_id] : null,
      };
      let sel = supabase
        .from('facts')
        .select('id')
        .eq('node_id', dbId)
        .eq('attribute', base.attribute);
      sel = base.value_text !== null ? sel.eq('value_text', base.value_text) : sel.is('value_text', null);
      sel = base.value_numeric !== null ? sel.eq('value_numeric', base.value_numeric) : sel.is('value_numeric', null);
      sel = base.value_json !== null ? sel.eq('value_json', base.value_json) : sel.is('value_json', null);
      const { data: existing, error: selErr } = await sel.maybeSingle();
      if (selErr) throw selErr;
      if (existing?.id) continue;
      const { error } = await supabase.from('facts').insert(base);
      if (error) throw error;
    }
  }
}

async function upsertEdges(supabase, links = [], nodeIdMap = {}, sourceIdMap = {}) {
  for (const link of links) {
    const srcId = nodeIdMap[typeof link.source === 'string' ? link.source : link.source?.id];
    const dstId = nodeIdMap[typeof link.target === 'string' ? link.target : link.target?.id];
    if (!srcId || !dstId) continue;
    const relation_type = toRelationType(link.type);
    const confidence_score = evidenceToConfidence(link.evidenceStrength);
    const { data: existing, error: selErr } = await supabase
      .from('edges')
      .select('id')
      .eq('src_node_id', srcId)
      .eq('dst_node_id', dstId)
      .eq('relation_type', relation_type)
      .is('valid_from', null)
      .maybeSingle();
    if (selErr) throw selErr;
    let edgeId = existing?.id;
    if (!edgeId) {
      const { data, error: insErr } = await supabase
        .from('edges')
        .insert({
          src_node_id: srcId,
          dst_node_id: dstId,
          relation_type,
          confidence_score,
          valid_from: null,
          valid_to: null,
        })
        .select('id')
        .maybeSingle();
      if (insErr) throw insErr;
      edgeId = data?.id;
    }
    if (edgeId && Array.isArray(link.sourceIds) && link.sourceIds.length > 0) {
      for (const srcRef of link.sourceIds) {
        const sid = sourceIdMap[srcRef];
        if (!sid) continue;
        const { error } = await supabase
          .from('edge_sources')
          .upsert(
            { edge_id: edgeId, source_id: sid },
            { onConflict: 'edge_id,source_id' }
          );
        if (error) throw error;
      }
    }
  }
}

async function handleFinanceQuote(req, env) {
  if (!env.FINNHUB_API_KEY) {
    return jsonResponse({ error: 'FINNHUB_API_KEY not configured' }, 500);
  }

  let body;
  try { body = await req.json(); } catch (_) {}
  const names = body?.names;
  if (!Array.isArray(names) || names.length === 0) {
    return jsonResponse({ error: 'names must be a non-empty array' }, 400);
  }

  const updates = {};
  const searchCache = {};

  for (const name of names) {
    try {
      const symbol = await resolveSymbol(name, env, searchCache);
      if (!symbol) {
        updates[name] = { note: 'ticker_not_found' };
        continue;
      }

      const qResp = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(env.FINNHUB_API_KEY)}`
      );
      const quote = await qResp.json();
      if (quote?.error || quote?.errorMessage) {
        updates[name] = { note: quote.error || quote.errorMessage };
        continue;
      }
      if (!quote || typeof quote !== 'object' || (quote.c === 0 && quote.pc === 0)) {
        updates[name] = { note: 'ticker_not_found' };
        continue;
      }

      const profileResp = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(env.FINNHUB_API_KEY)}`
      );
      const profile = await profileResp.json();
      if (profile?.error || profile?.errorMessage) {
        updates[name] = { note: profile.error || profile.errorMessage };
        continue;
      }

      const ticker = profile?.ticker || profile?.symbol || symbol;
      const currency = profile?.currency || 'USD';
      const latestPriceRaw = quote?.c ?? quote?.pc;
      const capRaw = profile?.marketCapitalization
        ? Number(profile.marketCapitalization) * 1e6 // Finnhub returns in millions
        : undefined;

      updates[name] = {
        ticker,
        primaryExchange: profile?.exchange || profile?.market || undefined,
        latestPrice: formatMoney(latestPriceRaw, currency),
        marketCap: formatMoney(capRaw, currency),
        sector: profile?.finnhubIndustry || profile?.sector,
        industry: profile?.industry,
        country: profile?.country,
        sizeBucket: sizeBucketFromCap(capRaw),
      };
    } catch (e) {
      updates[name] = { note: `lookup_failed: ${e?.message || e}` };
    }
  }

  return new Response(JSON.stringify({ updates }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleDbPing(env) {
  try {
    const supabase = getSupabase(env);
    const { error } = await supabase.from('nodes').select('id').limit(1);
    if (error) throw error;
    return jsonResponse({ ok: true, usingServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) });
  } catch (e) {
    return jsonResponse({ ok: false, error: e?.message || 'db_error', usingServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) }, 500);
  }
}

async function handleGraphUpsert(req, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase env missing' }, 500);
  }
  const auth = req.headers.get('authorization') || '';
  if (env.PROXY_TOKEN && !auth.includes(env.PROXY_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  let graph;
  try {
    const body = await req.json();
    graph = body?.graph || body;
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!graph || !graph.nodes) {
    return jsonResponse({ error: 'Graph payload missing' }, 400);
  }
  const supabase = getSupabase(env);
  try {
    const sourceIdMap = await ensureSources(supabase, graph.sources || []);
    const nodeIdMap = await ensureNodes(supabase, graph.nodes || []);
    await ensureAliases(supabase, nodeIdMap, graph.nodes || []);
    await upsertFacts(supabase, nodeIdMap, graph.nodes || [], sourceIdMap);
    await upsertEdges(supabase, graph.links || [], nodeIdMap, sourceIdMap);
    return jsonResponse({
      ok: true,
      counts: {
        sources: Object.keys(sourceIdMap).length,
        nodes: Object.keys(nodeIdMap).length,
        links: Array.isArray(graph.links) ? graph.links.length : 0,
      },
    });
  } catch (e) {
    return jsonResponse({ error: e?.message || 'db_error' }, 500);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/api/ping') {
      const usingOpenAI = Boolean(env.OPENAI_API_KEY);
      const usingGemini = !usingOpenAI && Boolean(env.GEMINI_API_KEY);
      const base = usingOpenAI
        ? env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
        : usingGemini
          ? env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
          : env.PUTER_API_URL || 'https://api.puter.com/v2/openai/chat/completions';
      return jsonResponse({
        ok: true,
        message: 'cf worker ok',
        provider: usingOpenAI ? 'openai' : usingGemini ? 'gemini' : 'puter',
        baseUrl: base,
        timeoutMs: Number(env.REQUEST_TIMEOUT_MS || 30000),
        usingServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      });
    }

    if (url.pathname === '/api/db/ping') {
      return handleDbPing(env);
    }

    if (url.pathname === '/api/finance/quote') {
      return handleFinanceQuote(req, env);
    }

    if (url.pathname === '/api/db/graph/upsert') {
      return handleGraphUpsert(req, env);
    }

    if (url.pathname !== '/api/run') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    // Basic token check (optional but recommended)
    const auth = req.headers.get('authorization') || '';
    if (env.PROXY_TOKEN && !auth.includes(env.PROXY_TOKEN)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let input;
    try {
      input = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
    }

    const { model = 'gpt-5.1', systemInstruction, userContent, temperature = 0.1 } = input || {};
    if (!systemInstruction || !userContent) {
      return new Response(JSON.stringify({ error: 'Missing systemInstruction or userContent' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ],
      temperature,
    };

    // timeout guard (Puter can be slow; default to 30s)
    const timeoutMs = Number(env.REQUEST_TIMEOUT_MS || 30000);
    const abort = AbortSignal.timeout(timeoutMs);

    // If OPENAI_API_KEY is present, use OpenAI directly and skip Puter
    if (env.OPENAI_API_KEY) {
      try {
        const base = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const oaiResp = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userContent },
            ],
            temperature,
            response_format: { type: 'json_object' },
          }),
          signal: abort,
        });
        const oaiText = await oaiResp.text();
        if (!oaiResp.ok) {
          return new Response(JSON.stringify({ error: `openai ${oaiResp.status}: ${oaiText}` }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        let parsed;
        try { parsed = JSON.parse(oaiText); } catch (_) {}
        const content =
          parsed?.choices?.[0]?.message?.content ??
          parsed?.message?.content ??
          parsed?.content ??
          oaiText;
        return new Response(JSON.stringify({ content, raw: parsed ?? oaiText }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (fallbackErr) {
        const msg = (fallbackErr?.name === 'TimeoutError' || `${fallbackErr?.message || ''}`.toLowerCase().includes('timeout'))
          ? `openai upstream timeout after ${timeoutMs}ms`
          : fallbackErr?.message || 'openai_error';
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // If GEMINI_API_KEY is present (and OpenAI is not), use Gemini
    if (env.GEMINI_API_KEY) {
      try {
        const base = (env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
        const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
        const gemResp = await fetch(`${base}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'nexusgraph-cf-proxy',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstruction}\n\nUser:\n${userContent}` }
                ]
              }
            ],
            generationConfig: { temperature }
          }),
          signal: abort,
        });
        const gemText = await gemResp.text();
        if (!gemResp.ok) {
          return new Response(JSON.stringify({ error: `gemini ${gemResp.status}: ${gemText}` }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        let parsed;
        try { parsed = JSON.parse(gemText); } catch (_) {}
        const content =
          parsed?.candidates?.[0]?.content?.parts?.[0]?.text ??
          parsed?.content ??
          gemText;
        return new Response(JSON.stringify({ content, raw: parsed ?? gemText }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (fallbackErr) {
        const msg = (fallbackErr?.name === 'TimeoutError' || `${fallbackErr?.message || ''}`.toLowerCase().includes('timeout'))
          ? `gemini upstream timeout after ${timeoutMs}ms`
          : fallbackErr?.message || 'gemini_error';
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Otherwise, try Puter
    try {
      const puterResp = await fetch(env.PUTER_API_URL || 'https://api.puter.com/v2/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://js.puter.com',
          'User-Agent': 'nexusgraph-cf-proxy',
        },
        body: JSON.stringify(body),
        signal: abort,
      });
      const puterText = await puterResp.text();
      if (!puterResp.ok) throw new Error(`puter ${puterResp.status}: ${puterText}`);

      let parsed;
      try { parsed = JSON.parse(puterText); } catch (_) {}
      const content =
        parsed?.choices?.[0]?.message?.content ??
        parsed?.message?.content ??
        parsed?.content ??
        puterText;

      return new Response(JSON.stringify({ content, raw: parsed ?? puterText }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      const msg = (err?.name === 'TimeoutError' || `${err?.message || ''}`.toLowerCase().includes('timeout'))
        ? `puter upstream timeout after ${timeoutMs}ms (increase REQUEST_TIMEOUT_MS or set OPENAI_API_KEY to skip Puter)`
        : err?.message || 'puter_error';
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
