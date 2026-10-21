import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseEnv, type Env } from '../lib/env-schema';

export function loadEnv(): Env {
  const parsed = parseEnv(process.env);
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exit(1);
  }
  return parsed.data;
}

/** Script-safe service-role client (scripts cannot import `server-only` modules). */
export function getScriptDb(env: Env = loadEnv()): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
