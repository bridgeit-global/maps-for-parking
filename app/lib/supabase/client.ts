import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicEnv } from './env';

export function createClient() {
  const env = supabasePublicEnv();
  if (!env) {
    throw new Error('Supabase environment variables are not set');
  }
  return createBrowserClient(env.url, env.key);
}
