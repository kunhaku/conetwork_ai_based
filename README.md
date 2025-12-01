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
    - `OPENAI_API_KEY` (optional): fallback if Puter is blocked.
    - `OPENAI_MODEL` (optional): default `gpt-4o-mini`.
    - `REQUEST_TIMEOUT_MS` (optional): default `15000`.
  - Routes: map `/api/run` and `/api/ping` to this Worker (e.g., `https://yourdomain.com/api/*`).
  - From frontend, set `VITE_API_BASE` to your Worker endpoint (e.g., `https://yourdomain.com/api/run`) or keep default `/api/run` if behind same domain proxy.
- To verify API server connectivity (proxy mode), hit `GET /api/ping` locally: `curl http://localhost:8787/api/ping`.
