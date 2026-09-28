import type maplibregl from 'maplibre-gl';

export const PARKING_COLORS = {
  restrictedRed: '#dc2626',
  restrictedRedDark: '#b91c1c',
  timedAmber: '#d97706',
  closedOrange: '#ea580c',
  parkableGreen: '#15803d',
  paidBlue: '#2563eb',
  paidBlueDark: '#1d4ed8',
  textRed: '#7f1d1d',
  textBlue: '#1e3a8a',
  textGreen: '#14532d'
} as const;

export const PARKING_TYPE_ICONS = {
  no: { url: '/icons/no-parking.png', id: 'no-parking-icon' },
  onStreet: { url: '/icons/street-parking.png', id: 'on-street-icon' },
  offStreet: { url: '/icons/off-street-parking.png', id: 'off-street-icon' }
} as const;

// Fonts that exist in the Carto Voyager glyph stack (basemap default).
const TEXT_FONT_STACK = ['Open Sans Semibold', 'Noto Sans Regular'];

// Icons and names stay off the city view. Lines carry the rule until the
// street is large enough to read a label.
const ICON_MIN_ZOOM = 15.5;
const NO_PARKING_LABEL_MIN_ZOOM = 16.8;
const ICON_MIN_ZOOM_OFFSTREET = 14.5;

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
 * Kerbside that is legal at `now`: odd streets on even dates, even streets on
 * odd dates, and free streets inside a real opening window.
 * All-day free (0–24) stays undrawn so it does not paint the whole city green.
 */
export function parkableNowFilter(
  typeField: string,
  openingField: string | undefined,
  closingField: string | undefined,
  now: Date
): maplibregl.FilterSpecification {
  const dayParity = now.getDate() % 2;
  const tLit = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const opensExpr = openingField ? ['coalesce', ['get', openingField], 0] : 0;
  const closesExpr = closingField ? ['coalesce', ['get', closingField], 24] : 24;
  const inWindowExpr: maplibregl.ExpressionSpecification =
    openingField && closingField
      ? ([
          'case',
          ['>=', closesExpr, opensExpr],
          ['all', ['>=', tLit, opensExpr], ['<', tLit, closesExpr]],
          ['any', ['>=', tLit, opensExpr], ['<', tLit, closesExpr]]
        ] as unknown as maplibregl.ExpressionSpecification)
      : (['literal', true] as unknown as maplibregl.ExpressionSpecification);
  const hasWindow: maplibregl.ExpressionSpecification =
    openingField && closingField
      ? ([
          'any',
          ['!=', opensExpr, 0],
          ['!=', closesExpr, 24]
        ] as unknown as maplibregl.ExpressionSpecification)
      : (['literal', false] as unknown as maplibregl.ExpressionSpecification);

  const isParkable: maplibregl.ExpressionSpecification = [
    'match',
    ['get', typeField],
    'odd',
    dayParity === 0,
    'even',
    dayParity === 1,
    'free',
    ['all', hasWindow, inWindowExpr],
    false
  ] as unknown as maplibregl.ExpressionSpecification;

  return [
    'all',
    ['==', ['geometry-type'], 'LineString'],
    isParkable
  ] as unknown as maplibregl.FilterSpecification;
}

function withTypes(
  filter: maplibregl.FilterSpecification,
  typeField: string,
  types: string[]
): maplibregl.FilterSpecification {
  const typeMatch =
    types.length === 1
      ? ['==', ['get', typeField], types[0]]
      : ['in', ['get', typeField], ['literal', types]];
  return ['all', filter, typeMatch] as unknown as maplibregl.FilterSpecification;
}

const LINE_WIDTH: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  1.15,
  13,
  2.1,
  16,
  4,
  18,
  6
];

