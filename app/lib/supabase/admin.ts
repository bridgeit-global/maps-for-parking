import { createClient } from '@supabase/supabase-js';
import { supabasePublicEnv } from './env';

export function createAdminClient() {
  const env = supabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;
  return createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
