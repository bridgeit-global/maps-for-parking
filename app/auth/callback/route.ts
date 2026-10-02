import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server';
import { AUTH_NEXT_COOKIE, safeNextPath } from '@/app/lib/auth-redirect';

function readNextPath(request: NextRequest): string {
  const queryNext = request.nextUrl.searchParams.get('next');
  if (queryNext) return safeNextPath(queryNext);

  const raw = request.cookies.get(AUTH_NEXT_COOKIE)?.value;
  if (!raw) return '/';
  try {
    return safeNextPath(decodeURIComponent(raw));
  } catch {
    return safeNextPath(raw);
  }
}

function redirectClearingNext(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.set(AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const next = readNextPath(request);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectClearingNext(request, next);
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash
    });
    if (!error) {
      return redirectClearingNext(request, next);
    }
  }

  return redirectClearingNext(request, '/login?error=auth');
}
