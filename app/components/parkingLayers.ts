import type maplibregl from 'maplibre-gl';

export const PARKING_COLORS = {
  restrictedRed: '#ef4444',
  paidBlue: '#3b82f6',
  paidBlueDark: '#1d4ed8'
} as const;

export const PARKING_TYPE_ICONS = {
  no: { url: '/icons/no-parking.png', id: 'no-parking-icon' },
  onStreet: { url: '/icons/street-parking.png', id: 'on-street-icon' },
  offStreet: { url: '/icons/off-street-parking.png', id: 'off-street-icon' }
} as const;

export type GeometryKind = 'LineString' | 'Polygon' | 'Point';

export interface ParkingLayerSpec {
  /** Layer ID assigned to the MapLibre layer. */
  id: string;
  /** Whether this layer's filter depends on `effectiveNow` and must be refreshed. */
  timeDependent: boolean;
  /** Geometry type the layer renders. */
  geometryType: GeometryKind;
  /** Builder that produces the filter for a given moment. */
  buildFilter: (now: Date) => maplibregl.FilterSpecification;
}

const DEFAULT_TYPE_FIELD = 'parking_type';
const DEFAULT_OPENING_FIELD = 'opening_time';
const DEFAULT_CLOSING_FIELD = 'closing_time';

/**
 * Build a MapLibre filter that matches features currently in the
 * "restricted right now" bucket (no, odd-on-odd, even-on-even, free out of window).
 *
 * The expression mirrors `classifyParkingType` from app/lib/parking.ts so the
 * client classifier and the GPU filter stay in lockstep.
 */
export function restrictedNowFilter(
  geometryType: GeometryKind,
  typeField: string,
  openingField: string | undefined,
  closingField: string | undefined,
  now: Date
): maplibregl.FilterSpecification {
  const dayParity = now.getDate() % 2; // 1 = odd-of-month, 0 = even-of-month
  const tLit = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  const opensExpr = openingField ? ['coalesce', ['get', openingField], 0] : 0;
  const closesExpr = closingField ? ['coalesce', ['get', closingField], 24] : 24;

  const inWindowExpr: maplibregl.ExpressionSpecification =
    openingField && closingField
      ? ([
          'case',
          ['>=', closesExpr, opensExpr],
          [
            'all',
            ['>=', tLit, opensExpr],
            ['<', tLit, closesExpr]
          ],
          [
            'any',
            ['>=', tLit, opensExpr],
            ['<', tLit, closesExpr]
          ]
        ] as unknown as maplibregl.ExpressionSpecification)
      : ([
          'literal',
          true
        ] as unknown as maplibregl.ExpressionSpecification);

  const notDefaultAllDay: maplibregl.ExpressionSpecification =
    openingField && closingField
      ? ([
          'any',
          ['!=', opensExpr, 0],
          ['!=', closesExpr, 24]
        ] as unknown as maplibregl.ExpressionSpecification)
      : ([
          'literal',
          false
        ] as unknown as maplibregl.ExpressionSpecification);

  const freeRestrictedExpr: maplibregl.ExpressionSpecification =
    openingField && closingField
      ? ([
          'all',
          notDefaultAllDay,
          ['!', inWindowExpr]
        ] as unknown as maplibregl.ExpressionSpecification)
      : ([
          'literal',
          false
        ] as unknown as maplibregl.ExpressionSpecification);

  const isRestrictedExpr: maplibregl.ExpressionSpecification = [
    'match',
    ['get', typeField],
    'no',
    true,
    'odd',
    dayParity === 1,
    'even',
    dayParity === 0,
    'free',
    freeRestrictedExpr,
    false
  ] as unknown as maplibregl.ExpressionSpecification;

  return [
    'all',
    ['==', ['geometry-type'], geometryType],
    isRestrictedExpr
  ] as unknown as maplibregl.FilterSpecification;
}

/**
 * Build a MapLibre filter that matches a single paid parking type.
 */
export function paidTypeFilter(
  geometryType: GeometryKind,
  typeField: string,
  parkingType: 'onStreet' | 'offStreet'
): maplibregl.FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], geometryType],
    ['==', ['get', typeField], parkingType]
  ] as unknown as maplibregl.FilterSpecification;
}

/**
 * Detect the property field names this tileset uses. Falls back to the
 * canonical names when metadata isn't available.
 */
