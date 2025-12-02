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

async function handleFinanceQuote(req, env) {
  if (!env.ALPHA_VANTAGE_KEY) {
    return new Response(JSON.stringify({ error: 'ALPHA_VANTAGE_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body;
  try { body = await req.json(); } catch (_) {}
  const names = body?.names;
  if (!Array.isArray(names) || names.length === 0) {
    return new Response(JSON.stringify({ error: 'names must be a non-empty array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const updates = {};

  for (const name of names) {
    try {
      const symbol = String(name || '').trim();
      if (!symbol) {
        updates[name] = { note: 'ticker_not_found' };
        continue;
      }

      const qResp = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(env.ALPHA_VANTAGE_KEY)}`
      );
      const qJson = await qResp.json();
      if (qJson?.Note || qJson?.Information) {
        updates[name] = { note: qJson.Note || qJson.Information };
        continue;
      }
      const quote = qJson?.['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        updates[name] = { note: 'ticker_not_found' };
        continue;
      }

      const oResp = await fetch(
        `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(env.ALPHA_VANTAGE_KEY)}`
      );
      const oJson = await oResp.json();
      if (oJson?.Note || oJson?.Information) {
        updates[name] = { note: oJson.Note || oJson.Information };
        continue;
      }

      const ticker = quote['01. symbol'] || symbol;
      const currency = oJson?.Currency || 'USD';
      const latestPriceRaw = quote['05. price'] ?? quote['02. open'];
      const capRaw = oJson?.MarketCapitalization;

      updates[name] = {
        ticker,
        primaryExchange: oJson?.Exchange || undefined,
        latestPrice: formatMoney(latestPriceRaw, currency),
        marketCap: formatMoney(capRaw, currency),
        sector: oJson?.Sector,
        industry: oJson?.Industry,
        country: oJson?.Country,
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
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'cf worker ok',
        provider: usingOpenAI ? 'openai' : usingGemini ? 'gemini' : 'puter',
        baseUrl: base,
        timeoutMs: Number(env.REQUEST_TIMEOUT_MS || 30000),
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (url.pathname === '/api/finance/quote') {
      return handleFinanceQuote(req, env);
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
