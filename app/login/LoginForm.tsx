'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';
import { supabasePublicEnv } from '@/app/lib/supabase/env';
import { safeNextPath } from '@/app/lib/auth-redirect';

export default function LoginForm({
  nextPath,
  reason,
  error
}: {
  nextPath: string;
  reason?: string;
  error?: string;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(
    error === 'auth' ? 'That sign-in link expired or could not be verified. Request a new one.' : null
  );
  const configured = supabasePublicEnv() !== null;
  const next = safeNextPath(nextPath);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setSending(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo }
      });
      if (signInError) {
        setFormError(signInError.message);
        return;
      }
      setSentTo(email.trim());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send the sign-in email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <Link href="/" className="text-sm text-white/60 transition hover:text-white">
        ← Back to the map
      </Link>
      <p className="mt-8 text-xs uppercase tracking-[0.28em] text-white/50">Don&apos;t tow, know.</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Sign in with email</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/70">
        The map stays open without an account. Sign in only when you want to check a rule, report a
        tow crew, or suggest a spot.
      </p>
      {reason && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
          {reason}
        </p>
      )}

      {sentTo ? (
        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
          <p className="font-semibold text-emerald-200">Check your inbox</p>
          <p className="mt-2 text-sm text-white/80">
            We sent a sign-in link to <span className="font-semibold text-white">{sentTo}</span>. It
            expires in about an hour.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {formError && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {formError}
            </p>
          )}
          {!configured && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Email sign-in is not configured on this server yet.
            </p>
          )}
          <label className="block text-sm font-medium text-white/80" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none ring-[#6fb1ff] placeholder:text-white/40 focus:ring-2"
          />
          <button
            type="submit"
            disabled={sending || !configured}
            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0b1118] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </main>
  );
}
