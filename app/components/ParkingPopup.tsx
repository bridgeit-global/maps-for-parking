'use client';

import { useMemo, useState } from 'react';
import {
  classifyParkingType,
  costForDuration,
  nextFreeWindowTransition,
  type ParkingFeatureProps,
  type ParkingType,
  type ParkingVehicle
} from '@/app/lib/parking';

interface ParkingPopupProps {
  feature: {
    properties?: Record<string, unknown> | null;
  };
  effectiveNow: Date;
}

const HOUR_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const WEEKDAY_HOUR_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const RUPEE = '\u20b9';

const NOISY_FIELD_KEYS = new Set([
  'mark_as_accurate',
  'comments',
  'images',
  'aws_link',
  'added_by',
  'parking_Id',
  'parking_id',
  'id',
  'pricing_id',
  'pricing_2w',
  'pricing_4w',
  'monthly_2w',
  'monthly_4w'
]);

const HEADER_FIELD_KEYS = new Set([
  'parking_type',
  'name',
  'address',
  'opening_time',
  'closing_time'
]);

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return String(value);
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

function firstInstruction(value: unknown): string | undefined {
  if (!value) return undefined;
  let candidate: unknown = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return asString(value);
    }
  }
  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const s = typeof entry === 'string' ? entry : asString(entry);
      if (s) return s;
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const text =
          asString(obj.text) ??
          asString(obj.instruction) ??
          asString(obj.note) ??
          asString(obj.description);
        if (text) return text;
      }
    }
    return undefined;
  }
  return asString(candidate);
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '\u2014';
    return value
      .map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function humanizeKey(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatEndTime(now: Date, endsAt: Date): string {
  return isSameLocalDay(now, endsAt)
    ? HOUR_FORMAT.format(endsAt)
    : WEEKDAY_HOUR_FORMAT.format(endsAt);
}

function badgeLabel(type: ParkingType | undefined): { label: string; tone: 'red' | 'blue' | 'gray' } {
  switch (type) {
    case 'no':
      return { label: 'No parking zone', tone: 'red' };
    case 'odd':
      return { label: 'No parking \u00b7 odd dates', tone: 'red' };
    case 'even':
      return { label: 'No parking \u00b7 even dates', tone: 'red' };
    case 'free':
      return { label: 'Free zone \u00b7 closed now', tone: 'red' };
    case 'onStreet':
      return { label: 'Pay & park \u00b7 street', tone: 'blue' };
    case 'offStreet':
      return { label: 'Pay & park \u00b7 lot', tone: 'blue' };
    default:
      return { label: 'Parking', tone: 'gray' };
  }
}

function StatusBadge({ tone, children }: { tone: 'red' | 'blue' | 'gray'; children: React.ReactNode }) {
  const palette =
    tone === 'red'
      ? 'bg-red-100 text-red-700 ring-red-200'
      : tone === 'blue'
        ? 'bg-blue-100 text-blue-700 ring-blue-200'
        : 'bg-gray-100 text-gray-700 ring-gray-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${palette}`}
    >
      {children}
    </span>
  );
}

