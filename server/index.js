import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;
const PUTER_URL = process.env.PUTER_API_URL || 'https://api.puter.com/v2/openai/chat/completions';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DEBUG = process.env.DEBUG_LOG === '1';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

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
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              : e?.name === 'AbortError' ? 'Request timed out'
              : e?.message || 'Server error';
    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
