'use client';

import { useEffect, useState } from 'react';
import { loadContributorProgress, type ContributorProgress } from '@/app/lib/contributor';

export default function ContributorChip() {
  const [progress, setProgress] = useState<ContributorProgress | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void loadContributorProgress().then((value) => {
        if (!cancelled) setProgress(value);
      });
    };
    load();
    if (new URLSearchParams(window.location.search).get('progress') === '1') setOpen(true);
    window.addEventListener('contributor-progress', load);
    return () => {
      cancelled = true;
      window.removeEventListener('contributor-progress', load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!progress) return null;

  const earned = progress.badges.filter((badge) => badge.earned);
  const locked = progress.badges.filter((badge) => !badge.earned).slice(0, 3);
  const span = progress.nextAt == null ? 1 : progress.nextAt - progress.floor;
  const filled = progress.nextAt == null ? 1 : Math.min(1, (progress.points - progress.floor) / span);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 max-w-36 items-center truncate rounded-full border border-white/15 px-2.5 text-xs font-semibold text-white transition hover:bg-white/10 sm:max-w-none sm:px-3"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {progress.level} · {progress.points}
      </button>
      {open && (
        <div className="fixed inset-0 z-60" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Your contributions"
            className="absolute right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] max-h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl bg-white p-4 text-gray-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{progress.level}</p>
                <p className="mt-0.5 text-xs text-gray-500">{progress.points} points</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gray-900" style={{ width: `${filled * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              {progress.nextLevel && progress.nextAt != null
                ? `${progress.nextAt - progress.points} points to ${progress.nextLevel}`
                : 'Top level'}
            </p>
            <p className="mt-3 text-sm text-gray-800">Seen over {progress.viewCount.toLocaleString('en-US')} times</p>
            {earned.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {earned.map((badge) => (
                  <li key={badge.id} className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {badge.name}
                  </li>
                ))}
              </ul>
            )}
            {locked.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {locked.map((badge) => (
                  <li key={badge.id} className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">{badge.name}.</span> {badge.hint}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
