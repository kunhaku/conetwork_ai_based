// Supabase Edge Function: waitlist-api
// Stores a waitlist submission after email verification.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Expected payload:
// {
//   email: string,
//   emailConfirm?: string,
//   name?: string,
//   company: string,
//   title: string,
//   consent: boolean,
//   verificationCode?: string
// }
//
// Response: { ok: true } on success; 409 if already exists; 400 on validation errors.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODES_TABLE = "waitlist_codes";
const WAITLIST_TABLE = "waitlist_requests";

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
  const emailConfirm = payload.emailConfirm ? String(payload.emailConfirm || "").trim().toLowerCase() : email;
  const name = payload.name ? String(payload.name) : null;
  const company = String(payload.company || "").trim();
  const title = String(payload.title || "").trim();
  const consent = Boolean(payload.consent);
  const verificationCode = payload.verificationCode ? String(payload.verificationCode).trim() : null;

  if (!email || !emailConfirm) return json(400, { error: "missing_email" });
  if (email !== emailConfirm) return json(400, { error: "emails_do_not_match" });
  if (!company || !title) return json(400, { error: "company_and_title_required" });
  if (!consent) return json(400, { error: "consent_required" });
  if (!verificationCode) return json(400, { error: "verification_required" });

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[waitlist-api] env error", err);
    return json(500, { error: "missing_env_vars" });
  }

  // Ensure code is valid and used (verified)
  try {
    const { data: codeRow, error: codeErr } = await supabase
      .from(CODES_TABLE)
      .select("email, code, expires_at, used")
      .eq("email", email)
      .eq("code", verificationCode)
      .limit(1)
      .maybeSingle();
    if (codeErr) {
      console.error("[waitlist-api] code lookup error", codeErr);
      return json(500, { error: "db_error" });
    }
    if (!codeRow) return json(400, { error: "code_invalid" });
    if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
      return json(400, { error: "code_expired" });
    }
    if (!codeRow.used) {
      return json(400, { error: "code_not_verified" });
    }
  } catch (err) {
    console.error("[waitlist-api] code exception", err);
    return json(500, { error: "db_exception" });
  }

  // Check duplicate
  try {
    const { data: existing, error: existErr } = await supabase
      .from(WAITLIST_TABLE)
      .select("email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (existErr) {
      console.error("[waitlist-api] duplicate check error", existErr);
      return json(500, { error: "db_error" });
    }
    if (existing) {
      return json(409, { error: "already_on_waitlist" });
    }
  } catch (err) {
    console.error("[waitlist-api] duplicate check exception", err);
    return json(500, { error: "db_exception" });
  }

  try {
    const { error: insErr } = await supabase.from(WAITLIST_TABLE).insert({
      email,
      name,
      company,
      title,
      consent,
      verification_code: verificationCode,
      created_at: new Date().toISOString(),
    });
    if (insErr) {
      console.error("[waitlist-api] insert error", insErr);
      return json(500, { error: "db_insert_error" });
    }
  } catch (err) {
    console.error("[waitlist-api] insert exception", err);
    return json(500, { error: "db_exception" });
  }

  return json(200, { ok: true });
});