function resolveFieldNames(fields?: Record<string, unknown>): {
  typeField: string;
  openingField?: string;
  closingField?: string;
} {
  if (!fields) {
    return {
      typeField: DEFAULT_TYPE_FIELD,
      openingField: DEFAULT_OPENING_FIELD,
      closingField: DEFAULT_CLOSING_FIELD
    };
  }
  const names = Object.keys(fields);
  const typeField =
    names.find(
      (n) =>
        n.toLowerCase() === 'parking_type' ||
        n.toLowerCase() === 'type' ||
        n.toLowerCase() === 'category'
    ) ?? DEFAULT_TYPE_FIELD;
  const openingField = names.find(
    (n) =>
      n.toLowerCase() === 'opening_time' ||
      n.toLowerCase() === 'open_time' ||
      n.toLowerCase() === 'opening'
  );
  const closingField = names.find(
    (n) =>
      n.toLowerCase() === 'closing_time' ||
      n.toLowerCase() === 'close_time' ||
      n.toLowerCase() === 'closing'
  );
  return { typeField, openingField, closingField };
}

/**
 * Add the seven parking layers (restricted line + icon, paid onStreet line + icon,
 * paid offStreet fill + outline + icon) for a given source-layer.
 *
 * Returns descriptors for every layer added so the caller can later refresh
 * filters when `effectiveNow` changes.
 */
