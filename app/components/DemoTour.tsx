'use client';

import { useCallback, useEffect, useState } from 'react';

const SEEN_KEY = 'mfp-demo-seen';

const STEPS = [
  {
    title: 'Read the kerb',
    body: 'Red is no parking. Amber is blocked today. Green is free parking at the owner’s risk. Blue is pay and park.'
  },
  {
    title: 'Open the legend',
    body: 'The legend in the lower left has the full key, and switches for rules, tow reports, and community spots.'
  },
  {
    title: 'Preview another hour',
    body: 'Use the time control at the top to see which streets are legal later today.'
  },
  {
    title: 'Tap a street',
    body: 'Tap a line to read the rule. Sign in only when you want to recommend a correction or report a tow crew.'
  }
];

export default function DemoTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Private mode can block storage. The tour still closes.
    }
    setOpen(false);
    setStep(0);
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY) !== '1') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      {open && current && (
        <div className="absolute inset-x-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-40 sm:inset-x-auto sm:left-4 sm:w-[min(22rem,calc(100%-2rem))]">
          <div
            role="dialog"
            aria-labelledby="demo-tour-title"
            className="rounded-2xl border border-white/10 bg-black/90 p-4 text-white shadow-2xl backdrop-blur"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Demo · {step + 1} of {STEPS.length}
            </p>
            <h2 id="demo-tour-title" className="mt-1 text-base font-semibold">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{current.body}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={finish}
                className="min-h-11 px-2 text-sm font-semibold text-white/70"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  if (last) finish();
                  else setStep((index) => index + 1);
                }}
                className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-[#0b1118]"
              >
                {last ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setOpen(true);
          }}
          className="absolute bottom-[max(8rem,calc(env(safe-area-inset-bottom)+7.5rem))] left-3 z-20 flex min-h-11 items-center rounded-full border border-white/10 bg-black/70 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur transition hover:bg-black/80 sm:bottom-19 sm:left-4"
        >
          Demo
        </button>
      )}
    </>
  );
}
