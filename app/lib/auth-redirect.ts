/** Cookie that carries the post-login path. The magic-link URL itself stays exact. */
export const AUTH_NEXT_COOKIE = 'auth_next';

/** Keep post-login redirects on this site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

/** Same-origin cookie written before the magic link is requested. */
export function authNextCookie(next: string): string {
  const path = safeNextPath(next);
  return `${AUTH_NEXT_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=3600; SameSite=Lax`;
}

export function loginPath(reason: string, next = '/'): string {
  const params = new URLSearchParams({
    next: safeNextPath(next),
    reason
  });
  return `/login?${params.toString()}`;
}
