import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { corsHeaders, json } from "../_shared/http.ts";

const INVITES_TABLE = "beta_invites";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "invalid", detail: "method_not_allowed" });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { ok: false, error: "invalid", detail: "invalid_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const code = String(payload.code || "").trim().toUpperCase();
  if (!email || !code) {
    return json(400, { ok: false, error: "invalid", detail: "missing_email_or_code" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[verify-beta-invite] env error", err);
    return json(500, { ok: false, error: "invalid", detail: "missing_env_vars" });
  }

  try {
    const { data, error } = await supabase
      .from(INVITES_TABLE)
      .select("email, code, max_uses, used_count, expires_at, is_revoked")
      .eq("email", email)
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[verify-beta-invite] db error", error);
      return json(500, { ok: false, error: "invalid", detail: "db_error" });
    }

    if (!data) {
      return json(400, { ok: false, error: "invalid" });
    }

    if (data.is_revoked) {
      return json(400, { ok: false, error: "revoked" });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return json(400, { ok: false, error: "expired" });
    }

    if (data.used_count >= data.max_uses) {
      return json(400, { ok: false, error: "limit_reached" });
    }

    const nextCount = data.used_count + 1;
    const { data: updated, error: updErr } = await supabase
      .from(INVITES_TABLE)
      .update({ used_count: nextCount, updated_at: new Date().toISOString() })
      .eq("email", email)
      .eq("code", code)
      .eq("is_revoked", false)
      .eq("used_count", data.used_count)
      .select("used_count")
      .maybeSingle();

    if (updErr) {
      console.error("[verify-beta-invite] update error", updErr);
      return json(500, { ok: false, error: "invalid", detail: "db_update_error" });
    }

    if (!updated) {
      return json(400, { ok: false, error: "limit_reached" });
    }
  } catch (err) {
    console.error("[verify-beta-invite] exception", err);
    return json(500, { ok: false, error: "invalid", detail: "db_exception" });
  }

  return json(200, { ok: true });
});
