import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabasePublicEnv } from './app/lib/supabase/env';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const env = supabasePublicEnv();
  if (!env) return supabaseResponse;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        for (const [header, value] of Object.entries(headers)) {
          supabaseResponse.headers.set(header, value);
        }
      }
    }
  });

  // Verifies the session and refreshes cookies when the access token is stale.
  await supabase.auth.getClaims();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ]
};
