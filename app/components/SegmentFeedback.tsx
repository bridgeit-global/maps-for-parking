'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/app/lib/supabase/client';
import { loginPath } from '@/app/lib/auth-redirect';
import { formatRelative, type ValidationKind } from '@/app/lib/community';
import { formatCredit, loadContributorProgress, notifyContributorProgress } from '@/app/lib/contributor';
import { useAuth } from '@/app/lib/useAuth';

interface ValidationRow {
  id: string;
  user_id: string;
  kind: ValidationKind;
  comment: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  validation_id: string;
  status: 'open' | 'fixed' | 'dismissed';
}

const PROBLEM_CHIPS = ['Hours', 'Type', 'Price', 'Gone', 'Other'] as const;

export default function SegmentFeedback({
  featureId,
  featureName,
  parkingType,
  lng,
  lat,
  refreshKey,
  onCommunityChange
}: {
  featureId: string;
  featureName: string | null;
  parkingType: string | null;
  lng: number;
  lat: number;
  refreshKey: number;
  onCommunityChange: () => void;
}) {
  const { configured, userId } = useAuth();
  const [rows, setRows] = useState<ValidationRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [mode, setMode] = useState<'rule_wrong' | 'board_missing' | 'tow' | null>(null);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from('parking_validations')
        .select('id, user_id, kind, comment, photo_path, created_at, updated_at')
        .eq('feature_id', featureId);
      if (cancelled || loadError || !data) return;
      const validations = data as ValidationRow[];
      setRows(validations);
      const problemIds = validations
        .filter((row) => row.kind !== 'confirm')
        .map((row) => row.id);
      if (problemIds.length === 0) {
        setReviews([]);
        return;
      }
      const { data: reviewData } = await supabase
        .from('validation_reviews')
        .select('validation_id, status')
        .in('validation_id', problemIds);
      if (!cancelled) setReviews((reviewData ?? []) as ReviewRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, featureId, refreshKey]);

  useEffect(() => {
    if (!configured) return;
    const latest = rows
      .filter((row) => row.photo_path)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!latest?.photo_path) {
      setPhotoUrl(null);
      return;
    }
    const supabase = createClient();
    setPhotoUrl(supabase.storage.from('report-photos').getPublicUrl(latest.photo_path).data.publicUrl);
  }, [configured, rows]);

  const confirms = rows.filter((row) => row.kind === 'confirm');
  const problems = rows.filter((row) => row.kind !== 'confirm');
  const latestConfirm = [...confirms].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const mine = userId
    ? [...rows.filter((row) => row.user_id === userId)].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at)
      )[0]
    : undefined;
  const rechecking = problems.some((row) => {
    const review = reviews.find((item) => item.validation_id === row.id);
    return !review || review.status === 'open';
  });

  async function rememberCredit() {
    const before = await loadContributorProgress();
    return async () => {
      const after = await loadContributorProgress();
      setCredit(formatCredit(before, after));
      notifyContributorProgress();
    };
  }

  function requireSignIn(reason: string) {
    if (userId) return false;
    window.location.href = loginPath(reason);
    return true;
  }

  async function uploadPhoto(ownerId: string): Promise<string | null> {
    if (!photo) return null;
    if (!photo.type.startsWith('image/') || photo.size > 4 * 1024 * 1024) {
      throw new Error('Use an image under 4 MB.');
    }
    const ext = photo.type === 'image/png' ? 'png' : 'jpg';
    const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from('report-photos').upload(path, photo, {
      contentType: photo.type,
      upsert: false
    });
    if (uploadError) throw uploadError;
    return path;
  }

  async function saveValidation(kind: ValidationKind, text: string | null, photoPath: string | null) {
    if (!userId) return;
    const supabase = createClient();
    const { error: upsertError } = await supabase.from('parking_validations').upsert(
      {
        user_id: userId,
        feature_id: featureId,
        feature_name: featureName,
        lng,
        lat,
        parking_type: parkingType,
        kind,
        comment: text,
        photo_path: photoPath,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,feature_id,kind' }
    );
    if (upsertError) throw upsertError;
    const { error: clearError } = await supabase
      .from('parking_validations')
      .delete()
      .eq('user_id', userId)
      .eq('feature_id', featureId)
      .neq('kind', kind);
    if (clearError) throw clearError;
  }

  async function confirm() {
    if (requireSignIn('Sign in to confirm this parking rule.')) return;
    setBusy(true);
    setError(null);
    try {
      const done = await rememberCredit();
      await saveValidation('confirm', null, null);
      await done();
      setMode(null);
      onCommunityChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your check.');
    } finally {
      setBusy(false);
    }
  }

  async function submitProblem(event: FormEvent) {
    event.preventDefault();
    if (!mode || mode === 'tow') return;
    if (requireSignIn('Sign in to report a problem with this rule.')) return;
    const text = comment.trim();
    if (mode === 'rule_wrong' && !text) {
      setError('Say what looks wrong — hours, type, price, or that it is gone.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const done = await rememberCredit();
      const photoPath = userId ? await uploadPhoto(userId) : null;
      await saveValidation(mode, text || null, photoPath);
      await done();
      setMode(null);
      setComment('');
      setPhoto(null);
      onCommunityChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your report.');
    } finally {
      setBusy(false);
    }
  }

  async function submitTow(event: FormEvent) {
    event.preventDefault();
    if (requireSignIn('Sign in to report a tow crew here.')) return;
    setBusy(true);
    setError(null);
    try {
      const done = await rememberCredit();
      const supabase = createClient();
      const { error: insertError } = await supabase.from('tow_alerts').insert({
        user_id: userId,
        feature_id: featureId,
        lng,
        lat,
        note: note.trim() || null
      });
      if (insertError) {
        if (insertError.message.includes('tow_alert_rate_limited')) {
          throw new Error('You already reported a tow crew at this spot in the last 6 hours.');
        }
        throw insertError;
      }
      await done();
      setMode(null);
      setNote('');
      onCommunityChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the tow report.');
    } finally {
      setBusy(false);
    }
  }

  if (!configured) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
      <p className="text-xs text-gray-600">
        {confirms.length > 0 ? (
          <>
            <span className="font-semibold text-gray-900">Verified by {confirms.length}</span>
            {latestConfirm ? ` · Last checked ${formatRelative(latestConfirm.updated_at)}` : ''}
          </>
        ) : (
          <span className="font-semibold text-gray-700">Not yet checked by locals</span>
        )}
        {problems.length > 0 ? ` · ${problems.length} reported a problem` : ''}
      </p>
      {rechecking && (
        <p className="text-xs font-medium text-amber-800">We&apos;re re-checking this. The rule above still stands.</p>
      )}
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noreferrer" className="inline-block">
          <Image
            src={photoUrl}
            alt="Report photo"
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-lg object-cover ring-1 ring-gray-200"
          />
        </a>
      )}
      {mine && (
        <p className="text-[11px] text-gray-500">
          Your check:{' '}
          {mine.kind === 'confirm' ? 'looks right' : mine.kind === 'rule_wrong' ? 'rule wrong' : 'board missing'}
        </p>
      )}
      {credit && <p className="text-[11px] font-semibold text-emerald-800">{credit}</p>}

      <div className="flex flex-wrap gap-1.5">
        <ActionButton active={mine?.kind === 'confirm'} disabled={busy} onClick={confirm}>
          Looks right
        </ActionButton>
        <ActionButton
          active={mine?.kind === 'rule_wrong'}
          disabled={busy}
          onClick={() => {
            if (requireSignIn('Sign in to report a problem with this rule.')) return;
            setMode('rule_wrong');
            setComment('');
            setError(null);
          }}
        >
          Rule wrong
        </ActionButton>
        <ActionButton
          active={mine?.kind === 'board_missing'}
          disabled={busy}
          onClick={() => {
            if (requireSignIn('Sign in to report a missing board.')) return;
            setMode('board_missing');
            setComment('');
            setError(null);
          }}
        >
          Board missing
        </ActionButton>
        <ActionButton
          disabled={busy}
          onClick={() => {
            if (requireSignIn('Sign in to report a tow crew here.')) return;
            setMode('tow');
            setError(null);
          }}
        >
          Tow crew here now
        </ActionButton>
      </div>

      {mode === 'tow' && (
        <form onSubmit={submitTow} className="space-y-2">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base text-gray-900 sm:text-sm"
          />
          <SubmitRow busy={busy} label="Report tow crew" onCancel={() => setMode(null)} />
        </form>
      )}

      {(mode === 'rule_wrong' || mode === 'board_missing') && (
        <form onSubmit={submitProblem} className="space-y-2">
          {mode === 'rule_wrong' && (
            <div className="flex flex-wrap gap-1">
              {PROBLEM_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setComment(chip === 'Other' ? '' : chip)}
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    comment === chip || (chip === 'Other' && comment !== '' && !PROBLEM_CHIPS.slice(0, 4).includes(comment as 'Hours'))
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            required={mode === 'rule_wrong'}
            placeholder={mode === 'rule_wrong' ? 'What looks wrong?' : 'Optional note'}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base text-gray-900 sm:text-sm"
          />
          <label className="block text-[11px] text-gray-500">
            Photo, optional
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-[11px]"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          <SubmitRow busy={busy} label="Send report" onCancel={() => setMode(null)} />
        </form>
      )}

      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  active
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function SubmitRow({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Saving…' : label}
      </button>
      <button type="button" onClick={onCancel} className="min-h-11 px-3 text-sm font-semibold text-gray-500">
        Cancel
      </button>
    </div>
  );
}
