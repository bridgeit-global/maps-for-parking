'use client';

import { track } from '@vercel/analytics';
import {
  type AnalyticsEventName,
  AnalyticsEvent
} from './analytics-events';

export { AnalyticsEvent, type AnalyticsEventName };

/** Flat props only — Vercel custom events reject nested objects. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

let sessionUserId: string | null = null;

/** Keep analytics identity in sync with Supabase auth (no email / PII). */
export function setAnalyticsUser(userId: string | null) {
  sessionUserId = userId;
}

export function trackAction(name: AnalyticsEventName | string, props: AnalyticsProps = {}) {
  try {
    track(name, {
      signed_in: Boolean(sessionUserId),
      user_id: sessionUserId ?? 'anonymous',
      ...props
    });
  } catch {
    // Analytics must never break product flows.
  }
}
