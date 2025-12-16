// Supabase client helper for Edge Functions (Deno).
// Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in function secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function getSupabaseClient() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}
