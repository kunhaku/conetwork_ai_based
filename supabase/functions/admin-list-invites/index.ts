import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";

const INVITES_TABLE = "beta_invites";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return json(405, { ok: false, error: "invalid", detail: "method_not_allowed" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[admin-list-invites] env error", err);
    return json(500, { ok: false, error: "invalid", detail: "missing_env_vars" });
  }

  try {
    const { data, error } = await supabase
      .from(INVITES_TABLE)
      .select("email, code, used_count, max_uses, expires_at, is_revoked, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin-list-invites] db error", error);
      return json(500, { ok: false, error: "invalid", detail: "db_error" });
    }

    return json(200, { ok: true, data: data ?? [] });
  } catch (err) {
    console.error("[admin-list-invites] exception", err);
    return json(500, { ok: false, error: "invalid", detail: "db_exception" });
  }
});
