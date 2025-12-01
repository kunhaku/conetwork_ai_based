type Provider = 'worker' | 'puter';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/run';
const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN || '';
const DEFAULT_PROVIDER = (import.meta.env.VITE_LLM_PROVIDER as Provider) || 'worker';
const DEFAULT_MODEL = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini';

interface CallLLMParams {
  systemInstruction: string;
  userContent: string;
  model?: string;
  temperature?: number;
  provider?: Provider;
}

const callWorker = async ({ systemInstruction, userContent, model, temperature }: CallLLMParams) => {
  const endpoint = API_BASE;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROXY_TOKEN) headers['Authorization'] = `Bearer ${PROXY_TOKEN}`;

  console.info('[llm][worker] calling', { endpoint, model: model || DEFAULT_MODEL });
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      systemInstruction,
      userContent,
      temperature: temperature ?? 0.1,
    }),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(data?.error || `worker failed with status ${resp.status}`);
  }
  const content = data?.content ?? data?.choices?.[0]?.message?.content ?? data?.text;
  if (!content) throw new Error('worker returned empty content');
  console.info('[llm][worker] success');
  return typeof content === 'string' ? content : JSON.stringify(content);
};

const callPuter = async ({ systemInstruction, userContent, model, temperature }: CallLLMParams) => {
  const puter = (globalThis as any).puter;
  if (!puter?.ai?.chat) {
    throw new Error('Puter.js not loaded. Ensure <script src="https://js.puter.com/v2/"></script> is present.');
  }
  const prompt = `${systemInstruction}\n\nUser:\n${userContent}`;
  console.info('[llm][puter] calling', { model: model || DEFAULT_MODEL });
  const result = await puter.ai.chat(prompt, {
    model: model || DEFAULT_MODEL,
    temperature: temperature ?? 0.1,
  });
  const content = typeof result === 'string'
    ? result
    : result?.message?.content || result?.content || JSON.stringify(result ?? {});
  console.info('[llm][puter] success');
  return content;
};

export const callLLM = async (params: CallLLMParams) => {
  const provider = params.provider || DEFAULT_PROVIDER;
  if (provider === 'puter') {
    return callPuter(params);
  }
  // default to worker
  return callWorker(params);
};

export type { Provider, CallLLMParams };
