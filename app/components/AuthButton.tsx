'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { useAuth } from '@/app/lib/useAuth';

export default function AuthButton() {
  const { configured, email, ready } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return <span className="hidden h-8 w-16 sm:inline-block" aria-hidden />;
  }

  if (!configured) return null;

  if (!email) {
    return (
      <Link
        href="/login?next=/"
        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b1118] transition hover:bg-white/90"
      >
        Sign in
      </Link>
    );
  }

  const label = email.length > 22 ? `${email.slice(0, 18)}…` : email;

  async function signOut() {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[10rem] truncate text-xs text-white/70 sm:inline" title={email}>
        {label}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        {busy ? '…' : 'Sign out'}
      </button>
    </div>
  );
}
