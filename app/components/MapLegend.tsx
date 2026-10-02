'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { MapLayers } from '@/app/lib/community';

interface LegendRow {
  id: string;
  /** Tailwind color class for the swatch dot. */
  swatch: string;
  /** Optional inline icon shown alongside the swatch. */
  icon?: string;
  iconAlt?: string;
  title: string;
  description: string;
}

const ROWS: LegendRow[] = [
  {
    id: 'no',
    swatch: 'bg-red-600',
    title: 'No parking',
    description: 'Solid red. Always restricted.'
  },
  {
    id: 'timed',
    swatch: 'bg-amber-600',
    title: 'Odd / even, blocked today',
    description: 'Dashed amber. Legal on the other date.'
  },
  {
    id: 'closed',
    swatch: 'bg-orange-600',
    title: 'Free street, closed now',
    description: 'Dashed orange. Legal again when the window opens.'
  },
  {
    id: 'legal',
    swatch: 'bg-green-700',
    title: 'Legal kerb now',
    description: 'Free parking at the owner’s risk. Open odd/even date, or a free street inside its hours.'
  },
  {
    id: 'on-street',
    swatch: 'bg-blue-600',
    title: 'Pay & park street',
    description: 'Tap the blue line for the rate.'
  },
  {
    id: 'off-street',
    swatch: 'bg-blue-800',
    title: 'Pay & park lot',
    description: 'Lot names appear once you zoom in.'
  },
  {
    id: 'tow',
    swatch: 'bg-orange-500',
    title: 'Tow crew report',
    description: 'Tap the orange dot for when it was reported. Not an official tow-away zone.'
  },
  {
    id: 'community',
    swatch: 'bg-emerald-500',
    title: 'Community spots',
    description: 'Suggested spots. Purple is yours and still pending review.'
  }
];

const TOGGLES: { key: keyof MapLayers; label: string }[] = [
  { key: 'rules', label: 'Rules' },
  { key: 'tows', label: 'Towing hotspots' },
  { key: 'community', label: 'Community spots' }
];

export default function MapLegend({
  layers,
  onToggle
}: {
  layers: MapLayers;
  onToggle: (key: keyof MapLayers) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

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

  return (
    <div className="absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] left-3 z-20 sm:bottom-8 sm:left-4">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Map legend"
          className="mb-2 max-h-[min(60dvh,32rem)] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/10 bg-black/85 text-white shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Map legend
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close legend"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-1 px-4 pb-2">
            {TOGGLES.map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-2 text-[12px] text-white/90">
                <input
                  type="checkbox"
                  checked={layers[toggle.key]}
                  onChange={() => onToggle(toggle.key)}
                  className="accent-white"
                />
                {toggle.label}
              </label>
            ))}
          </div>
          <ul className="space-y-2 px-4 pb-4 pt-1">
            {ROWS.map((row) => (
              <li key={row.id} className="flex items-start gap-3">
                <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <span
                    className={`absolute inset-x-1 bottom-1 h-1 rounded-full ${row.swatch}`}
                    aria-hidden
                  />
                  {row.icon && (
                    <Image
                      src={row.icon}
                      alt={row.iconAlt ?? ''}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-snug text-white">
                    {row.title}
                  </p>
                  <p className="text-[11px] leading-snug text-white/60">
                    {row.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10 px-4 py-2 text-[10px] leading-snug text-white/50">
            Restrictions update with the time control.
          </div>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close map legend' : 'Open map legend'}
        className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur transition hover:bg-black/80"
      >
        <span className="flex items-center -space-x-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-black/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-black/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-700 ring-2 ring-black/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-black/70" />
        </span>
        <span className="whitespace-nowrap">Legend</span>
      </button>
    </div>
  );
}
