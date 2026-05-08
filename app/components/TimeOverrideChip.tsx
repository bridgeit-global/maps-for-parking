'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface TimeOverrideChipProps {
  /** The currently effective moment (device time or override). */
  effectiveNow: Date;
  /** True when an override is active and `effectiveNow` is not device time. */
  isOverridden: boolean;
  /**
   * Called when the user picks a new moment, or when they tap "Reset to now".
   * `next === null` means: revert to device time.
   */
  onChange: (next: Date | null) => void;
}

const SHORT_TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const LONG_LABEL = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/** Format a Date as the value `<input type="datetime-local">` expects. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

export default function TimeOverrideChip({
  effectiveNow,
  isOverridden,
  onChange
}: TimeOverrideChipProps) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const label = useMemo(() => {
    if (!isOverridden) {
      return `Now \u00b7 ${SHORT_TIME.format(effectiveNow)}`;
    }
    return `Custom \u00b7 ${LONG_LABEL.format(effectiveNow)}`;
  }, [effectiveNow, isOverridden]);

  // Close panel on Escape and on outside-click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) return;
    onChange(parsed);
  };

  const handleReset = () => {
    onChange(null);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="absolute top-4 left-4 z-20">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${inputId}-panel`}
        className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur transition ${
          isOverridden
            ? 'border-amber-300/60 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
            : 'border-white/10 bg-black/70 text-white hover:bg-black/80'
        }`}
      >
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
        <span className="whitespace-nowrap">{label}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={`${inputId}-panel`}
          role="dialog"
          aria-label="Set preview time"
          className="mt-2 w-72 rounded-2xl border border-white/10 bg-black/85 p-4 text-sm text-white shadow-2xl backdrop-blur"
        >
          <label
            htmlFor={inputId}
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60"
          >
            Preview the map at
          </label>
          <input
            id={inputId}
            type="datetime-local"
            value={toLocalInputValue(effectiveNow)}
            onChange={handleInput}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/50">
              {isOverridden
                ? 'Auto-refresh paused.'
                : 'Following device time.'}
            </p>
            <button
              type="button"
              onClick={handleReset}
              disabled={!isOverridden}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset to now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
