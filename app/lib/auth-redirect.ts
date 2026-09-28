/** Keep post-login redirects on this site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function loginPath(reason: string, next = '/'): string {
  const params = new URLSearchParams({
    next: safeNextPath(next),
    reason
  });
  return `/login?${params.toString()}`;
}
