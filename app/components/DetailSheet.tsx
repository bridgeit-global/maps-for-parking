'use client';

import { useEffect, useRef, useState } from 'react';

interface DetailSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function DetailSheet({ title, onClose, children }: DetailSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const offsetRef = useRef(0);
  const dragRef = useRef<{ y: number } | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setDragOffset(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  return (
    <div
      role="dialog"
      aria-label={title}
      className="detail-sheet absolute inset-x-0 bottom-0 z-40 flex max-h-[70%] flex-col overflow-hidden rounded-t-3xl bg-white text-gray-900 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-20 sm:max-h-[calc(100%-9.5rem)] sm:w-[22.5rem] sm:rounded-2xl sm:shadow-2xl"
      style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      <div
        className="relative flex h-14 shrink-0 touch-none items-center justify-center border-b border-gray-100"
        onTouchStart={(event) => {
          dragRef.current = { y: event.touches[0].clientY };
        }}
        onTouchMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          setDragOffset(Math.max(0, event.touches[0].clientY - drag.y));
        }}
        onTouchEnd={() => {
          if (offsetRef.current > 72) onClose();
          else setDragOffset(0);
          dragRef.current = null;
        }}
      >
        <div className="h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden />
        <p className="sr-only">{title}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-2 top-1.5 inline-flex h-11 items-center gap-1.5 rounded-full bg-gray-900 px-3.5 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {children}
      </div>
    </div>
  );
}
