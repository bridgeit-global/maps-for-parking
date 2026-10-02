'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { loginPath } from '@/app/lib/auth-redirect';
import {
  PARKING_TYPE_OPTIONS,
  formatRelative
} from '@/app/lib/community';
import { formatCredit, loadContributorProgress, notifyContributorProgress } from '@/app/lib/contributor';
import type { ParkingType } from '@/app/lib/parking';

export interface CorrectionRow {
  id: string;
  feature_name: string | null;
  kind: string;
  comment: string | null;
  created_at: string;
  status: string;
  lng: number;
  lat: number;
}

export function ReportDock({
  signedIn,
  pinMode,
  correctionCount,
  correctionsOpen,
  onSuggest,
  onTow,
  onCorrections
}: {
  signedIn: boolean;
  pinMode: 'suggest' | 'tow' | null;
  correctionCount: number;
  correctionsOpen: boolean;
  onSuggest: () => void;
  onTow: () => void;
  onCorrections: () => void;
}) {
  function gate(reason: string, action: () => void) {
    if (!signedIn) {
      window.location.href = loginPath(reason);
      return;
    }
    action();
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 sm:inset-x-auto sm:bottom-24 sm:right-4 sm:w-max">
      {pinMode && (
        <p className="mx-3 mb-2 max-w-none rounded-xl bg-black/80 px-3 py-2 text-xs text-white shadow-xl sm:mx-0 sm:max-w-[14rem]">
          Tap the map to drop a pin. Tap a parking line if you meant an existing spot.
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:flex-col sm:items-end sm:overflow-visible sm:px-0 sm:pb-0">
        <button type="button" onClick={() => gate('Sign in to suggest a parking spot.', onSuggest)} className={dockClass(pinMode === 'suggest')}>
          <span className="sm:hidden">Suggest</span>
          <span className="hidden sm:inline">Suggest a spot</span>
        </button>
        <button type="button" onClick={() => gate('Sign in to report a tow crew.', onTow)} className={dockClass(pinMode === 'tow')}>
          <span className="sm:hidden">Tow crew</span>
          <span className="hidden sm:inline">Tow crew here now</span>
        </button>
        <button type="button" onClick={onCorrections} className={dockClass(correctionsOpen)} aria-expanded={correctionsOpen}>
          <span className="sm:hidden">Recommend</span>
          <span className="hidden sm:inline">Recommend correction</span>
          {correctionCount > 0 ? ` · ${correctionCount}` : ''}
        </button>
      </div>
    </div>
  );
}

function dockClass(active: boolean) {
  return `shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur transition min-h-11 sm:min-h-0 ${
    active
      ? 'border-white bg-white text-[#0b1118]'
      : 'border-white/10 bg-black/70 text-white hover:bg-black/80'
  }`;
}

export function PinForm({
  mode,
  lng,
  lat,
  onCancel,
  onSaved
}: {
  mode: 'suggest' | 'tow';
  lng: number;
  lat: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [parkingType, setParkingType] = useState<ParkingType>('onStreet');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        window.location.href = loginPath(
          mode === 'tow' ? 'Sign in to report a tow crew.' : 'Sign in to suggest a parking spot.'
        );
        return;
      }
      const before = await loadContributorProgress();
      if (mode === 'tow') {
        const { error: insertError } = await supabase.from('tow_alerts').insert({
          user_id: userId,
          lng,
          lat,
          note: comment.trim() || null
        });
        if (insertError) {
          if (insertError.message.includes('tow_alert_rate_limited')) {
            throw new Error('You already reported a tow crew near here in the last 6 hours.');
          }
          throw insertError;
        }
      } else {
        const { error: insertError } = await supabase.from('parking_suggestions').insert({
          user_id: userId,
          name: name.trim() || null,
          parking_type: parkingType,
          lng,
          lat,
          comment: comment.trim() || null,
          status: 'pending'
        });
        if (insertError) throw insertError;
      }
      const after = await loadContributorProgress();
      const line = formatCredit(before, after);
      notifyContributorProgress();
      if (line) {
        setCredit(line);
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] left-3 right-3 z-30 max-h-[min(70dvh,32rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black/90 p-4 text-white shadow-2xl sm:bottom-24 sm:left-1/2 sm:right-auto sm:w-[min(22rem,calc(100%-2rem))] sm:-translate-x-1/2"
    >
      <p className="text-sm font-semibold">
        {mode === 'tow' ? 'Tow crew here now' : 'Suggest a spot'}
      </p>
      <p className="mt-1 text-[11px] text-white/60">
        {lng.toFixed(5)}, {lat.toFixed(5)}
        {mode === 'tow'
          ? ' · Drivers reported a tow crew here. This is not an official tow-away zone.'
          : ' · Pending until it is reviewed. Only you see it until then.'}
      </p>
      {mode === 'suggest' && (
        <>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name, optional"
            className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-3 text-base outline-none sm:py-2 sm:text-sm"
          />
          <select
            value={parkingType}
            onChange={(event) => setParkingType(event.target.value as ParkingType)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#121c26] px-3 py-3 text-base sm:py-2 sm:text-sm"
          >
            {PARKING_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        placeholder={mode === 'tow' ? 'Optional note' : 'What should drivers know?'}
        className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-3 text-base outline-none sm:py-2 sm:text-sm"
      />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {credit && <p className="mt-2 text-xs font-semibold text-emerald-300">{credit}</p>}
      <div className="mt-3 flex gap-2">
        {credit ? (
          <button
            type="button"
            onClick={onSaved}
            className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0b1118]"
          >
            Done
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0b1118] disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
        <button type="button" onClick={onCancel} className="min-h-11 px-3 text-sm font-semibold text-white/70">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CorrectionsDrawer({
  open,
  rows,
  onClose,
  onFocus
}: {
  open: boolean;
  rows: CorrectionRow[];
  onClose: () => void;
  onFocus: (lng: number, lat: number) => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] left-3 right-3 z-30 max-h-[min(70dvh,28rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/90 text-white shadow-2xl sm:bottom-24 sm:left-4 sm:right-auto sm:w-[min(22rem,calc(100%-2rem))]">
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Recommend correction</p>
        <button type="button" onClick={onClose} aria-label="Close recommended corrections" className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>
      <ul className="max-h-[min(50dvh,18rem)] space-y-2 overflow-auto px-4 pb-4">
        {rows.length === 0 && <li className="text-xs text-white/60">No open or recent reports yet.</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onFocus(row.lng, row.lat)}
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-left hover:bg-white/10"
            >
              <p className="text-xs font-semibold">{row.feature_name || 'Unnamed segment'}</p>
              <p className="mt-0.5 text-[11px] text-white/60">
                {row.kind === 'board_missing' ? 'Board missing' : 'Rule wrong'}
                {' · '}
                {row.status}
                {' · '}
                {formatRelative(row.created_at)}
              </p>
              {row.comment && <p className="mt-1 text-[11px] text-white/80">{row.comment}</p>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

