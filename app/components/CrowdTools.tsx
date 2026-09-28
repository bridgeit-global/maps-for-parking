'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { loginPath } from '@/app/lib/auth-redirect';
import {
  PARKING_TYPE_OPTIONS,
  formatRelative
} from '@/app/lib/community';
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
    <div className="absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
      {pinMode && (
        <p className="max-w-[14rem] rounded-xl bg-black/80 px-3 py-2 text-xs text-white shadow-xl">
          Tap the map to drop a pin. Tap a parking line if you meant an existing spot.
        </p>
      )}
      <button type="button" onClick={() => gate('Sign in to suggest a parking spot.', onSuggest)} className={dockClass(pinMode === 'suggest')}>
        Suggest a spot
      </button>
      <button type="button" onClick={() => gate('Sign in to report a tow crew.', onTow)} className={dockClass(pinMode === 'tow')}>
        Tow crew here now
      </button>
      <button type="button" onClick={onCorrections} className={dockClass(correctionsOpen)} aria-expanded={correctionsOpen}>
        Corrections{correctionCount > 0 ? ` · ${correctionCount}` : ''}
      </button>
    </div>
  );
}

function dockClass(active: boolean) {
  return `rounded-full border px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur transition ${
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
      className="absolute bottom-24 left-1/2 z-30 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 p-4 text-white shadow-2xl"
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
            className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none"
          />
          <select
            value={parkingType}
            onChange={(event) => setParkingType(event.target.value as ParkingType)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#121c26] px-3 py-2 text-sm"
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
        className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none"
      />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b1118] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-white/70">
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
    <div className="absolute bottom-24 left-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-black/90 text-white shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Corrections</p>
        <button type="button" onClick={onClose} aria-label="Close corrections" className="text-white/60 hover:text-white">
          ✕
        </button>
      </div>
      <ul className="max-h-72 space-y-2 overflow-auto px-4 pb-4">
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

