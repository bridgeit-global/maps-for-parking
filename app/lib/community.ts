import type { ParkingType } from './parking';

export const TOW_HEAT_HOURS = 72;
export const TOW_SOURCE_ID = 'tow-alerts';
export const TOW_HEAT_LAYER_ID = 'tow-heat';
export const TOW_POINT_LAYER_ID = 'tow-points';
export const TOW_LABEL_LAYER_ID = 'tow-labels';
export const COMMUNITY_SOURCE_ID = 'community-spots';
export const COMMUNITY_LAYER_ID = 'community-spots-circle';
export const COMMUNITY_LABEL_LAYER_ID = 'community-spots-label';

export type ValidationKind = 'confirm' | 'rule_wrong' | 'board_missing';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface MapLayers {
  rules: boolean;
  tows: boolean;
  community: boolean;
}

export const PARKING_TYPE_OPTIONS: { value: ParkingType; label: string }[] = [
  { value: 'no', label: 'No parking' },
  { value: 'free', label: 'Free, with hours' },
  { value: 'odd', label: 'Odd-date restriction' },
  { value: 'even', label: 'Even-date restriction' },
  { value: 'onStreet', label: 'Pay and park, street' },
  { value: 'offStreet', label: 'Off-street lot' }
];

export function featureIdentity(
  properties: Record<string, unknown> | null | undefined,
  lng: number,
  lat: number
): { featureId: string; featureName: string | null; parkingType: string | null } {
  const props = properties ?? {};
  const raw = props.id ?? props.parking_id ?? props.parking_Id;
  const rawText = raw == null ? '' : String(raw).trim();
  const parkingType =
    typeof props.parking_type === 'string' && props.parking_type.trim()
      ? props.parking_type.trim()
      : null;
  const featureId = rawText || `geo:${lng.toFixed(5)},${lat.toFixed(5)}:${parkingType ?? 'unknown'}`;
  const name = typeof props.name === 'string' ? props.name.trim() : '';
  const address = typeof props.address === 'string' ? props.address.trim() : '';
  return {
    featureId,
    featureName: name || address || null,
    parkingType
  };
}

export function towWeight(createdAt: string, now = Date.now()): number {
  const age = Math.max(0, now - new Date(createdAt).getTime());
  const windowMs = TOW_HEAT_HOURS * 60 * 60 * 1000;
  return Math.max(0.2, 1 - age / windowMs);
}

export function pointsToGeoJSON(
  rows: Array<{ id: string; lng: number; lat: number; properties?: Record<string, unknown> }>
) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [row.lng, row.lat] as [number, number] },
      properties: { id: row.id, ...(row.properties ?? {}) }
    }))
  };
}

export function emptyCollection() {
  return { type: 'FeatureCollection' as const, features: [] as never[] };
}

export function parkingTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Parking';
  return PARKING_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
