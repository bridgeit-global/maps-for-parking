'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import ParkingPopup from './ParkingPopup';
import DetailSheet from './DetailSheet';
import TimeOverrideChip from './TimeOverrideChip';
import MapLegend from './MapLegend';
import {
  PARKING_TYPE_ICONS,
  addParkingClassLayers,
  applyEffectiveNow,
  clickableLayerIds,
  setParkingLayerVisibility,
  type ParkingLayerSpec
} from './parkingLayers';
import {
  COMMUNITY_LABEL_LAYER_ID,
  COMMUNITY_LAYER_ID,
  COMMUNITY_SOURCE_ID,
  TOW_HEAT_LAYER_ID,
  TOW_LABEL_LAYER_ID,
  TOW_POINT_LAYER_ID,
  TOW_SOURCE_ID,
  emptyCollection,
  formatRelative,
  parkingTypeLabel,
  pointsToGeoJSON,
  towWeight,
  type MapLayers
} from '@/app/lib/community';
import { recordFeedbackView } from '@/app/lib/contributor';
import { createClient } from '@/app/lib/supabase/client';
import { supabasePublicEnv } from '@/app/lib/supabase/env';
import { useAuth } from '@/app/lib/useAuth';
import { CorrectionsDrawer, PinForm, ReportDock, type CorrectionRow } from './CrowdTools';
import DemoTour from './DemoTour';

const MUMBAI_CENTER = {
  lng: 72.83,
  lat: 19.0,
  zoom: 12.5,
  bearing: 15,
  pitch: 45
};
const GEOCODE_DEBOUNCE_MS = 300;
const FLY_TO_ZOOM = 15;

interface MapViewProps {
  tilesetUrl?: string;
  tilesetId?: string;
  mapboxAccessToken?: string;
  caption?: string;
}

interface GeocodeFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface TilesetMetadata {
  vector_layers?: Array<{
    id: string;
    fields?: Record<string, unknown>;
    description?: string;
    minzoom?: number;
    maxzoom?: number;
  }>;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  minzoom?: number;
  maxzoom?: number;
}

interface ParkingSelection {
  features: maplibregl.MapGeoJSONFeature[];
  lngLat: { lng: number; lat: number };
}

/**
 * First place or street label above the road network.
 * Voyager's earliest text layer is a waterway name under the roads, so using
 * that would hide the parking lines.
 */
function firstLocationLabelId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  let seenRoad = false;
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    if (layer.type === 'line' && (id.includes('road') || id.includes('bridge'))) {
      seenRoad = true;
    }
    if (!seenRoad || layer.type !== 'symbol') continue;
    const layout = layer.layout as { 'text-field'?: unknown } | undefined;
    if (layout?.['text-field']) return layer.id;
  }
  return undefined;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

