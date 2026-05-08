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
import { createRoot, type Root } from 'react-dom/client';
import ParkingPopup from './ParkingPopup';
import TimeOverrideChip from './TimeOverrideChip';
import {
  PARKING_TYPE_ICONS,
  addParkingClassLayers,
  applyEffectiveNow,
  clickableLayerIds,
  type ParkingLayerSpec
} from './parkingLayers';

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

interface OpenPopup {
  popup: maplibregl.Popup;
  root: Root;
  container: HTMLDivElement;
  feature: maplibregl.MapGeoJSONFeature;
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

export default function MapView({ tilesetUrl, tilesetId, mapboxAccessToken }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const layerSpecsRef = useRef<ParkingLayerSpec[]>([]);
  const popupRef = useRef<OpenPopup | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tilesetMetadata, setTilesetMetadata] = useState<TilesetMetadata | null>(null);
  const [layersAdded, setLayersAdded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [override, setOverride] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
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
    if (!tilesetId) return;
    let cancelled = false;
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
      pitch: MUMBAI_CENTER.pitch
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
      if (popupRef.current) {
        popupRef.current.popup.remove();
        try {
          popupRef.current.root.unmount();
        } catch {}
        popupRef.current = null;
      }
      m.remove();
      map.current = null;
    };
  }, []);

  const closeOpenPopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.popup.remove();
    }
  }, []);

  const openParkingPopup = useCallback(
    (lngLat: maplibregl.LngLatLike, feature: maplibregl.MapGeoJSONFeature) => {
      const m = map.current;
      if (!m) return;

      closeOpenPopup();

      const container = document.createElement('div');
      const root = createRoot(container);
      const popup = new maplibregl.Popup({
        offset: 24,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '360px'
      })
        .setLngLat(lngLat)
        .setDOMContent(container)
        .addTo(m);

      const ref: OpenPopup = { popup, root, container, feature };
      popup.on('close', () => {
        try {
          root.unmount();
        } catch {}
        if (popupRef.current?.popup === popup) {
          popupRef.current = null;
        }
      });
      popupRef.current = ref;
      root.render(
        <ParkingPopup feature={feature} effectiveNow={effectiveNowRef.current} />
      );
    },
    [closeOpenPopup]
  );

  // Single delegated click handler over every parking layer.
  const registerClickHandlers = useCallback(
    (specs: ParkingLayerSpec[]) => {
      const m = map.current;
      if (!m) return;
      const ids = clickableLayerIds(specs);
      for (const id of ids) {
        m.on('click', id, (e) => {
          const features = m.queryRenderedFeatures(e.point, { layers: [id] });
          if (!features || features.length === 0) return;
          openParkingPopup(e.lngLat, features[0]);
        });
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

      const newSpecs: ParkingLayerSpec[] = [];
      for (const sl of sourceLayers) {
        const specs = addParkingClassLayers({
          map: m,
          sourceId,
          sourceLayer: sl.id,
          fields: sl.fields,
          effectiveNow: effectiveNowRef.current,
          iconsLoaded
        });
        newSpecs.push(...specs);
      }

      layerSpecsRef.current = newSpecs;
      registerClickHandlers(newSpecs);
      setLayersAdded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    tilesetMetadata,
    tilesetUrl,
    tilesetId,
    mapboxAccessToken,
    layersAdded,
    registerClickHandlers
  ]);

  // Re-apply filters and re-render any open popup when effectiveNow changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (layerSpecsRef.current.length > 0) {
      applyEffectiveNow(m, layerSpecsRef.current, effectiveNow);
    }
    if (popupRef.current) {
      popupRef.current.root.render(
        <ParkingPopup feature={popupRef.current.feature} effectiveNow={effectiveNow} />
      );
    }
  }, [effectiveNow]);

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
        <div className="absolute top-4 left-4 z-30 rounded-lg bg-red-100 px-4 py-2 text-red-800 dark:bg-red-900 dark:text-red-200">
          <p>{error}</p>
        </div>
      )}

      <TimeOverrideChip
        effectiveNow={effectiveNow}
        isOverridden={override !== null}
        onChange={handleTimeOverrideChange}
      />

      {mapboxAccessToken && (
        <div className="absolute top-4 left-1/2 z-20 w-full max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur">
          <div className="relative flex items-center gap-2 px-3 py-2">
            <svg
              className="h-5 w-5 shrink-0 text-white/50"
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
              placeholder="Search for a place..."
              className="min-w-0 flex-1 rounded-lg border-0 bg-transparent py-1.5 text-sm text-white placeholder-white/50 focus:ring-0"
              aria-label="Search for a place"
              aria-autocomplete="list"
            />
            {isSearching && (
              <div
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            )}
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
                    className="cursor-pointer px-4 py-2.5 text-sm text-white/90 hover:bg-white/10"
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

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