const LINE_OPACITY: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  0.55,
  13,
  0.78,
  16,
  0.92
];

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
 * Add parking layers for one source-layer. Lines are split by rule so a city
 * view can be read without labels: solid red is always banned, dashed amber is
 * an odd/even ban today, dashed orange is a free street outside its hours,
 * green is legal kerb right now, and blue is paid.
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

  const parkableLineId = `${sourceLayer}-parkable-line`;
  const noLineId = `${sourceLayer}-no-line`;
  const timedLineId = `${sourceLayer}-timed-line`;
  const closedLineId = `${sourceLayer}-closed-line`;
  const noIconId = `${sourceLayer}-no-icon`;
  const timedIconId = `${sourceLayer}-timed-icon`;
  const closedIconId = `${sourceLayer}-closed-icon`;
  const parkableIconId = `${sourceLayer}-parkable-icon`;
  const paidOnStreetLineId = `${sourceLayer}-paid-onstreet-line`;
  const paidOnStreetIconId = `${sourceLayer}-paid-onstreet-icon`;
  const paidOffStreetFillId = `${sourceLayer}-paid-offstreet-fill`;
  const paidOffStreetOutlineId = `${sourceLayer}-paid-offstreet-outline`;
  const paidOffStreetIconId = `${sourceLayer}-paid-offstreet-icon`;

  const buildRestrictedAt = (now: Date) =>
    restrictedNowFilter('LineString', typeField, openingField, closingField, now);
  const buildNoFilter = (now: Date) => withTypes(buildRestrictedAt(now), typeField, ['no']);
  const buildTimedFilter = (now: Date) =>
    withTypes(buildRestrictedAt(now), typeField, ['odd', 'even']);
  const buildClosedFilter = (now: Date) => withTypes(buildRestrictedAt(now), typeField, ['free']);
  const buildParkableFilter = (now: Date) =>
    parkableNowFilter(typeField, openingField, closingField, now);

  const pushLine = (
    id: string,
    color: string,
    buildFilter: (now: Date) => maplibregl.FilterSpecification,
    dash?: number[]
  ) => {
    try {
      map.addLayer(
        {
          id,
          type: 'line',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: buildFilter(effectiveNow),
          layout: {
            'line-cap': dash ? 'butt' : 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': color,
            'line-width': LINE_WIDTH,
            'line-opacity': LINE_OPACITY,
            ...(dash ? { 'line-dasharray': dash } : {})
          }
        },
        beforeId
      );
      specs.push({
        id,
        timeDependent: true,
        geometryType: 'LineString',
        buildFilter
      });
    } catch (err) {
      console.warn(`Could not add ${id}:`, err);
    }
  };

  // Bottom to top. Types do not share a feature, so order only matters where streets cross.
  pushLine(parkableLineId, PARKING_COLORS.parkableGreen, buildParkableFilter);
  pushLine(closedLineId, PARKING_COLORS.closedOrange, buildClosedFilter, [1.4, 1.2]);
  pushLine(timedLineId, PARKING_COLORS.timedAmber, buildTimedFilter, [1.6, 1.1]);
  pushLine(noLineId, PARKING_COLORS.restrictedRed, buildNoFilter);

  const pushRuleLabel = (
    id: string,
    label: string,
    color: string,
    buildFilter: (now: Date) => maplibregl.FilterSpecification,
    iconId?: string,
    minzoom = ICON_MIN_ZOOM
  ) => {
    try {
      map.addLayer(
        {
          id,
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          minzoom,
          filter: buildFilter(effectiveNow),
          layout: {
            ...(iconId
              ? {
                  'icon-image': iconId,
                  'icon-size': 0.7,
                  'icon-allow-overlap': false,
                  'icon-padding': 2
                }
              : {}),
            'symbol-placement': 'line-center',
            'icon-rotation-alignment': 'viewport',
            'text-field': label,
            'text-font': TEXT_FONT_STACK,
            'text-size': 11,
            'text-anchor': 'top',
            'text-offset': [0, iconId ? 1.1 : 0.4],
            'text-padding': 6,
            'text-allow-overlap': false,
            'text-optional': true,
            'text-rotation-alignment': 'viewport',
            'text-pitch-alignment': 'viewport'
          },
          paint: {
            'text-color': color,
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-halo-blur': 0.4
          }
        },
        beforeId
      );
      specs.push({
        id,
        timeDependent: true,
        geometryType: 'LineString',
        buildFilter
      });
    } catch (err) {
      console.warn(`Could not add ${id}:`, err);
    }
  };

  pushRuleLabel(parkableIconId, 'Legal now', PARKING_COLORS.textGreen, buildParkableFilter);
  pushRuleLabel(closedIconId, 'Closed now', '#9a3412', buildClosedFilter);
  pushRuleLabel(timedIconId, 'Blocked today', '#92400e', buildTimedFilter);
  if (iconsLoaded.no) {
    pushRuleLabel(
      noIconId,
      'No parking',
      PARKING_COLORS.textRed,
      buildNoFilter,
      PARKING_TYPE_ICONS.no.id,
      NO_PARKING_LABEL_MIN_ZOOM
    );
  } else {
    pushRuleLabel(
      noIconId,
      'No parking',
      PARKING_COLORS.textRed,
      buildNoFilter,
      undefined,
      NO_PARKING_LABEL_MIN_ZOOM
    );
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
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': PARKING_COLORS.paidBlue,
          'line-width': LINE_WIDTH,
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.7,
            13,
            0.88,
            16,
            0.95
          ]
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
          minzoom: ICON_MIN_ZOOM,
          filter: buildPaidOnStreetFilter(),
          layout: {
            'icon-image': PARKING_TYPE_ICONS.onStreet.id,
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0.6,
              16,
              0.95,
              19,
              1.15
            ],
            'symbol-placement': 'line-center',
            'icon-rotation-alignment': 'viewport',
            'icon-allow-overlap': false,
            'text-field': 'Pay & park',
            'text-font': TEXT_FONT_STACK,
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              10,
              17,
              12,
              20,
              13
            ],
            'text-anchor': 'top',
            'text-offset': [0, 1.1],
            'text-padding': 4,
            'text-allow-overlap': false,
            'text-optional': true,
            'text-rotation-alignment': 'viewport',
            'text-pitch-alignment': 'viewport',
            'text-letter-spacing': 0.02
          },
          paint: {
            'text-color': PARKING_COLORS.textBlue,
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-halo-blur': 0.5
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
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.16,
            14,
            0.32,
            18,
            0.45
          ],
          'fill-outline-color': PARKING_COLORS.paidBlueDark
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
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': PARKING_COLORS.paidBlueDark,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            14,
            1.75,
            18,
            2.5
          ],
          'line-opacity': 0.95
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
          minzoom: ICON_MIN_ZOOM_OFFSTREET,
          filter: buildPaidOffStreetPolyFilter(),
          layout: {
            'icon-image': PARKING_TYPE_ICONS.offStreet.id,
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              0.62,
              16,
              0.9,
              19,
              1.15
            ],
            'icon-allow-overlap': false,
            'icon-padding': 4,
            'symbol-placement': 'point',
            'icon-rotation-alignment': 'viewport',
            'text-field': [
              'case',
              [
                'all',
                ['has', 'name'],
                ['!=', ['get', 'name'], '']
              ],
              ['get', 'name'],
              'Pay & park lot'
            ] as unknown as maplibregl.ExpressionSpecification,
            'text-font': TEXT_FONT_STACK,
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              10,
              16,
              12,
              19,
              13
            ],
            'text-anchor': 'top',
            'text-offset': [0, 1.2],
            'text-max-width': 8,
            'text-padding': 4,
            'text-allow-overlap': false,
            'text-optional': true,
            'text-rotation-alignment': 'viewport',
            'text-pitch-alignment': 'viewport',
            'text-letter-spacing': 0.02
          },
          paint: {
            'text-color': PARKING_COLORS.textBlue,
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-halo-blur': 0.5,
            'text-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              0,
              15.3,
              1
            ]
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
export function setParkingLayerVisibility(
  map: maplibregl.Map,
  specs: ParkingLayerSpec[],
  visible: boolean
): void {
  const value = visible ? 'visible' : 'none';
  for (const spec of specs) {
    if (!map.getLayer(spec.id)) continue;
    map.setLayoutProperty(spec.id, 'visibility', value);
  }
}

export function clickableLayerIds(specs: ParkingLayerSpec[]): string[] {
  // Every parking layer is clickable so users can interact with both lines
  // and the polygon fills/outlines. Icon layers also act as click targets.
  return specs.map((s) => s.id);
}
