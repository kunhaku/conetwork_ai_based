import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let singletonClient = null;

export const getSupabaseClient = () => {
  if (singletonClient) return singletonClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  singletonClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return singletonClient;
};

export const hasSupabaseEnv = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
