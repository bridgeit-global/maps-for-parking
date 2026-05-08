export type ParkingType =
  | 'no'
  | 'free'
  | 'odd'
  | 'even'
  | 'onStreet'
  | 'offStreet';

export type ParkingVehicle = '2w' | '4w';

export type RuntimeState = 'restricted' | 'paid' | 'parkable';

export interface ParkingFeatureProps {
  id?: string | number;
  parking_type?: ParkingType | string;
  name?: string;
  address?: string;
  opening_time?: number;
  closing_time?: number;
  parking_instructions?: unknown;
  pricing_2w?: unknown;
  pricing_4w?: unknown;
  is_booking_available?: unknown;
  is_cancellable?: unknown;
  cancellation_policy?: string;
  monthly_2w?: unknown;
  monthly_4w?: unknown;
  [key: string]: unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decimal hours `0..24` for a Date's local time.
 */
function decimalHoursOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/**
 * Read `opening_time`/`closing_time` defensively. Defaults: open all day.
 */
function readWindow(props: ParkingFeatureProps): { opens: number; closes: number } {
  const rawOpen = props.opening_time;
  const rawClose = props.closing_time;
  const opens =
    typeof rawOpen === 'number'
      ? rawOpen
      : typeof rawOpen === 'string' && rawOpen !== ''
        ? Number(rawOpen)
        : 0;
  const closes =
    typeof rawClose === 'number'
      ? rawClose
      : typeof rawClose === 'string' && rawClose !== ''
        ? Number(rawClose)
        : 24;
  return {
    opens: Number.isFinite(opens) ? opens : 0,
    closes: Number.isFinite(closes) ? closes : 24
  };
}

/**
 * Classify a feature's runtime state for the active "right now" moment.
 *
 * Truth table:
 * - `no`                                 -> 'restricted' always
 * - `odd`  on odd-of-month  date         -> 'restricted', else 'parkable'
 * - `even` on even-of-month date         -> 'restricted', else 'parkable'
 * - `free` outside [opening_time, closing_time) -> 'restricted', else 'parkable'
 *   (the 0..24 default = open all day = 'parkable')
 * - `onStreet`, `offStreet`              -> 'paid' always
 * - unknown types                         -> 'parkable' (treated as "no concern")
 */
export function classifyParkingType(
  props: ParkingFeatureProps,
  now: Date
): RuntimeState {
  const type = props.parking_type;
  if (type === 'no') return 'restricted';
  if (type === 'onStreet' || type === 'offStreet') return 'paid';

  const dayParity = now.getDate() % 2; // 1 = odd-of-month, 0 = even-of-month
  if (type === 'odd') return dayParity === 1 ? 'restricted' : 'parkable';
  if (type === 'even') return dayParity === 0 ? 'restricted' : 'parkable';

  if (type === 'free') {
    const { opens, closes } = readWindow(props);
    // 0/24 default means open all day, so always parkable.
    if (opens === 0 && closes === 24) return 'parkable';
    const t = decimalHoursOf(now);
    if (closes >= opens) {
      const inWindow = t >= opens && t < closes;
      return inWindow ? 'parkable' : 'restricted';
    }
    // Wrap-around (e.g. open 22, close 06 next day).
    const inWindow = t >= opens || t < closes;
    return inWindow ? 'parkable' : 'restricted';
  }

  return 'parkable';
}

/**
 * Coerce a value into a numeric array of hourly prices.
 * Mapbox vector tiles cannot carry array attributes, so the prep stage
 * stringifies them as JSON; a few API paths return them already parsed.
 * Accepts: `number[]`, JSON string of `number[]`, or undefined.
 */
export function parsePricingArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  let candidate: unknown = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(candidate)) return undefined;
  const out: number[] = [];
  let sawAny = false;
  for (const entry of candidate) {
    if (entry === null || entry === undefined || entry === '') {
      // preserve the slot length but mark as missing via NaN
      out.push(NaN);
      continue;
    }
    const n = typeof entry === 'number' ? entry : Number(entry);
    if (Number.isFinite(n)) {
      out.push(n);
      sawAny = true;
    } else {
      out.push(NaN);
    }
  }
  return sawAny ? out : undefined;
}

/**
 * Look up the published rate for a given hour `0..23`. Returns `undefined`
 * when the array is missing, the index is out of bounds, or the slot is NaN.
 */
export function priceForHour(
  props: ParkingFeatureProps,
  vehicle: ParkingVehicle,
  hour: number
): number | undefined {
  const arr = parsePricingArray(
    vehicle === '2w' ? props.pricing_2w : props.pricing_4w
  );
  if (!arr) return undefined;
  const idx = ((Math.trunc(hour) % 24) + 24) % 24;
  const v = arr[idx];
  return Number.isFinite(v) ? v : undefined;
}

/**
 * Sum the hourly rates over a parking duration starting at `startAt`.
 *
 * `hours` is clamped to `1..24`. Each hour after the first wraps via the
 * 24-element pricing array — the published rates are assumed cyclic across
 * the day. `missingHours` counts slots that resolved to `undefined` so the
 * caller can render a "partial pricing" warning.
 */
export function costForDuration(
  props: ParkingFeatureProps,
  vehicle: ParkingVehicle,
  startAt: Date,
  hours: number
): { total: number; endsAt: Date; missingHours: number } {
  const safeHours = Math.max(1, Math.min(24, Math.trunc(hours) || 1));
  const startHour = startAt.getHours();
  let total = 0;
  let missingHours = 0;
  for (let i = 0; i < safeHours; i++) {
    const rate = priceForHour(props, vehicle, startHour + i);
    if (rate === undefined) {
      missingHours += 1;
    } else {
      total += rate;
    }
  }
  const endsAt = new Date(startAt.getTime() + safeHours * 60 * 60 * 1000);
  return { total, endsAt, missingHours };
}

/**
 * For a `free` zone, find the next moment its restriction state flips.
 *
 * - When the zone is currently `restricted` (closed), returns when it
 *   re-opens (`kind: 'opens'`).
 * - When the zone is currently `parkable` (in-window), returns when it
 *   closes (`kind: 'closes'`).
 *
 * Returns `undefined` when the zone has the open-all-day default (0/24),
 * since the state never flips.
 */
export function nextFreeWindowTransition(
  props: ParkingFeatureProps,
  now: Date
): { kind: 'opens' | 'closes'; at: Date } | undefined {
  if (props.parking_type !== 'free') return undefined;
  const { opens, closes } = readWindow(props);
  if (opens === 0 && closes === 24) return undefined;

  const t = decimalHoursOf(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const inWindow =
    closes >= opens
      ? t >= opens && t < closes
      : t >= opens || t < closes;

  const dateAtHour = (base: Date, hour: number): Date => {
    const whole = Math.trunc(hour);
    const minutes = Math.round((hour - whole) * 60);
    const out = new Date(base);
    out.setHours(whole, minutes, 0, 0);
    return out;
  };

  if (inWindow) {
    let at = dateAtHour(today, closes);
    if (at.getTime() <= now.getTime()) {
      at = new Date(at.getTime() + DAY_MS);
    }
    return { kind: 'closes', at };
  }

  let at = dateAtHour(today, opens);
  if (at.getTime() <= now.getTime()) {
    at = new Date(at.getTime() + DAY_MS);
  }
  return { kind: 'opens', at };
}