export function addParkingClassLayers(args: {
  map: maplibregl.Map;
  sourceId: string;
  sourceLayer: string;
  fields?: Record<string, unknown>;
  effectiveNow: Date;
  beforeId?: string;
  iconsLoaded: { no: boolean; onStreet: boolean; offStreet: boolean };
}): ParkingLayerSpec[] {
  const { map, sourceId, sourceLayer, fields, effectiveNow, beforeId, iconsLoaded } = args;
  const { typeField, openingField, closingField } = resolveFieldNames(fields);
  const specs: ParkingLayerSpec[] = [];

  const restrictedLineId = `${sourceLayer}-restricted-line`;
  const restrictedIconId = `${sourceLayer}-restricted-icon`;
  const paidOnStreetLineId = `${sourceLayer}-paid-onstreet-line`;
  const paidOnStreetIconId = `${sourceLayer}-paid-onstreet-icon`;
  const paidOffStreetFillId = `${sourceLayer}-paid-offstreet-fill`;
  const paidOffStreetOutlineId = `${sourceLayer}-paid-offstreet-outline`;
  const paidOffStreetIconId = `${sourceLayer}-paid-offstreet-icon`;

  // --- Restricted (LineString) -------------------------------------------------
  const buildRestrictedLineFilter = (now: Date) =>
    restrictedNowFilter('LineString', typeField, openingField, closingField, now);

  try {
    map.addLayer(
      {
        id: restrictedLineId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: buildRestrictedLineFilter(effectiveNow),
        paint: {
          'line-color': PARKING_COLORS.restrictedRed,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            2,
            14,
            3,
            18,
            5
          ],
          'line-opacity': 0.9
        }
      },
      beforeId
    );
    specs.push({
      id: restrictedLineId,
      timeDependent: true,
      geometryType: 'LineString',
      buildFilter: buildRestrictedLineFilter
    });
  } catch (err) {
    console.warn(`Could not add ${restrictedLineId}:`, err);
  }

  if (iconsLoaded.no) {
    try {
      map.addLayer(
        {
          id: restrictedIconId,
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: buildRestrictedLineFilter(effectiveNow),
          layout: {
            'icon-image': PARKING_TYPE_ICONS.no.id,
            'icon-size': 0.9,
            'icon-allow-overlap': false,
            'icon-ignore-placement': false,
            'symbol-placement': 'line-center',
            'icon-rotation-alignment': 'viewport'
          }
        },
        beforeId
      );
      specs.push({
        id: restrictedIconId,
        timeDependent: true,
        geometryType: 'LineString',
        buildFilter: buildRestrictedLineFilter
      });
    } catch (err) {
      console.warn(`Could not add ${restrictedIconId}:`, err);
    }
  }

  // --- Paid: onStreet (LineString) --------------------------------------------
  const buildPaidOnStreetFilter = () =>
    paidTypeFilter('LineString', typeField, 'onStreet');

  try {
    map.addLayer(
      {
        id: paidOnStreetLineId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: buildPaidOnStreetFilter(),
        paint: {
          'line-color': PARKING_COLORS.paidBlue,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            2,
            14,
            3.5,
            18,
            6
          ],
          'line-opacity': 0.9
        }
      },
      beforeId
    );
    specs.push({
      id: paidOnStreetLineId,
      timeDependent: false,
      geometryType: 'LineString',
      buildFilter: buildPaidOnStreetFilter
    });
  } catch (err) {
    console.warn(`Could not add ${paidOnStreetLineId}:`, err);
  }

  if (iconsLoaded.onStreet) {
    try {
      map.addLayer(
        {
          id: paidOnStreetIconId,
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: buildPaidOnStreetFilter(),
          layout: {
            'icon-image': PARKING_TYPE_ICONS.onStreet.id,
            'icon-size': 0.95,
            'symbol-placement': 'line-center',
            'icon-rotation-alignment': 'viewport'
          }
        },
        beforeId
      );
      specs.push({
        id: paidOnStreetIconId,
        timeDependent: false,
        geometryType: 'LineString',
        buildFilter: buildPaidOnStreetFilter
      });
    } catch (err) {
      console.warn(`Could not add ${paidOnStreetIconId}:`, err);
    }
  }

  // --- Paid: offStreet (Polygon) -----------------------------------------------
  const buildPaidOffStreetPolyFilter = () =>
    paidTypeFilter('Polygon', typeField, 'offStreet');

  try {
    map.addLayer(
      {
        id: paidOffStreetFillId,
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: buildPaidOffStreetPolyFilter(),
        paint: {
          'fill-color': PARKING_COLORS.paidBlue,
          'fill-opacity': 0.35
        }
      },
      beforeId
    );
    specs.push({
      id: paidOffStreetFillId,
      timeDependent: false,
      geometryType: 'Polygon',
      buildFilter: buildPaidOffStreetPolyFilter
    });
  } catch (err) {
    console.warn(`Could not add ${paidOffStreetFillId}:`, err);
  }

  try {
    map.addLayer(
      {
        id: paidOffStreetOutlineId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: buildPaidOffStreetPolyFilter(),
        paint: {
          'line-color': PARKING_COLORS.paidBlueDark,
          'line-width': 1.5,
          'line-opacity': 0.9
        }
      },
      beforeId
    );
    specs.push({
      id: paidOffStreetOutlineId,
      timeDependent: false,
      geometryType: 'Polygon',
      buildFilter: buildPaidOffStreetPolyFilter
    });
  } catch (err) {
    console.warn(`Could not add ${paidOffStreetOutlineId}:`, err);
  }

  if (iconsLoaded.offStreet) {
    try {
      map.addLayer(
        {
          id: paidOffStreetIconId,
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          minzoom: 13,
          filter: buildPaidOffStreetPolyFilter(),
          layout: {
            'icon-image': PARKING_TYPE_ICONS.offStreet.id,
            'icon-size': 1,
            'icon-allow-overlap': true,
            'symbol-placement': 'point',
            'icon-rotation-alignment': 'viewport'
          }
        },
        beforeId
      );
      specs.push({
        id: paidOffStreetIconId,
        timeDependent: false,
        geometryType: 'Polygon',
        buildFilter: buildPaidOffStreetPolyFilter
      });
    } catch (err) {
      console.warn(`Could not add ${paidOffStreetIconId}:`, err);
    }
  }

  return specs;
}

/**
 * Re-apply filters on every time-dependent layer for a new "now" moment.
 */
export function applyEffectiveNow(
  map: maplibregl.Map,
  specs: ParkingLayerSpec[],
  effectiveNow: Date
): void {
  for (const spec of specs) {
    if (!spec.timeDependent) continue;
    if (!map.getLayer(spec.id)) continue;
    try {
      map.setFilter(spec.id, spec.buildFilter(effectiveNow));
    } catch (err) {
      console.warn(`Could not refresh filter for ${spec.id}:`, err);
    }
  }
}

/**
 * The set of layer IDs that should fire the parking popup on click.
 * Used by MapView to register a single delegated click handler.
 */
export function clickableLayerIds(specs: ParkingLayerSpec[]): string[] {
  // Every parking layer is clickable so users can interact with both lines
  // and the polygon fills/outlines. Icon layers also act as click targets.
  return specs.map((s) => s.id);
}
