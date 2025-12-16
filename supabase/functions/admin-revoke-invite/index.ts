import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";

const INVITES_TABLE = "beta_invites";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "invalid", detail: "method_not_allowed" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { ok: false, error: "invalid", detail: "invalid_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) {
    return json(400, { ok: false, error: "invalid", detail: "missing_email" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[admin-revoke-invite] env error", err);
    return json(500, { ok: false, error: "invalid", detail: "missing_env_vars" });
  }

  try {
    const { data, error } = await supabase
      .from(INVITES_TABLE)
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq("email", email)
      .select("email")
      .maybeSingle();

    if (error) {
      console.error("[admin-revoke-invite] db error", error);
      return json(500, { ok: false, error: "invalid", detail: "db_error" });
    }

    if (!data) {
      return json(400, { ok: false, error: "invalid", detail: "not_found" });
    }
  } catch (err) {
    console.error("[admin-revoke-invite] exception", err);
    return json(500, { ok: false, error: "invalid", detail: "db_exception" });
  }

  return json(200, { ok: true });
});