export default function MapView({ tilesetUrl, tilesetId, mapboxAccessToken, caption }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const layerSpecsRef = useRef<ParkingLayerSpec[]>([]);
  const openCrowdCardRef = useRef<
    (
      lngLat: maplibregl.LngLat,
      html: string,
      target?: { targetType: 'tow' | 'suggestion'; targetId: string }
    ) => void
  >(() => {});
  const dismissSheetRef = useRef<() => void>(() => {});
  const mapPaddingRef = useRef(false);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tilesetMetadata, setTilesetMetadata] = useState<TilesetMetadata | null>(null);
  // True once the metadata fetch has settled (success OR failure) — or when
  // there's no metadata to fetch (i.e. only a `tilesetUrl` was provided).
  // The layer-adding effect waits on this so it never adds layers with a
  // guessed `source-layer` name on first load (the source-layer guess from
  // `tilesetId.split('.').pop()` rarely matches the actual baked name, which
  // causes the "tiles only render after a hard reload" bug).
  const [metadataResolved, setMetadataResolved] = useState(false);
  const [layersAdded, setLayersAdded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [override, setOverride] = useState<Date | null>(null);
  const [layers, setLayers] = useState<MapLayers>({ rules: true, tows: true, community: true });
  const [pinMode, setPinMode] = useState<'suggest' | 'tow' | null>(null);
  const [draftPin, setDraftPin] = useState<{ lng: number; lat: number } | null>(null);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [communityTick, setCommunityTick] = useState(0);
  const { userId } = useAuth();
  const pinModeRef = useRef(pinMode);
  const layersRef = useRef(layers);
  useEffect(() => {
    pinModeRef.current = pinMode;
  }, [pinMode]);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  const [tick, setTick] = useState(0);
  const [parkingSelection, setParkingSelection] = useState<ParkingSelection | null>(null);
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [noteHtml, setNoteHtml] = useState<string | null>(null);
  const effectiveNow = useMemo(() => {
    // `tick` is intentionally referenced so the memo re-evaluates on each
    // device-time tick when no override is active.
    void tick;
    return override ?? new Date();
  }, [override, tick]);
  const effectiveNowRef = useRef(effectiveNow);
  useEffect(() => {
    effectiveNowRef.current = effectiveNow;
  }, [effectiveNow]);

  // Device-time auto-refresh (paused when an override is active).
  useEffect(() => {
    if (override !== null) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }
    tickIntervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 60_000);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [override]);

  // Fetch tileset metadata.
  useEffect(() => {
    if (!tilesetId) {
      // No metadata fetch needed — unblock the layer-adding effect.
      setMetadataResolved(true);
      return;
    }
    let cancelled = false;
    setMetadataResolved(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/tileset/metadata?tilesetId=${encodeURIComponent(tilesetId)}`
        );
        if (!res.ok) {
          console.error('Failed to fetch tileset metadata:', await res.text());
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setTilesetMetadata(data.metadata);
      } catch (err) {
        console.error('Error fetching tileset metadata:', err);
      } finally {
        // Mark resolved regardless of outcome so a metadata failure doesn't
        // permanently block the layers from being added (we'll fall back to
        // a guessed source-layer name).
        if (!cancelled) setMetadataResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tilesetId]);

  // Initialise the map once on mount.
  useEffect(() => {
    if (!mapContainer.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [MUMBAI_CENTER.lng, MUMBAI_CENTER.lat],
      zoom: MUMBAI_CENTER.zoom,
      bearing: MUMBAI_CENTER.bearing,
      pitch: MUMBAI_CENTER.pitch,
      attributionControl: { compact: true }
    });
    map.current = m;

    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    m.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
      }),
      'top-right'
    );

    m.on('load', () => {
      setIsLoading(false);
      setMapReady(true);
    });
    m.on('error', (e) => {
      console.error('Map error:', e);
      setError('Failed to load map');
      setIsLoading(false);
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  const clearMapPadding = useCallback(() => {
    if (!mapPaddingRef.current) return;
    mapPaddingRef.current = false;
    map.current?.easeTo({
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 250
    });
  }, []);

  const revealPoint = useCallback((lngLat: maplibregl.LngLatLike) => {
    const m = map.current;
    if (!m) return;
    const mobile = window.matchMedia('(max-width: 639px)').matches;
    const padding = mobile
      ? {
          top: 72,
          bottom: Math.round(m.getContainer().clientHeight * 0.62),
          left: 16,
          right: 16
        }
      : { top: 88, bottom: 72, left: 400, right: 24 };
    mapPaddingRef.current = true;
    m.easeTo({
      center: maplibregl.LngLat.convert(lngLat),
      padding,
      duration: 400
    });
  }, []);

  const dismissSheet = useCallback(() => {
    setParkingSelection(null);
    setNoteHtml(null);
    setSelectionIndex(0);
    clearMapPadding();
  }, [clearMapPadding]);
  dismissSheetRef.current = dismissSheet;

  openCrowdCardRef.current = (lngLat, html, target) => {
    setParkingSelection(null);
    setSelectionIndex(0);
    setNoteHtml(html);
    revealPoint(lngLat);
    if (target) recordFeedbackView(target.targetType, target.targetId);
  };

  const openParkingPopup = useCallback(
    (lngLat: maplibregl.LngLatLike, features: maplibregl.MapGeoJSONFeature[]) => {
      if (features.length === 0) return;
      const point = maplibregl.LngLat.convert(lngLat);
      setNoteHtml(null);
      setSelectionIndex(0);
      setParkingSelection({
        features,
        lngLat: { lng: point.lng, lat: point.lat }
      });
      revealPoint(point);
    },
    [revealPoint]
  );

  // One map click, queried top-to-bottom, so overlapping streets open the
  // feature on top and offer the rest as "next".
  const registerClickHandlers = useCallback(
    (specs: ParkingLayerSpec[]) => {
      const m = map.current;
      if (!m) return;
      const ids = clickableLayerIds(specs);
      m.on('click', (event) => {
        const crowdIds = [TOW_POINT_LAYER_ID, COMMUNITY_LAYER_ID].filter(
          (id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none'
        );
        const slop = window.matchMedia('(pointer: coarse)').matches ? 18 : 4;
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [event.point.x - slop, event.point.y - slop],
          [event.point.x + slop, event.point.y + slop]
        ];
        if (crowdIds.length > 0) {
          const crowdHits = m.queryRenderedFeatures(bbox, { layers: crowdIds });
          const crowdFeature = crowdHits[0];
          if (crowdFeature) {
            const props = (crowdFeature.properties ?? {}) as Record<string, unknown>;
            const targetId = props.id == null ? '' : String(props.id);
            const targetType = crowdFeature.layer.id === TOW_POINT_LAYER_ID ? 'tow' : 'suggestion';
            openCrowdCardRef.current(
              event.lngLat,
              targetType === 'tow' ? towCardHtml(props) : communityCardHtml(props),
              targetId ? { targetType, targetId } : undefined
            );
            return;
          }
        }
        const live = ids.filter(
          (id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none'
        );
        const features =
          live.length === 0
            ? []
            : uniqueParkingHits(m.queryRenderedFeatures(bbox, { layers: live }));
        if (features.length === 0) {
          dismissSheetRef.current();
          return;
        }
        openParkingPopup(event.lngLat, features);
      });
      for (const id of ids) {
        m.on('mouseenter', id, () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', id, () => {
          m.getCanvas().style.cursor = '';
        });
      }
    },
    [openParkingPopup]
  );

  // Add tileset source and parking layers once map + metadata are ready.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    if (!tilesetUrl && !tilesetId) return;
    // Wait for the metadata fetch to settle before adding layers, otherwise
    // the source-layer name we use is the fallback guess from `tilesetId`
    // and can mismatch the baked name → tiles fetch but render nothing
    // (the "blank on first load, fine after reload" symptom).
    if (!metadataResolved) return;
    if (layersAdded) return;

    let cancelled = false;

    (async () => {
      const sourceId = 'parking-tileset';
      const sourceConfig: maplibregl.SourceSpecification = {
        type: 'vector',
        tiles: [],
        minzoom: tilesetMetadata?.minzoom ?? 0,
        maxzoom: tilesetMetadata?.maxzoom ?? 22
      } as unknown as maplibregl.SourceSpecification;

      const cfg = sourceConfig as unknown as Record<string, unknown>;
      if (tilesetMetadata?.bounds) cfg.bounds = tilesetMetadata.bounds;

      if (tilesetUrl) {
        cfg.tiles = [tilesetUrl];
      } else if (tilesetId && mapboxAccessToken) {
        cfg.tiles = [
          `https://api.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.vector.pbf?access_token=${mapboxAccessToken}`
        ];
      } else if (tilesetId) {
        cfg.url = `mapbox://${tilesetId}`;
        delete cfg.tiles;
      } else {
        return;
      }

      try {
        if (!m.getSource(sourceId)) {
          m.addSource(sourceId, sourceConfig);
        }
      } catch (err) {
        console.error('Error adding tileset source:', err);
        setError('Failed to load parking data tileset');
        return;
      }

      const iconResults = await Promise.allSettled([
        loadImage(PARKING_TYPE_ICONS.no.url),
        loadImage(PARKING_TYPE_ICONS.onStreet.url),
        loadImage(PARKING_TYPE_ICONS.offStreet.url)
      ]);
      if (cancelled) return;

      const iconsLoaded = { no: false, onStreet: false, offStreet: false };
      const icons = [
        { result: iconResults[0], spec: PARKING_TYPE_ICONS.no, key: 'no' as const },
        { result: iconResults[1], spec: PARKING_TYPE_ICONS.onStreet, key: 'onStreet' as const },
        { result: iconResults[2], spec: PARKING_TYPE_ICONS.offStreet, key: 'offStreet' as const }
      ];
      for (const { result, spec, key } of icons) {
        if (result.status !== 'fulfilled') {
          console.warn(`Icon load failed for ${spec.id}`);
          continue;
        }
        try {
          if (!m.hasImage(spec.id)) {
            m.addImage(spec.id, result.value, { pixelRatio: 2 });
          }
          iconsLoaded[key] = true;
        } catch (err) {
          console.warn(`Could not register image ${spec.id}:`, err);
        }
      }

      const sourceLayers: Array<{ id: string; fields?: Record<string, unknown> }> =
        tilesetMetadata?.vector_layers && tilesetMetadata.vector_layers.length > 0
          ? tilesetMetadata.vector_layers.map((vl) => ({ id: vl.id, fields: vl.fields }))
          : [{ id: tilesetId?.split('.').pop() ?? 'default', fields: undefined }];

      const labelLayerId = firstLocationLabelId(m);
      const beforeId = labelLayerId && m.getLayer(labelLayerId) ? labelLayerId : undefined;

      const newSpecs: ParkingLayerSpec[] = [];
      for (const sl of sourceLayers) {
        const specs = addParkingClassLayers({
          map: m,
          sourceId,
          sourceLayer: sl.id,
          fields: sl.fields,
          effectiveNow: effectiveNowRef.current,
          beforeId,
          iconsLoaded
        });
        newSpecs.push(...specs);
      }

      layerSpecsRef.current = newSpecs;
      setParkingLayerVisibility(m, newSpecs, layersRef.current.rules);
      registerClickHandlers(newSpecs);
      ensureCrowdLayers(m, openCrowdCardRef);
      setCrowdVisibility(m, layersRef.current);
      setLayersAdded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    metadataResolved,
    tilesetMetadata,
    tilesetUrl,
    tilesetId,
    mapboxAccessToken,
    layersAdded,
    registerClickHandlers
  ]);

  // Re-apply filters when the preview time or layer toggles change.
  // An open detail sheet reads `effectiveNow` from React, so it updates too.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (layerSpecsRef.current.length > 0) {
      applyEffectiveNow(m, layerSpecsRef.current, effectiveNow);
      setParkingLayerVisibility(m, layerSpecsRef.current, layers.rules);
    }
    setCrowdVisibility(m, layers);
  }, [effectiveNow, communityTick, layers]);

  // Geocoder search.
  const fetchGeocode = useCallback(
    async (query: string) => {
      if (!query.trim() || !mapboxAccessToken) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          access_token: mapboxAccessToken,
          proximity: `${MUMBAI_CENTER.lng},${MUMBAI_CENTER.lat}`,
          limit: '5'
        });
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${params}`
        );
        const data = await res.json();
        const features: GeocodeFeature[] = (data.features || []).map(
          (f: { id: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center
          })
        );
        setSearchResults(features);
      } catch (err) {
        console.error('Geocoding error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [mapboxAccessToken]
  );

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchGeocode(searchQuery);
      searchDebounceRef.current = null;
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, fetchGeocode]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !draftPin) {
      return;
    }
    const marker = new maplibregl.Marker({ color: pinMode === 'tow' ? '#ea580c' : '#7c3aed' })
      .setLngLat([draftPin.lng, draftPin.lat])
      .addTo(m);
    return () => {
      marker.remove();
    };
  }, [draftPin, pinMode, mapReady]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (!pinModeRef.current) return;
      const ids = clickableLayerIds(layerSpecsRef.current).filter((id) => m.getLayer(id));
      if (ids.length > 0) {
        const hits = m.queryRenderedFeatures(event.point, { layers: ids });
        if (hits.length > 0) return;
      }
      setDraftPin({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    m.on('click', onClick);
    return () => {
      m.off('click', onClick);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !supabasePublicEnv()) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const [towResult, suggestionResult, correctionResult] = await Promise.all([
        supabase
          .from('tow_alerts')
          .select('id, lng, lat, note, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('parking_suggestions')
          .select('id, name, parking_type, lng, lat, comment, status')
          .in('status', ['pending', 'approved'])
          .limit(500),
        supabase
          .from('parking_corrections')
          .select('id, feature_name, kind, comment, created_at, status, lng, lat')
          .order('created_at', { ascending: false })
          .limit(40)
      ]);
      if (cancelled) return;
      const m = map.current;
      if (m && m.getSource(TOW_SOURCE_ID)) {
        const source = m.getSource(TOW_SOURCE_ID) as maplibregl.GeoJSONSource;
        const rows = towResult.data ?? [];
        source.setData(
          pointsToGeoJSON(
            rows.map((row) => ({
              id: row.id,
              lng: row.lng,
              lat: row.lat,
              properties: {
                note: row.note ?? '',
                weight: towWeight(row.created_at),
                created_at: row.created_at,
                age_label: formatRelative(row.created_at)
              }
            }))
          )
        );
      }
      if (m && m.getSource(COMMUNITY_SOURCE_ID)) {
        const source = m.getSource(COMMUNITY_SOURCE_ID) as maplibregl.GeoJSONSource;
        const rows = suggestionResult.data ?? [];
        source.setData(
          pointsToGeoJSON(
            rows.map((row) => ({
              id: row.id,
              lng: row.lng,
              lat: row.lat,
              properties: {
                name: row.name,
                parking_type: row.parking_type,
                comment: row.comment,
                status: row.status
              }
            }))
          )
        );
      }
      setCorrections((correctionResult.data ?? []) as CorrectionRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, communityTick, userId, layersAdded]);

  const handleSelectPlace = useCallback((feature: GeocodeFeature) => {
    const m = map.current;
    if (!m) return;
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
    const el = document.createElement('div');
    el.className = 'search-marker-pin';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.backgroundImage =
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%233b82f6\'%3E%3Cpath d=\'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z\'/%3E%3C/svg%3E")';
    el.style.backgroundSize = 'contain';
    el.style.cursor = 'pointer';
    searchMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(feature.center)
      .addTo(m);
    m.flyTo({ center: feature.center, zoom: FLY_TO_ZOOM, duration: 1200 });
    setSearchQuery('');
    setSearchResults([]);
    setSearchDropdownOpen(false);
  }, []);

  const handleTimeOverrideChange = useCallback((next: Date | null) => {
    setOverride(next);
  }, []);

  const selectedFeature =
    parkingSelection?.features[
      Math.min(selectionIndex, Math.max(parkingSelection.features.length - 1, 0))
    ] ?? null;
  const sheetOpen = Boolean(selectedFeature || noteHtml);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading map...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute left-3 right-3 top-20 z-30 rounded-lg bg-red-100 px-4 py-2 text-red-800 sm:left-4 sm:right-auto dark:bg-red-900 dark:text-red-200">
          <p>{error}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-start gap-2 px-3 sm:pr-16">
      <TimeOverrideChip
        effectiveNow={effectiveNow}
        isOverridden={override !== null}
        onChange={handleTimeOverrideChange}
      />

      {mapboxAccessToken && (
        <div className="pointer-events-auto min-w-0 max-w-xl flex-1 rounded-2xl border border-white/10 bg-black/75 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/5 backdrop-blur-md">
          <div className="relative flex items-center gap-2 px-3.5 py-2">
            <svg
              className="h-5 w-5 shrink-0 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              onBlur={() => setTimeout(() => setSearchDropdownOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchDropdownOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search Mumbai"
              className="min-w-0 flex-1 rounded-lg border-0 bg-transparent py-2 text-base text-white placeholder-white/50 focus:ring-0 sm:py-1.5 sm:text-sm"
              aria-label="Search for a place"
              aria-autocomplete="list"
            />
            {isSearching ? (
              <div
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            ) : searchQuery.length > 0 ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                aria-label="Clear search"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="h-3 w-3"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          {searchDropdownOpen && (searchResults.length > 0 || isSearching) && (
            <ul className="max-h-60 overflow-auto border-t border-white/10 py-1" role="listbox">
              {isSearching && searchResults.length === 0 ? (
                <li className="px-4 py-3 text-sm text-white/60">Searching...</li>
              ) : (
                searchResults.map((feature) => (
                  <li
                    key={feature.id}
                    role="option"
                    aria-selected={false}
                    className="cursor-pointer px-4 py-3 text-sm text-white/90 hover:bg-white/10"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectPlace(feature);
                    }}
                  >
                    <span className="font-medium">{feature.place_name.split(',')[0]}</span>
                    {feature.place_name.includes(',') && (
                      <span className="ml-1 text-white/60">
                        {feature.place_name.split(',').slice(1).join(',').trim()}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
      </div>

      <DemoTour />

      <MapLegend
        layers={layers}
        onToggle={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))}
      />

      {caption && !searchDropdownOpen && !sheetOpen && (
        <p className="pointer-events-none absolute left-4 top-[5.25rem] z-10 hidden max-w-md text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:block">
          {caption}
        </p>
      )}

      <ReportDock
        signedIn={Boolean(userId)}
        pinMode={pinMode}
        correctionCount={corrections.length}
        correctionsOpen={correctionsOpen}
        onSuggest={() => {
          setPinMode((current) => (current === 'suggest' ? null : 'suggest'));
          setDraftPin(null);
          setCorrectionsOpen(false);
        }}
        onTow={() => {
          setPinMode((current) => (current === 'tow' ? null : 'tow'));
          setDraftPin(null);
          setCorrectionsOpen(false);
        }}
        onCorrections={() => {
          setCorrectionsOpen((open) => !open);
          setPinMode(null);
          setDraftPin(null);
        }}
      />

      {draftPin && pinMode && (
        <PinForm
          mode={pinMode}
          lng={draftPin.lng}
          lat={draftPin.lat}
          onCancel={() => setDraftPin(null)}
          onSaved={() => {
            setDraftPin(null);
            setPinMode(null);
            setCommunityTick((n) => n + 1);
          }}
        />
      )}

      <CorrectionsDrawer
        open={correctionsOpen}
        rows={corrections}
        onClose={() => setCorrectionsOpen(false)}
        onFocus={(lng, lat) => {
          map.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
        }}
      />

      <div ref={mapContainer} className="h-full w-full" />

      {sheetOpen && (
        <DetailSheet
          key={
            parkingSelection
              ? `${parkingSelection.lngLat.lng.toFixed(5)},${parkingSelection.lngLat.lat.toFixed(5)}`
              : 'note'
          }
          title={selectedFeature ? 'Parking details' : 'Report'}
          onClose={dismissSheet}
        >
          {selectedFeature && parkingSelection ? (
            <ParkingPopup
              feature={selectedFeature}
              effectiveNow={effectiveNow}
              lngLat={parkingSelection.lngLat}
              refreshKey={communityTick}
              stackIndex={Math.min(selectionIndex, parkingSelection.features.length - 1)}
              stackSize={parkingSelection.features.length}
              onNext={() =>
                setSelectionIndex((index) => (index + 1) % parkingSelection.features.length)
              }
              onCommunityChange={() => setCommunityTick((n) => n + 1)}
            />
          ) : noteHtml ? (
            <div dangerouslySetInnerHTML={{ __html: noteHtml }} />
          ) : null}
        </DetailSheet>
      )}
    </div>
  );
}

const CROWD_FONT = ['Open Sans Semibold', 'Noto Sans Regular'];

function ensureCrowdLayers(
  map: maplibregl.Map,
  openCard: {
    current: (
      lngLat: maplibregl.LngLat,
      html: string,
      target?: { targetType: 'tow' | 'suggestion'; targetId: string }
    ) => void
  }
) {
  if (!map.getSource(TOW_SOURCE_ID)) {
    map.addSource(TOW_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
  }
  if (!map.getLayer(TOW_HEAT_LAYER_ID)) {
    map.addLayer({
      id: TOW_HEAT_LAYER_ID,
      type: 'heatmap',
      source: TOW_SOURCE_ID,
      maxzoom: 15,
      paint: {
        'heatmap-weight': ['coalesce', ['get', 'weight'], 0.5],
        'heatmap-intensity': 0.8,
        'heatmap-radius': 28,
        'heatmap-opacity': 0.7,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,0,0)',
          0.3,
          '#fdba74',
          0.7,
          '#ea580c',
          1,
          '#b91c1c'
        ]
      }
    });
  }
  if (!map.getLayer(TOW_POINT_LAYER_ID)) {
    map.addLayer({
      id: TOW_POINT_LAYER_ID,
      type: 'circle',
      source: TOW_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 8, 17, 11],
        'circle-color': '#ea580c',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    map.on('click', TOW_POINT_LAYER_ID, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};
      const targetId = props.id == null ? '' : String(props.id);
      openCard.current(event.lngLat, towCardHtml(props), targetId ? { targetType: 'tow', targetId } : undefined);
    });
    map.on('mouseenter', TOW_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', TOW_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  }
  if (!map.getLayer(TOW_LABEL_LAYER_ID)) {
    try {
      map.addLayer({
        id: TOW_LABEL_LAYER_ID,
        type: 'symbol',
        source: TOW_SOURCE_ID,
        minzoom: 13,
        layout: {
          'text-field': ['concat', 'Tow crew · ', ['coalesce', ['get', 'age_label'], '']],
          'text-font': CROWD_FONT,
          'text-size': 11,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true
        },
        paint: {
          'text-color': '#9a3412',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4
        }
      });
    } catch (err) {
      console.warn('Could not add tow labels:', err);
    }
  }
  if (!map.getSource(COMMUNITY_SOURCE_ID)) {
    map.addSource(COMMUNITY_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
  }
  if (!map.getLayer(COMMUNITY_LAYER_ID)) {
    map.addLayer({
      id: COMMUNITY_LAYER_ID,
      type: 'circle',
      source: COMMUNITY_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 9],
        'circle-color': ['case', ['==', ['get', 'status'], 'pending'], '#7c3aed', '#059669'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    map.on('click', COMMUNITY_LAYER_ID, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};
      const targetId = props.id == null ? '' : String(props.id);
      openCard.current(
        event.lngLat,
        communityCardHtml(props),
        targetId ? { targetType: 'suggestion', targetId } : undefined
      );
    });
    map.on('mouseenter', COMMUNITY_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', COMMUNITY_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  }
  if (!map.getLayer(COMMUNITY_LABEL_LAYER_ID)) {
    try {
      map.addLayer({
        id: COMMUNITY_LABEL_LAYER_ID,
        type: 'symbol',
        source: COMMUNITY_SOURCE_ID,
        minzoom: 14.5,
        layout: {
          'text-field': ['coalesce', ['get', 'name'], 'Suggested spot'],
          'text-font': CROWD_FONT,
          'text-size': 11,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true
        },
        paint: {
          'text-color': ['case', ['==', ['get', 'status'], 'pending'], '#5b21b6', '#065f46'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4
        }
      });
    } catch (err) {
      console.warn('Could not add community labels:', err);
    }
  }
}

function setCrowdVisibility(map: maplibregl.Map, layers: MapLayers) {
  const show = (id: string, visible: boolean) => {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  };
  show(TOW_HEAT_LAYER_ID, layers.tows);
  show(TOW_POINT_LAYER_ID, layers.tows);
  show(TOW_LABEL_LAYER_ID, layers.tows);
  show(COMMUNITY_LAYER_ID, layers.community);
  show(COMMUNITY_LABEL_LAYER_ID, layers.community);
}

function uniqueParkingHits(
  features: maplibregl.MapGeoJSONFeature[]
): maplibregl.MapGeoJSONFeature[] {
  const seen = new Set<string>();
  const unique: maplibregl.MapGeoJSONFeature[] = [];
  for (const feature of features) {
    const props = feature.properties ?? {};
    const key = [
      props.parking_type ?? '',
      props.name ?? '',
      props.address ?? '',
      feature.geometry?.type ?? ''
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(feature);
  }
  return unique;
}

function towCardHtml(props: Record<string, unknown>): string {
  const age =
    typeof props.age_label === 'string' && props.age_label
      ? props.age_label
      : typeof props.created_at === 'string'
        ? formatRelative(props.created_at)
        : 'Recently';
  const note = typeof props.note === 'string' ? props.note.trim() : '';
  return `<div style="font-family:sans-serif;color:#1c1917">
    <div style="font-size:14px;font-weight:700">Tow crew reported</div>
    <div style="margin-top:4px;font-size:13px">${escapeHtml(age)}</div>
    ${note ? `<div style="margin-top:6px;font-size:13px">${escapeHtml(note)}</div>` : ''}
    <div style="margin-top:8px;font-size:12px;line-height:1.4;color:#57534e">A driver reported a tow crew here. This is not an official tow-away zone.</div>
  </div>`;
}

function communityCardHtml(props: Record<string, unknown>): string {
  const name = typeof props.name === 'string' && props.name.trim() ? props.name.trim() : 'Suggested spot';
  const kind = parkingTypeLabel(typeof props.parking_type === 'string' ? props.parking_type : '');
  const pending = props.status === 'pending';
  const comment = typeof props.comment === 'string' ? props.comment.trim() : '';
  const status = pending
    ? 'Pending review. Only you can see this until it is approved.'
    : 'Community suggestion. Not an official rule.';
  return `<div style="font-family:sans-serif;color:#1c1917">
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#57534e">${pending ? 'Pending suggestion' : 'Community spot'}</div>
    <div style="margin-top:4px;font-size:14px;font-weight:700">${escapeHtml(name)}</div>
    <div style="margin-top:4px;font-size:13px">${escapeHtml(kind)}</div>
    ${comment ? `<div style="margin-top:6px;font-size:13px">${escapeHtml(comment)}</div>` : ''}
    <div style="margin-top:8px;font-size:12px;line-height:1.4;color:#57534e">${status}</div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
