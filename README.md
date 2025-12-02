<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15PQTTsLJ5uKINCsDXT9l-_Na3bkf6SEC

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Create `.env.local` for frontend (currently no required vars).
   - If your Worker is using Gemini, set `VITE_LLM_PROVIDER=gemini` and `VITE_LLM_MODEL=gemini-2.5-flash-lite` to update the UI label.
3. Start the frontend:
   `npm run dev`

Notes:
- Frontend calls your backend proxy at `/api/run`; Puter.js has been removed to avoid stray network calls.
- Keep any private prompts/keys out of the frontend; store them as server env vars.
- Cloudflare Workers setup (proxy):
  - Copy `cloudflare-worker/proxy.js` as your Worker entry.
  - Required env (Workers → Settings → Variables):
    - `PROXY_TOKEN`: a shared token for Authorization header (optional but recommended).
    - `PUTER_API_URL` (optional): defaults to `https://api.puter.com/v2/openai/chat/completions`.
    - `OPENAI_API_KEY` (optional): fallback if Puter is blocked. Set this to force skipping Puter entirely.
    - `OPENAI_MODEL` (optional): default `gpt-4o-mini`.
    - `OPENAI_BASE_URL` (optional): override OpenAI endpoint (e.g., a compatible gateway URL).
    - `GEMINI_API_KEY` (optional): if set (and OpenAI not set), worker will call Gemini `generateContent` instead of Puter.
    - `GEMINI_MODEL` (optional): default `gemini-2.5-flash-lite`.
    - `GEMINI_BASE_URL` (optional): default `https://generativelanguage.googleapis.com/v1beta`.
    - `REQUEST_TIMEOUT_MS` (optional): default `30000`.
  - Routes: map `/api/run` and `/api/ping` to this Worker (e.g., `https://yourdomain.com/api/*`).
  - From frontend, set `VITE_API_BASE` to your Worker endpoint (e.g., `https://yourdomain.com/api/run`) or keep default `/api/run` if behind same domain proxy.
  - If you set `PROXY_TOKEN` on the Worker, mirror it in `.env.local` as `VITE_PROXY_TOKEN` so requests include the Authorization header.
  - To verify API server connectivity (proxy mode), hit `GET /api/ping` locally: `curl http://localhost:8787/api/ping`.

#### Using free_chatgpt_api instead of Puter
If you want to use https://github.com/popjane/free_chatgpt_api (base `https://free.v36.cm/v1`), set these env vars on your Worker (or local server):
- `OPENAI_API_KEY`: your free_chatgpt_api key.
- `OPENAI_BASE_URL`: `https://free.v36.cm/v1`.
- `OPENAI_MODEL`: e.g., `gpt-4o-mini` (supported by the free endpoint).

With `OPENAI_API_KEY` set, the proxy skips Puter entirely and speaks OpenAI-compatible JSON to the free endpoint.

## Supabase (graph memory) quickstart

1) Run `server/schema.sql` in Supabase SQL editor to create the core tables.  
2) Set server env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (writes), optional `PORT`.  
3) Service API routes (require service role; do not expose directly to the browser):
- `GET /api/db/ping` – connectivity check.
- `GET /api/db/search?q=TSMC` – fuzzy search nodes.
- `GET /api/db/node/:id/profile` – node, aliases, edges, facts.
- `POST /api/db/graph/upsert` – persist `{ nodes, links, sources }` from agents.
- `POST /api/crawl/enqueue` – add crawl job; `GET /api/crawl/next?limit=10`; `POST /api/crawl/complete`.

Minimal orchestrator loop:
- Agents produce `graph` → `POST /api/db/graph/upsert`.
- When a node is missing/stale, enqueue a crawl task → `/api/crawl/enqueue`.
- Worker consumes `/api/crawl/next` → fetch/LLM extract → upsert graph → `/api/crawl/complete`.