function CollapsibleDetails({ properties }: { properties: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => {
    return Object.entries(properties)
      .filter(([key, value]) => {
        if (key.startsWith('_')) return false;
        if (NOISY_FIELD_KEYS.has(key)) return false;
        if (HEADER_FIELD_KEYS.has(key)) return false;
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [properties]);

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
      >
        <span>Details</span>
        <span aria-hidden>{open ? '\u2212' : '+'}</span>
      </button>
      {open && (
        <dl className="mt-2 space-y-1.5 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="min-w-[100px] shrink-0 text-gray-500">{humanizeKey(key)}</dt>
              <dd className="text-gray-900 wrap-break-word">{formatPropertyValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function HoursStepper({
  hours,
  onChange
}: {
  hours: number;
  onChange: (next: number) => void;
}) {
  const dec = () => onChange(Math.max(1, hours - 1));
  const inc = () => onChange(Math.min(24, hours + 1));
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Hours</span>
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-1 py-1 shadow-sm">
        <button
          type="button"
          aria-label="Decrease hours"
          onClick={dec}
          disabled={hours <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>−</span>
        </button>
        <input
          type="number"
          min={1}
          max={24}
          step={1}
          value={hours}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(Math.max(1, Math.min(24, Math.trunc(n))));
          }}
          className="w-10 bg-transparent text-center text-sm font-semibold text-gray-900 focus:outline-none"
          aria-label="Number of hours"
        />
        <button
          type="button"
          aria-label="Increase hours"
          onClick={inc}
          disabled={hours >= 24}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    </div>
  );
}

function VehicleSegmentedControl({
  value,
  onChange
}: {
  value: ParkingVehicle;
  onChange: (next: ParkingVehicle) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Vehicle type"
      className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 text-xs font-semibold"
    >
      {(['2w', '4w'] as ParkingVehicle[]).map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1 transition ${
            value === opt
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function PaidVariant({
  props,
  effectiveNow
}: {
  props: ParkingFeatureProps;
  effectiveNow: Date;
}) {
  const [vehicle, setVehicle] = useState<ParkingVehicle>('4w');
  const [hours, setHours] = useState<number>(1);

  const cost = useMemo(
    () => costForDuration(props, vehicle, effectiveNow, hours),
    [props, vehicle, effectiveNow, hours]
  );

  const allMissing = cost.missingHours === hours;
  const partialMissing = cost.missingHours > 0 && cost.missingHours < hours;
  const endText = formatEndTime(effectiveNow, cost.endsAt);

  const isBooking = asBoolean(props.is_booking_available);
  const cancellation = asString(props.cancellation_policy);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <VehicleSegmentedControl value={vehicle} onChange={setVehicle} />
        <HoursStepper hours={hours} onChange={setHours} />
      </div>

      <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
        {allMissing ? (
          <p className="text-sm font-semibold text-gray-700">Pricing not published</p>
        ) : (
          <>
            <p className="text-2xl font-bold leading-tight text-gray-900">
              {RUPEE}
              {cost.total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Park until <span className="font-semibold text-gray-900">{endText}</span>
            </p>
            {partialMissing && (
              <p className="mt-1 text-[11px] text-amber-700">
                Pricing only covers next {hours - cost.missingHours} h · price may be partial
              </p>
            )}
          </>
        )}
      </div>

      {(isBooking !== undefined || cancellation) && (
        <div className="space-y-1 text-xs text-gray-600">
          {isBooking !== undefined && (
            <p>
              <span className="font-semibold text-gray-700">Booking:</span>{' '}
              {isBooking ? 'Available' : 'On-site only'}
            </p>
          )}
          {cancellation && (
            <p>
              <span className="font-semibold text-gray-700">Cancellation:</span> {cancellation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RestrictedVariant({
  props,
  effectiveNow
}: {
  props: ParkingFeatureProps;
  effectiveNow: Date;
}) {
  const type = props.parking_type as ParkingType | undefined;

  let primaryFact: string | undefined;
  if (type === 'no') {
    primaryFact = firstInstruction(props.parking_instructions) ?? asString(props.address);
  } else if (type === 'odd' || type === 'even') {
    primaryFact = 'Restricted today \u00b7 clear by midnight';
  } else if (type === 'free') {
    const transition = nextFreeWindowTransition(props, effectiveNow);
    if (transition) {
      const target = isSameLocalDay(effectiveNow, transition.at)
        ? HOUR_FORMAT.format(transition.at)
        : `tomorrow at ${HOUR_FORMAT.format(transition.at)}`;
      primaryFact =
        transition.kind === 'opens' ? `Reopens at ${target}` : `Closes at ${target}`;
    }
  }

  return (
    <div className="space-y-2 text-sm text-gray-700">
      {primaryFact && <p className="leading-snug">{primaryFact}</p>}
    </div>
  );
}

export default function ParkingPopup({ feature, effectiveNow }: ParkingPopupProps) {
  const props = (feature.properties ?? {}) as ParkingFeatureProps;
  const type = props.parking_type as ParkingType | undefined;
  const state = classifyParkingType(props, effectiveNow);
  const badge = badgeLabel(type);

  const name = asString(props.name);
  const address = asString(props.address);
  const headerTitle = name ?? address ?? 'Parking feature';
  const subtitle = name && address ? address : undefined;

  return (
    <div className="min-w-[260px] max-w-[320px] font-sans">
      <div className="mb-2">
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </div>
      <h3 className="text-base font-bold leading-snug text-gray-900">{headerTitle}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}

      <div className="mt-3">
        {state === 'paid' ? (
          <PaidVariant props={props} effectiveNow={effectiveNow} />
        ) : (
          <RestrictedVariant props={props} effectiveNow={effectiveNow} />
        )}
      </div>

      <CollapsibleDetails properties={props as Record<string, unknown>} />
    </div>
  );
}
