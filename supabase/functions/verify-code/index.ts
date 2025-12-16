// Supabase Edge Function: verify-code
// Verifies an email + code pair stored by send-code.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: same SMTP vars are NOT needed here (no email sent).
//
// Expected payload: { email: string, code: string }
// Response: { ok: true } when valid; 400 otherwise.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODES_TABLE = "waitlist_codes";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { error: "invalid_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const code = String(payload.code || "").trim();
  if (!email || !code) return json(400, { error: "missing_email_or_code" });

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[verify-code] env error", err);
    return json(500, { error: "missing_env_vars" });
  }

  try {
    const { data, error } = await supabase
      .from(CODES_TABLE)
      .select("email, code, expires_at, used")
      .eq("email", email)
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[verify-code] db error", error);
      return json(500, { error: "db_error" });
    }

    if (!data) return json(400, { error: "code_invalid" });

    if (data.used) return json(400, { error: "code_used" });
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return json(400, { error: "code_expired" });
    }

    const { error: updErr } = await supabase
      .from(CODES_TABLE)
      .update({ used: true, verified_at: new Date().toISOString() })
      .eq("email", email)
      .eq("code", code);
    if (updErr) {
      console.error("[verify-code] update error", updErr);
      return json(500, { error: "db_update_error" });
    }
  } catch (err) {
    console.error("[verify-code] exception", err);
    return json(500, { error: "db_exception" });
  }

  return json(200, { ok: true });
});
