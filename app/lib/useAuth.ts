'use client';

import { useEffect, useState } from 'react';
import { setAnalyticsUser } from './analytics';
import { createClient } from './supabase/client';
import { supabasePublicEnv } from './supabase/env';

export function useAuth() {
  const configured = supabasePublicEnv() !== null;
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) {
      setAnalyticsUser(null);
      return;
    }
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setEmail(data.session?.user.email ?? null);
      setUserId(id);
      setAnalyticsUser(id);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      setEmail(session?.user.email ?? null);
      setUserId(id);
      setAnalyticsUser(id);
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  return { configured, email, userId, ready };
}
