type ApiResult<T> = { ok: boolean; data?: T; error?: string; detail?: string; [key: string]: any };

function deriveFunctionBase(): string {
  const envBase =
    (import.meta.env.VITE_SUPABASE_FUNCTION_BASE as string | undefined) ||
    (import.meta.env.VITE_INVITES_FUNCTION_BASE as string | undefined) ||
    null;
  if (envBase) return envBase.replace(/\/$/, "");

  const waitlistEndpoint = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
  if (waitlistEndpoint) {
    const idx = waitlistEndpoint.lastIndexOf("/");
    if (idx > 0) {
      return waitlistEndpoint.slice(0, idx);
    }
  }
  return "";
}

const FUNCTION_BASE = deriveFunctionBase();

function endpoint(path: string, explicit?: string) {
  if (explicit) return explicit;
  return FUNCTION_BASE ? `${FUNCTION_BASE}/${path}` : "";
}

const ADMIN_LIST_WAITLIST =
  (import.meta.env.VITE_ADMIN_LIST_WAITLIST_ENDPOINT as string | undefined) ||
  endpoint("admin-list-waitlist");
const SEND_BETA_INVITE =
  (import.meta.env.VITE_SEND_BETA_INVITE_ENDPOINT as string | undefined) ||
  endpoint("send-beta-invite");
const VERIFY_BETA_INVITE =
  (import.meta.env.VITE_VERIFY_BETA_INVITE_ENDPOINT as string | undefined) ||
  endpoint("verify-beta-invite");
const ADMIN_LIST_INVITES =
  (import.meta.env.VITE_ADMIN_LIST_INVITES_ENDPOINT as string | undefined) ||
  endpoint("admin-list-invites");
const ADMIN_REVOKE_INVITE =
  (import.meta.env.VITE_ADMIN_REVOKE_INVITE_ENDPOINT as string | undefined) ||
  endpoint("admin-revoke-invite");

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function missingConfig<T>(name: string): ApiResult<T> {
  return { ok: false, error: "invalid", detail: `missing_${name}_endpoint` };
}

function authHeaders(adminSecret?: string) {
  const secret = adminSecret || localStorage.getItem("admin_secret") || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
  }
  return headers;
}

async function handleResponse<T>(resp: Response): Promise<ApiResult<T>> {
  const text = await resp.text();
  let parsed: ApiResult<T>;
  try {
    parsed = text ? JSON.parse(text) : ({ ok: resp.ok } as ApiResult<T>);
  } catch (_) {
    parsed = { ok: resp.ok, detail: text } as ApiResult<T>;
  }
  if (!resp.ok) {
    return { ok: false, ...parsed };
  }
  return parsed;
}

export async function listWaitlist(adminSecret?: string) {
  if (!ADMIN_LIST_WAITLIST) return missingConfig("admin_list_waitlist");
  const resp = await fetch(ADMIN_LIST_WAITLIST, { method: "GET", headers: authHeaders(adminSecret) });
  return handleResponse<{ email: string; name: string; company: string; title: string; created_at: string }[]>(resp);
}

export async function sendBetaInvite(body: {
  email: string;
  name?: string;
  maxUses?: number;
  expiresAt?: string | null;
}, adminSecret?: string) {
  if (!SEND_BETA_INVITE) return missingConfig("send_beta_invite");
  const resp = await fetch(SEND_BETA_INVITE, {
    method: "POST",
    headers: authHeaders(adminSecret),
    body: JSON.stringify(body),
  });
  return handleResponse(resp);
}

export async function verifyBetaInvite(body: { email: string; code: string }) {
  if (!VERIFY_BETA_INVITE) return missingConfig("verify_beta_invite");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const resp = await fetch(VERIFY_BETA_INVITE, { method: "POST", headers, body: JSON.stringify(body) });
  return handleResponse(resp);
}

export async function listInvites(adminSecret?: string) {
  if (!ADMIN_LIST_INVITES) return missingConfig("admin_list_invites");
  const resp = await fetch(ADMIN_LIST_INVITES, { method: "GET", headers: authHeaders(adminSecret) });
  return handleResponse<{
    email: string;
    code: string;
    used_count: number;
    max_uses: number;
    expires_at: string | null;
    is_revoked: boolean;
    created_at: string;
    updated_at: string;
  }[]>(resp);
}

export async function revokeInvite(body: { email: string }, adminSecret?: string) {
  if (!ADMIN_REVOKE_INVITE) return missingConfig("admin_revoke_invite");
  const resp = await fetch(ADMIN_REVOKE_INVITE, {
    method: "POST",
    headers: authHeaders(adminSecret),
    body: JSON.stringify(body),
  });
  return handleResponse(resp);
}

export function storeAdminSecret(secret: string) {
  localStorage.setItem("admin_secret", secret);
}

export function clearAdminSecret() {
  localStorage.removeItem("admin_secret");
}

export function getStoredAdminSecret() {
  return localStorage.getItem("admin_secret") || "";
}
