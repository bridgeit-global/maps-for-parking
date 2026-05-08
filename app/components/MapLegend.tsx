'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

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
    swatch: 'bg-red-500',
    icon: '/icons/no-parking.png',
    iconAlt: 'No parking icon',
    title: 'No parking now',
    description: 'Active no-parking, odd/even, or out-of-window zones.'
  },
  {
    id: 'on-street',
    swatch: 'bg-blue-500',
    icon: '/icons/street-parking.png',
    iconAlt: 'On-street parking icon',
    title: 'Paid · street',
    description: 'Pay & park along the curb. Tap line for rates.'
  },
  {
    id: 'off-street',
    swatch: 'bg-blue-700',
    icon: '/icons/off-street-parking.png',
    iconAlt: 'Off-street parking lot icon',
    title: 'Paid · lot',
    description: 'Multi-storey or surface lots. Tap polygon for details.'
  }
];

export default function MapLegend() {
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
    <div className="absolute bottom-8 left-4 z-20">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Map legend"
          className="mb-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-black/85 text-white shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Map legend
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close legend"
              className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
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
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur transition hover:bg-black/80"
      >
        <span className="flex items-center -space-x-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-black/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-black/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-blue-700 ring-2 ring-black/70" />
        </span>
        <span className="whitespace-nowrap">Legend</span>
      </button>
    </div>
  );
}
