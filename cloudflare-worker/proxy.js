export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/api/ping') {
      return new Response(JSON.stringify({ ok: true, message: 'cf worker ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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

    // timeout guard
    const timeoutMs = Number(env.REQUEST_TIMEOUT_MS || 15000);
    const abort = AbortSignal.timeout(timeoutMs);

    // Try Puter first
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
      // fallback to OpenAI if configured
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
          return new Response(JSON.stringify({ error: fallbackErr.message || 'openai_fallback_error' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      return new Response(JSON.stringify({ error: err.message || 'puter_error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
