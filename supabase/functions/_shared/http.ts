// Shared HTTP helpers for Supabase Edge Functions (Deno runtime).
// Provides CORS headers, JSON responses, and simple admin bearer auth.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getAdminSecret(): string {
  const secret = Deno.env.get("ADMIN_SECRET");
  if (!secret) {
    throw new Error("Missing ADMIN_SECRET");
  }
  return secret;
}

function parseBearer(req: Request): string {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export function requireAdmin(req: Request):
  | { ok: true }
  | { ok: false; response: Response } {
  let adminSecret: string;
  try {
    adminSecret = getAdminSecret();
  } catch (err) {
    console.error("[admin-auth] env error", err);
    return { ok: false, response: json(500, { ok: false, error: "invalid", detail: "missing_admin_secret" }) };
  }

  const token = parseBearer(req);
  if (!token || token !== adminSecret) {
    return { ok: false, response: json(401, { ok: false, error: "invalid", detail: "unauthorized" }) };
  }
  return { ok: true };
}
