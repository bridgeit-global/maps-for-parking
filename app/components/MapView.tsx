'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Default camera: Mumbai peninsula overview (entire island + surroundings)
const MUMBAI_CENTER = {
  lng: 72.83,
  lat: 19.0,
  zoom: 12.5,
  bearing: 15,
  pitch: 45
};

const GEOCODE_DEBOUNCE_MS = 300;
const FLY_TO_ZOOM = 15;

const PARKING_COLORS = {
  blue: '#3b82f6',
  lightGreen: '#90EE90',
  lightGray: '#9ca3af',
  defaultGray: '#6b7280'
} as const;

const PARKING_TYPE_ICONS = {
  no: { url: '/icons/no-parking.png', id: 'no-parking-icon' },
  onStreet: { url: '/icons/street-parking.png', id: 'on-street-icon' },
  offStreet: { url: '/icons/off-street-parking.png', id: 'off-street-icon' }
} as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/** Icon-image: no-parking for no, free, even, odd; onStreet/offStreet keep their icons. */
function getParkingTypeIconImageExpression(typeField: string): (string | string[])[] {
  return [
    'match',
    ['get', typeField],
    'no', PARKING_TYPE_ICONS.no.id,
    'free', PARKING_TYPE_ICONS.no.id,
    'onStreet', PARKING_TYPE_ICONS.onStreet.id,
    'offStreet', PARKING_TYPE_ICONS.offStreet.id,
    'even', PARKING_TYPE_ICONS.no.id,
    'odd', PARKING_TYPE_ICONS.no.id,
    PARKING_TYPE_ICONS.no.id
  ];
}

/** Current time as decimal hours 0-24. */
function getCurrentTimeHours(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Build fill/line/circle color expression: no-parking (gray) only when rules apply; else blue/default. */
function getNoParkingAwareColorExpression(
  typeField: string,
  openingField: string | undefined,
  closingField: string | undefined,
  currentDay: number,
  currentTime: number
): maplibregl.ExpressionSpecification {
  const { blue, lightGray, defaultGray } = PARKING_COLORS;
  const dayLiteral = ['literal', currentDay] as [string, number];
  const timeLiteral = ['literal', currentTime] as [string, number];

  const freeColorExpression: maplibregl.ExpressionSpecification =
    (!openingField || !closingField
      ? blue
      : [
          'case',
          ['all', ['==', ['coalesce', ['get', openingField], 0], 0], ['==', ['coalesce', ['get', closingField], 24], 24]],
          blue,
          ['>=', ['coalesce', ['get', closingField], 24], ['coalesce', ['get', openingField], 0]],
          [
            'case',
            [
              'any',
              ['<', timeLiteral, ['coalesce', ['get', openingField], 0]],
              ['>=', timeLiteral, ['coalesce', ['get', closingField], 24]]
            ],
            lightGray,
            blue
          ],
          [
            'case',
            [
              'all',
              ['>=', timeLiteral, ['coalesce', ['get', closingField], 24]],
              ['<', timeLiteral, ['coalesce', ['get', openingField], 0]]
            ],
            lightGray,
            blue
          ]
        ]) as unknown as maplibregl.ExpressionSpecification;

  return [
    'case',
    ['==', ['get', typeField], 'no'],
    lightGray,
    ['==', ['get', typeField], 'onStreet'],
    blue,
    ['==', ['get', typeField], 'offStreet'],
    blue,
    ['==', ['get', typeField], 'odd'],
    ['case', ['==', ['%', dayLiteral, 2], 0], lightGray, blue],
    ['==', ['get', typeField], 'even'],
    ['case', ['==', ['%', dayLiteral, 2], 1], lightGray, blue],
    ['==', ['get', typeField], 'free'],
    freeColorExpression,
    defaultGray
  ] as maplibregl.ExpressionSpecification;
}

/** Build filter: show feature only when it is "currently no parking" (for no-parking icon layers). */
function getNoParkingIconFilter(
  geometryType: 'Polygon' | 'LineString' | 'Point',
  typeField: string,
  openingField: string | undefined,
  closingField: string | undefined,
  currentDay: number,
  currentTime: number
): maplibregl.FilterSpecification {
  const dayLiteral = ['literal', currentDay] as [string, number];
  const timeLiteral = ['literal', currentTime] as [string, number];

  const freeIsNoParking: maplibregl.ExpressionSpecification =
    (!openingField || !closingField
      ? ['literal', false]
      : [
          'all',
          ['any', ['!=', ['coalesce', ['get', openingField], 0], 0], ['!=', ['coalesce', ['get', closingField], 24], 24]],
          [
            'case',
            ['>=', ['coalesce', ['get', closingField], 24], ['coalesce', ['get', openingField], 0]],
            ['any', ['<', timeLiteral, ['coalesce', ['get', openingField], 0]], ['>=', timeLiteral, ['coalesce', ['get', closingField], 24]]],
            ['all', ['>=', timeLiteral, ['coalesce', ['get', closingField], 24]], ['<', timeLiteral, ['coalesce', ['get', openingField], 0]]]
          ]
        ]) as unknown as maplibregl.ExpressionSpecification;

  const isNoParkingNow = [
    'case',
    ['==', ['get', typeField], 'no'],
    true,
    ['==', ['get', typeField], 'odd'],
    ['==', ['%', dayLiteral, 2], 0],
    ['==', ['get', typeField], 'even'],
    ['==', ['%', dayLiteral, 2], 1],
    ['==', ['get', typeField], 'free'],
    freeIsNoParking,
    false
  ] as maplibregl.ExpressionSpecification;

  return ['all', ['==', ['geometry-type'], geometryType], isNoParkingNow] as maplibregl.FilterSpecification;
}

/** Filter that excludes free parking so only no-parking and paid (onStreet/offStreet) are shown. */
function excludeFreeParkingFilter(
  geometryType: 'Polygon' | 'LineString' | 'Point',
  typeField: string | undefined
): maplibregl.FilterSpecification {
  const geometryFilter = ['==', ['geometry-type'], geometryType];
  if (!typeField) return geometryFilter as maplibregl.FilterSpecification;
  return ['all', geometryFilter, ['!=', ['get', typeField], 'free']] as unknown as maplibregl.FilterSpecification;
}

/** Append exclude-free to an existing filter (for icon layers). */
function andExcludeFree(filter: maplibregl.FilterSpecification, typeField: string): maplibregl.FilterSpecification {
  return ['all', filter, ['!=', ['get', typeField], 'free']] as unknown as maplibregl.FilterSpecification;
}

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
    fields?: Record<string, any>;
    description?: string;
    minzoom?: number;
    maxzoom?: number;
  }>;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  minzoom?: number;
  maxzoom?: number;
}

export default function MapView({ tilesetUrl, tilesetId, mapboxAccessToken }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tilesetMetadata, setTilesetMetadata] = useState<TilesetMetadata | null>(null);
  const [dataLayers, setDataLayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parkingTypeIconsLoadedRef = useRef(false);

  type PaintPropertyName = 'fill-color' | 'line-color' | 'circle-color';
  const noParkingDynamicPaintLayersRef = useRef<Array<{
    layerId: string;
    paintProperty: PaintPropertyName;
    typeField: string;
    openingField?: string;
    closingField?: string;
  }>>([]);
  const noParkingDynamicFilterLayersRef = useRef<Array<{
    layerId: string;
    geometryType: 'Polygon' | 'LineString' | 'Point';
    typeField: string;
    openingField?: string;
    closingField?: string;
  }>>([]);
  const noParkingUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch tileset metadata to understand the data structure
  useEffect(() => {
    const fetchTilesetMetadata = async () => {
      if (!tilesetId) return;

      try {
        const response = await fetch(
          `/api/tileset/metadata?tilesetId=${encodeURIComponent(tilesetId)}`
        );

        if (response.ok) {
          const data = await response.json();
          console.log('Tileset metadata:', data);
          setTilesetMetadata(data.metadata);
          
          // Extract layer names
          const layers = data.layers?.map((layer: any) => layer.id) || [];
          setDataLayers(layers);
          console.log('Available data layers:', layers);
          
          // Log field information for each layer
          data.layers?.forEach((layer: any) => {
            console.log(`Layer "${layer.id}" fields:`, layer.fields);
          });
        } else {
          console.error('Failed to fetch tileset metadata:', await response.text());
        }
      } catch (err) {
        console.error('Error fetching tileset metadata:', err);
      }
    };

    fetchTilesetMetadata();
  }, [tilesetId]);

  // Geocode search: debounced fetch from Mapbox Geocoding API v5
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
          limit: '5',
        });
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${params}`
        );
        const data = await res.json();
        const features: GeocodeFeature[] = (data.features || []).map((f: { id: string; place_name: string; center: [number, number] }) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        }));
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

  const handleSelectPlace = useCallback(
    (feature: GeocodeFeature) => {
      const mapInstance = map.current;
      if (!mapInstance) return;
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
      const el = document.createElement('div');
      el.className = 'search-marker-pin';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%233b82f6\'%3E%3Cpath d=\'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z\'/%3E%3C/svg%3E")';
      el.style.backgroundSize = 'contain';
      el.style.cursor = 'pointer';
      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(feature.center)
        .addTo(mapInstance);
      mapInstance.flyTo({ center: feature.center, zoom: FLY_TO_ZOOM, duration: 1200 });
      setSearchQuery('');
      setSearchResults([]);
      setSearchDropdownOpen(false);
    },
    []
  );

  // Parking layers are added without beforeId so they render on top of all basemap
  // layers (roads, text, POIs), making them the most prominent visual element.

  // Apply current date/time to all no-parking dynamic layers (paint + filter)
  const applyNoParkingDynamicUpdate = useCallback((mapInstance: maplibregl.Map) => {
    const currentDay = new Date().getDate();
    const currentTime = getCurrentTimeHours();
    for (const entry of noParkingDynamicPaintLayersRef.current) {
      try {
        if (!mapInstance.getLayer(entry.layerId)) continue;
        const expr = getNoParkingAwareColorExpression(
          entry.typeField,
          entry.openingField,
          entry.closingField,
          currentDay,
          currentTime
        );
        mapInstance.setPaintProperty(entry.layerId, entry.paintProperty, expr);
      } catch {
        // layer may have been removed
      }
    }
    for (const entry of noParkingDynamicFilterLayersRef.current) {
      try {
        if (!mapInstance.getLayer(entry.layerId)) continue;
        const filter = getNoParkingIconFilter(
          entry.geometryType,
          entry.typeField,
          entry.openingField,
          entry.closingField,
          currentDay,
          currentTime
        );
        mapInstance.setFilter(entry.layerId, filter);
      } catch {
        // layer may have been removed
      }
    }
  }, []);

  // Function to add tileset layers with dynamic styling
  const addTilesetLayers = (
    mapInstance: maplibregl.Map,
    sourceId: string,
    metadata: TilesetMetadata | null,
    beforeId?: string
  ) => {
    noParkingDynamicPaintLayersRef.current = [];
    noParkingDynamicFilterLayersRef.current = [];
    if (noParkingUpdateIntervalRef.current) {
      clearInterval(noParkingUpdateIntervalRef.current);
      noParkingUpdateIntervalRef.current = null;
    }

    if (!metadata?.vector_layers || metadata.vector_layers.length === 0) {
      // Fallback: Add a generic layer if no metadata
      addGenericParkingLayer(mapInstance, sourceId, beforeId);
      return;
    }

    metadata.vector_layers.forEach((layer, index) => {
      const layerId = layer.id;
      const fields = layer.fields || {};
      
      console.log(`Adding layer: ${layerId}`, fields);

      // Determine geometry type and add appropriate layer (below labels)
      addLayerBasedOnFields(mapInstance, sourceId, layerId, fields, index, beforeId);
    });
  };


  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize the map with Carto vector basemap (has separate label layers)
    // This allows us to insert custom layers below labels
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [MUMBAI_CENTER.lng, MUMBAI_CENTER.lat],
      zoom: MUMBAI_CENTER.zoom,
      bearing: MUMBAI_CENTER.bearing ?? 0,
      pitch: MUMBAI_CENTER.pitch ?? 0
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Add geolocate control
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      }),
      'top-right'
    );

    // Handle map load
    map.current.on('load', () => {
      setIsLoading(false);

      // Print camera angle details for use as default (center, zoom, bearing, pitch)
      const center = map.current!.getCenter();
      const zoom = map.current!.getZoom();
      const bearing = map.current!.getBearing();
      const pitch = map.current!.getPitch();
      const camera = {
        center: [center.lng, center.lat] as [number, number],
        zoom: Math.round(zoom * 100) / 100,
        bearing: Math.round(bearing * 100) / 100,
        pitch: Math.round(pitch * 100) / 100
      };
      console.log(
        '%cDefault camera (copy for map options)',
        'font-weight:bold;',
        '\nconst DEFAULT_CAMERA =',
        JSON.stringify(camera, null, 2) + ';',
        '\n// Or for MUMBAI_CENTER style:',
        { lng: center.lng, lat: center.lat, zoom: camera.zoom }
      );
      
      // Add tileset source if provided
      if (tilesetUrl || tilesetId) {
        try {
          const sourceId = 'parking-tileset';
          const sourceConfig: any = {
            type: 'vector',
            tiles: [],
            minzoom: tilesetMetadata?.minzoom || 0,
            maxzoom: tilesetMetadata?.maxzoom || 22
          };

          if (tilesetMetadata?.bounds) {
            sourceConfig.bounds = tilesetMetadata.bounds;
          }

          if (tilesetUrl) {
            // If full URL is provided
            sourceConfig.tiles = [tilesetUrl];
          } else if (tilesetId && mapboxAccessToken) {
            // If Mapbox tileset ID is provided
            sourceConfig.tiles = [
              `https://api.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.vector.pbf?access_token=${mapboxAccessToken}`
            ];
          } else if (tilesetId) {
            // If just tileset ID, assume it's a Mapbox tileset
            sourceConfig.url = `mapbox://${tilesetId}`;
          }

          // Add the source
          if (map.current && (sourceConfig.tiles.length > 0 || sourceConfig.url)) {
            console.log('Adding tileset source:', sourceConfig);
            map.current.addSource(sourceId, sourceConfig);

            // Load all parking type icons then add parking layers
            (async () => {
              if (!map.current) return;
              try {
                const results = await Promise.allSettled([
                  loadImage(PARKING_TYPE_ICONS.no.url),
                  loadImage(PARKING_TYPE_ICONS.onStreet.url),
                  loadImage(PARKING_TYPE_ICONS.offStreet.url)
                ]);
                const [noImg, onStreetImg, offStreetImg] = results;
                if (noImg.status === 'fulfilled') map.current.addImage(PARKING_TYPE_ICONS.no.id, noImg.value, { pixelRatio: 2 });
                if (onStreetImg.status === 'fulfilled') map.current.addImage(PARKING_TYPE_ICONS.onStreet.id, onStreetImg.value, { pixelRatio: 2 });
                if (offStreetImg.status === 'fulfilled') map.current.addImage(PARKING_TYPE_ICONS.offStreet.id, offStreetImg.value, { pixelRatio: 2 });
                parkingTypeIconsLoadedRef.current = true;
              } catch (err) {
                console.warn('Parking type icons not loaded, skipping icon layers:', err);
              }
              if (map.current) {
                addTilesetLayers(map.current, sourceId, tilesetMetadata);
                if (
                  noParkingDynamicPaintLayersRef.current.length > 0 ||
                  noParkingDynamicFilterLayersRef.current.length > 0
                ) {
                  applyNoParkingDynamicUpdate(map.current);
                  noParkingUpdateIntervalRef.current = setInterval(() => {
                    if (map.current) applyNoParkingDynamicUpdate(map.current);
                  }, 60000);
                }
              }
            })();
          }
        } catch (err) {
          console.error('Error adding tileset:', err);
          setError('Failed to load parking data tileset');
        }
      }
    });

    // Handle errors
    map.current.on('error', (e) => {
      console.error('Map error:', e);
      setError('Failed to load map');
      setIsLoading(false);
    });

    // Cleanup
    return () => {
      if (noParkingUpdateIntervalRef.current) {
        clearInterval(noParkingUpdateIntervalRef.current);
        noParkingUpdateIntervalRef.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [tilesetUrl, tilesetId, mapboxAccessToken, tilesetMetadata, applyNoParkingDynamicUpdate]);

  // Function to add layer with appropriate styling based on fields
  // beforeId parameter ensures layers are added below labels
  const addLayerBasedOnFields = (
    mapInstance: maplibregl.Map,
    sourceId: string,
    sourceLayer: string,
    fields: Record<string, any>,
    layerIndex: number,
    beforeId?: string
  ) => {
    // Create style expressions based on available fields
    const styleExpressions = createStyleExpressions(fields);
    const currentDay = new Date().getDate();
    const currentTime = getCurrentTimeHours();
    const typeField = styleExpressions.typeField;
    const openingField = styleExpressions.openingTimeField;
    const closingField = styleExpressions.closingTimeField;
    const useDynamicNoParking = Boolean(typeField);
    const dynamicColor =
      useDynamicNoParking
        ? getNoParkingAwareColorExpression(typeField!, openingField, closingField, currentDay, currentTime)
        : styleExpressions.fillColor;

    // Only show features that are currently no parking (hide parkable: onStreet, offStreet, odd on odd dates, even on even dates)
    const polygonNoParkingFilter =
      useDynamicNoParking
        ? getNoParkingIconFilter('Polygon', typeField!, openingField, closingField, currentDay, currentTime)
        : (['all', ['==', ['geometry-type'], 'Polygon'], ['literal', false]] as maplibregl.FilterSpecification);

    const fillLayerId = `${sourceLayer}-fill`;
    try {
      mapInstance.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: polygonNoParkingFilter,
        paint: {
          'fill-color': dynamicColor,
          'fill-opacity': styleExpressions.fillOpacity
        }
      }, beforeId); // Insert below labels

      if (useDynamicNoParking) {
        noParkingDynamicPaintLayersRef.current.push({
          layerId: fillLayerId,
          paintProperty: 'fill-color',
          typeField: typeField!,
          openingField,
          closingField
        });
        noParkingDynamicFilterLayersRef.current.push({
          layerId: fillLayerId,
          geometryType: 'Polygon',
          typeField: typeField!,
          openingField,
          closingField
        });
      }

      const outlineLayerId = `${sourceLayer}-outline`;
      mapInstance.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: polygonNoParkingFilter,
        paint: {
          'line-color': useDynamicNoParking ? dynamicColor : styleExpressions.outlineColor,
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      }, beforeId); // Insert below labels

      if (useDynamicNoParking) {
        noParkingDynamicPaintLayersRef.current.push({
          layerId: outlineLayerId,
          paintProperty: 'line-color',
          typeField: typeField!,
          openingField,
          closingField
        });
        noParkingDynamicFilterLayersRef.current.push({
          layerId: outlineLayerId,
          geometryType: 'Polygon',
          typeField: typeField!,
          openingField,
          closingField
        });
      }

      // Add click handler
      addClickHandler(mapInstance, fillLayerId);
      addHoverHandler(mapInstance, fillLayerId);

      // Label layer for polygons – only when currently no parking
      if (styleExpressions.typeField) {
        const labelLayerId = `${sourceLayer}-fill-label`;
        try {
          mapInstance.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: polygonNoParkingFilter,
            layout: {
              'text-field': ['get', styleExpressions.typeField],
              'text-size': 14,
              'text-anchor': 'center',
              'symbol-placement': 'point',
              'text-rotation-alignment': 'viewport'
            },
            paint: {
              'text-color': '#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5
            }
          }, beforeId);
          if (useDynamicNoParking) {
            noParkingDynamicFilterLayersRef.current.push({
              layerId: labelLayerId,
              geometryType: 'Polygon',
              typeField: typeField!,
              openingField,
              closingField
            });
          }
        } catch {
          console.log(`Could not add polygon label layer: ${labelLayerId}`);
        }
        // Parking type icons for polygons – only when currently no parking
        if (parkingTypeIconsLoadedRef.current && styleExpressions.typeField) {
          try {
            const typeIconLayerId = `${sourceLayer}-fill-type-icon`;
            mapInstance.addLayer({
              id: typeIconLayerId,
              type: 'symbol',
              source: sourceId,
              'source-layer': sourceLayer,
              filter: polygonNoParkingFilter,
              layout: {
                'icon-image': getParkingTypeIconImageExpression(styleExpressions.typeField) as maplibregl.ExpressionSpecification,
                'icon-size': 1.0,
                'icon-anchor': 'center',
                'icon-rotation-alignment': 'viewport',
                'symbol-placement': 'point'
              }
            }, beforeId);
            addClickHandler(mapInstance, typeIconLayerId);
            addHoverHandler(mapInstance, typeIconLayerId);
            if (useDynamicNoParking) {
              noParkingDynamicFilterLayersRef.current.push({
                layerId: typeIconLayerId,
                geometryType: 'Polygon',
                typeField: typeField!,
                openingField,
                closingField
              });
            }
          } catch {
            // ignore
          }
        }
      }

      console.log(`✓ Added polygon (fill) layer: ${fillLayerId} (below labels)`);
    } catch (err) {
      console.log(`No polygon geometries in ${sourceLayer}`);
    }

    const lineNoParkingFilter =
      useDynamicNoParking
        ? getNoParkingIconFilter('LineString', typeField!, openingField, closingField, currentDay, currentTime)
        : (['all', ['==', ['geometry-type'], 'LineString'], ['literal', false]] as maplibregl.FilterSpecification);

    const lineLayerId = `${sourceLayer}-line`;
    try {
      mapInstance.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: lineNoParkingFilter,
        paint: {
          'line-color': useDynamicNoParking ? dynamicColor : styleExpressions.lineColor,
          'line-width': styleExpressions.lineWidth,
          'line-opacity': 0.9
        }
      }, beforeId); // Insert below labels

      if (useDynamicNoParking) {
        noParkingDynamicPaintLayersRef.current.push({
          layerId: lineLayerId,
          paintProperty: 'line-color',
          typeField: typeField!,
          openingField,
          closingField
        });
        noParkingDynamicFilterLayersRef.current.push({
          layerId: lineLayerId,
          geometryType: 'LineString',
          typeField: typeField!,
          openingField,
          closingField
        });
      }

      addClickHandler(mapInstance, lineLayerId);
      addHoverHandler(mapInstance, lineLayerId);

      if (styleExpressions.typeField) {
        const lineLabelLayerId = `${sourceLayer}-line-label`;
        try {
          mapInstance.addLayer({
            id: lineLabelLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: lineNoParkingFilter,
            layout: {
              'text-field': ['get', styleExpressions.typeField],
              'text-size': 12,
              'text-anchor': 'center',
              'symbol-placement': 'line-center',
              'text-rotation-alignment': 'viewport'
            },
            paint: {
              'text-color': '#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5
            }
          }, beforeId);
          if (useDynamicNoParking) {
            noParkingDynamicFilterLayersRef.current.push({
              layerId: lineLabelLayerId,
              geometryType: 'LineString',
              typeField: typeField!,
              openingField,
              closingField
            });
          }
        } catch {
          console.log(`Could not add polyline label layer: ${lineLabelLayerId}`);
        }
        if (parkingTypeIconsLoadedRef.current && styleExpressions.typeField) {
          try {
            const typeIconLayerId = `${sourceLayer}-line-type-icon`;
            mapInstance.addLayer({
              id: typeIconLayerId,
              type: 'symbol',
              source: sourceId,
              'source-layer': sourceLayer,
              filter: lineNoParkingFilter,
              layout: {
                'icon-image': getParkingTypeIconImageExpression(styleExpressions.typeField) as maplibregl.ExpressionSpecification,
                'icon-size': 0.95,
                'icon-anchor': 'center',
                'icon-rotation-alignment': 'viewport',
                'symbol-placement': 'line-center'
              }
            }, beforeId);
            addClickHandler(mapInstance, typeIconLayerId);
            addHoverHandler(mapInstance, typeIconLayerId);
            if (useDynamicNoParking) {
              noParkingDynamicFilterLayersRef.current.push({
                layerId: typeIconLayerId,
                geometryType: 'LineString',
                typeField: typeField!,
                openingField,
                closingField
              });
            }
          } catch {
            // ignore
          }
        }
      }
      
      console.log(`✓ Added polyline (line) layer: ${lineLayerId} (below labels)`);
    } catch (err) {
      console.log(`No linestring geometries in ${sourceLayer}`);
    }

    const pointNoParkingFilter =
      useDynamicNoParking
        ? getNoParkingIconFilter('Point', typeField!, openingField, closingField, currentDay, currentTime)
        : (['all', ['==', ['geometry-type'], 'Point'], ['literal', false]] as maplibregl.FilterSpecification);

    const circleLayerId = `${sourceLayer}-circle`;
    try {
      mapInstance.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: pointNoParkingFilter,
        paint: {
          'circle-color': useDynamicNoParking ? dynamicColor : styleExpressions.circleColor,
          'circle-radius': styleExpressions.circleRadius,
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId); // Insert below labels

      if (useDynamicNoParking) {
        noParkingDynamicPaintLayersRef.current.push({
          layerId: circleLayerId,
          paintProperty: 'circle-color',
          typeField: typeField!,
          openingField,
          closingField
        });
        noParkingDynamicFilterLayersRef.current.push({
          layerId: circleLayerId,
          geometryType: 'Point',
          typeField: typeField!,
          openingField,
          closingField
        });
      }

      addClickHandler(mapInstance, circleLayerId);
      addHoverHandler(mapInstance, circleLayerId);

      if (parkingTypeIconsLoadedRef.current && styleExpressions.typeField) {
        try {
          const typeIconLayerId = `${sourceLayer}-circle-type-icon`;
          mapInstance.addLayer({
            id: typeIconLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: pointNoParkingFilter,
            layout: {
              'icon-image': getParkingTypeIconImageExpression(styleExpressions.typeField) as maplibregl.ExpressionSpecification,
              'icon-size': 1.1,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport'
            }
          }, beforeId);
          addClickHandler(mapInstance, typeIconLayerId);
          addHoverHandler(mapInstance, typeIconLayerId);
          if (useDynamicNoParking) {
            noParkingDynamicFilterLayersRef.current.push({
              layerId: typeIconLayerId,
              geometryType: 'Point',
              typeField: typeField!,
              openingField,
              closingField
            });
          }
        } catch {
          // ignore
        }
      }

      console.log(`✓ Added point (circle) layer: ${circleLayerId} (below labels)`);
    } catch (err) {
      console.log(`No point geometries in ${sourceLayer}`);
    }
  };

  // Create style expressions based on field types
  const createStyleExpressions = (fields: Record<string, any>) => {
    // Look for common field names to determine styling
    const fieldNames = Object.keys(fields);

    // Check for parking_type or type fields
    const typeField = fieldNames.find(
      (f) =>
        f.toLowerCase().includes('type') ||
        f.toLowerCase().includes('category') ||
        f.toLowerCase() === 'parking_type'
    );

    // Check for status fields
    const statusField = fieldNames.find(
      (f) =>
        f.toLowerCase().includes('status') || f.toLowerCase().includes('availability')
    );

    // Opening/closing time fields for free-parking rules (numeric 0-24)
    const openingTimeField = fieldNames.find(
      (f) =>
        f.toLowerCase() === 'opening_time' ||
        f.toLowerCase() === 'open_time' ||
        f.toLowerCase() === 'opening'
    );
    const closingTimeField = fieldNames.find(
      (f) =>
        f.toLowerCase() === 'closing_time' ||
        f.toLowerCase() === 'close_time' ||
        f.toLowerCase() === 'closing'
    );

    const blue = '#3b82f6';
    const lightGray = '#9ca3af';
    const lightGreen = '#166534';
    const defaultGray = '#6b7280';

    let colorExpression: any = defaultGray;

    if (typeField) {
      colorExpression = [
        'match',
        ['get', typeField],
        'onStreet',
        blue,
        'offStreet',
        blue,
        'free',
        lightGray,
        'even',
        lightGray,
        'odd',
        lightGray,
        'no',
        lightGray,
        defaultGray
      ];
    } else if (statusField) {
      colorExpression = [
        'match',
        ['get', statusField],
        'available',
        lightGreen,
        'occupied',
        '#ef4444',
        'reserved',
        '#f59e0b',
        defaultGray
      ];
    }

    return {
      fillColor: colorExpression,
      fillOpacity: 0.6,
      outlineColor: '#1f2937',
      lineColor: colorExpression,
      lineWidth: 2,
      circleColor: colorExpression,
      circleRadius: [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        3,
        15,
        6,
        20,
        12
      ] as any,
      typeField: typeField ?? statusField ?? undefined,
      openingTimeField: openingTimeField ?? undefined,
      closingTimeField: closingTimeField ?? undefined
    };
  };

  const MAX_VALUE_LENGTH = 300;

  // Format a single property value for display (handles objects, arrays, null)
  const formatPropertyValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      const part = value.map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item))).join(', ');
      return part.length > MAX_VALUE_LENGTH ? part.slice(0, MAX_VALUE_LENGTH) + '…' : part;
    }
    if (typeof value === 'object') {
      const raw = JSON.stringify(value);
      return raw.length > MAX_VALUE_LENGTH ? raw.slice(0, MAX_VALUE_LENGTH) + '…' : raw;
    }
    return String(value);
  };

  // Build feature profile HTML for popup (inline styles so it works inside MapLibre popup)
  const buildFeatureProfileHtml = (properties: Record<string, unknown>, lngLat: { lng: number; lat: number }) => {
    const entries = Object.entries(properties)
      .filter(([key]) => !key.startsWith('_'))
      .sort(([a], [b]) => {
        const keyOrder = ['parking_type', 'name', 'address', 'opening_time', 'closing_time', 'description', 'instructions', 'slots', 'rating', 'id'];
        const i = keyOrder.indexOf(a);
        const j = keyOrder.indexOf(b);
        if (i !== -1 && j !== -1) return i - j;
        if (i !== -1) return -1;
        if (j !== -1) return 1;
        return a.localeCompare(b);
      });
    const rows = entries
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const text = formatPropertyValue(value);
        const isMain = ['parking_type', 'name', 'address'].includes(key);
        return `<div style="margin-bottom: 8px; ${isMain ? 'font-weight: 600;' : ''}"><span style="color: #374151;">${escapeHtml(label)}:</span> <span style="color: #111;">${escapeHtml(text)}</span></div>`;
      })
      .join('');
    return `
      <div style="font-family: system-ui, sans-serif; padding: 12px 16px; min-width: 240px; max-width: 320px; max-height: 70vh; overflow-y: auto;">
        <h3 style="margin: 0 0 12px 0; font-size: 1rem; font-weight: 700; color: #111;">Feature profile</h3>
        <div style="font-size: 13px; line-height: 1.4;">
          ${rows || '<p style="color: #6b7280;">No properties</p>'}
        </div>
      </div>`;
  };

  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Add click handler for popup – show feature profile
  const addClickHandler = (mapInstance: maplibregl.Map, layerId: string) => {
    mapInstance.on('click', layerId, (e) => {
      if (e.features && e.features.length > 0) {
        e.preventDefault();
        const feature = e.features[0];
        const properties = (feature.properties || {}) as Record<string, unknown>;
        const html = buildFeatureProfileHtml(properties, e.lngLat);
        new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(mapInstance);
      }
    });
  };

  // Add hover handler for cursor
  const addHoverHandler = (mapInstance: maplibregl.Map, layerId: string) => {
    mapInstance.on('mouseenter', layerId, () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });

    mapInstance.on('mouseleave', layerId, () => {
      mapInstance.getCanvas().style.cursor = '';
    });
  };

  // Fallback function for generic parking layer (no metadata: use parking_type, no opening/closing)
  const addGenericParkingLayer = (mapInstance: maplibregl.Map, sourceId: string, beforeId?: string) => {
    const sourceLayer = tilesetId?.split('.').pop() || 'default';
    const typeField = 'parking_type';
    const openingField: string | undefined = undefined;
    const closingField: string | undefined = undefined;
    const currentDay = new Date().getDate();
    const currentTime = getCurrentTimeHours();
    const dynamicColor = getNoParkingAwareColorExpression(
      typeField,
      openingField,
      closingField,
      currentDay,
      currentTime
    );
    const polygonIconFilter = getNoParkingIconFilter(
      'Polygon',
      typeField,
      openingField,
      closingField,
      currentDay,
      currentTime
    );
    const lineIconFilter = getNoParkingIconFilter(
      'LineString',
      typeField,
      openingField,
      closingField,
      currentDay,
      currentTime
    );
    const pointIconFilter = getNoParkingIconFilter(
      'Point',
      typeField,
      openingField,
      closingField,
      currentDay,
      currentTime
    );

    console.log('Adding generic parking layers for source-layer:', sourceLayer, beforeId ? `(below ${beforeId})` : '');

    const filterEntry = (layerId: string, geometryType: 'Polygon' | 'LineString' | 'Point') => ({
      layerId,
      geometryType,
      typeField,
      openingField,
      closingField
    });

    try {
      mapInstance.addLayer({
        id: 'parking-fill',
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: polygonIconFilter,
        paint: {
          'fill-color': dynamicColor,
          'fill-opacity': 0.6
        }
      }, beforeId);

      noParkingDynamicPaintLayersRef.current.push({
        layerId: 'parking-fill',
        paintProperty: 'fill-color',
        typeField,
        openingField,
        closingField
      });
      noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-fill', 'Polygon'));

      mapInstance.addLayer({
        id: 'parking-outline',
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: polygonIconFilter,
        paint: {
          'line-color': dynamicColor,
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      }, beforeId);

      noParkingDynamicPaintLayersRef.current.push({
        layerId: 'parking-outline',
        paintProperty: 'line-color',
        typeField,
        openingField,
        closingField
      });
      noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-outline', 'Polygon'));

      addClickHandler(mapInstance, 'parking-fill');
      addHoverHandler(mapInstance, 'parking-fill');

      try {
        mapInstance.addLayer({
          id: 'parking-fill-label',
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: polygonIconFilter,
          layout: {
            'text-field': ['get', 'parking_type'],
            'text-size': 14,
            'text-anchor': 'center',
            'symbol-placement': 'point',
            'text-rotation-alignment': 'viewport'
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
          }
        }, beforeId);
        noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-fill-label', 'Polygon'));
      } catch (err) {
        console.error('Error adding generic polygon label layer:', err);
      }
      if (parkingTypeIconsLoadedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-fill-type-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: polygonIconFilter,
            layout: {
              'icon-image': getParkingTypeIconImageExpression('parking_type') as maplibregl.ExpressionSpecification,
              'icon-size': 1.0,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport',
              'symbol-placement': 'point'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-fill-type-icon');
          addHoverHandler(mapInstance, 'parking-fill-type-icon');
          noParkingDynamicFilterLayersRef.current.push({
            layerId: 'parking-fill-type-icon',
            geometryType: 'Polygon',
            typeField,
            openingField,
            closingField
          });
        } catch {
          // ignore
        }
      }

      console.log('✓ Added generic polygon layer (below labels)');
    } catch (err) {
      console.error('Error adding generic polygon layer:', err);
    }

    try {
      mapInstance.addLayer({
        id: 'parking-line',
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: lineIconFilter,
        paint: {
          'line-color': dynamicColor,
          'line-width': 3,
          'line-opacity': 0.9
        }
      }, beforeId);

      noParkingDynamicPaintLayersRef.current.push({
        layerId: 'parking-line',
        paintProperty: 'line-color',
        typeField,
        openingField,
        closingField
      });
      noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-line', 'LineString'));

      addClickHandler(mapInstance, 'parking-line');
      addHoverHandler(mapInstance, 'parking-line');

      try {
        mapInstance.addLayer({
          id: 'parking-line-label',
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: lineIconFilter,
          layout: {
            'text-field': ['get', 'parking_type'],
            'text-size': 12,
            'text-anchor': 'center',
            'symbol-placement': 'point',
            'text-rotation-alignment': 'viewport'
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
          }
        }, beforeId);
        noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-line-label', 'LineString'));
      } catch (err) {
        console.error('Error adding generic polyline label layer:', err);
      }
      if (parkingTypeIconsLoadedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-line-type-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: lineIconFilter,
            layout: {
              'icon-image': getParkingTypeIconImageExpression('parking_type') as maplibregl.ExpressionSpecification,
              'icon-size': 0.95,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport',
              'symbol-placement': 'line-center'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-line-type-icon');
          addHoverHandler(mapInstance, 'parking-line-type-icon');
          noParkingDynamicFilterLayersRef.current.push({
            layerId: 'parking-line-type-icon',
            geometryType: 'LineString',
            typeField,
            openingField,
            closingField
          });
        } catch {
          // ignore
        }
      }

      console.log('✓ Added generic polyline layer (below labels)');
    } catch (err) {
      console.error('Error adding generic polyline layer:', err);
    }

    try {
      mapInstance.addLayer({
        id: 'parking-circle',
        type: 'circle',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: pointIconFilter,
        paint: {
          'circle-color': dynamicColor,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            3,
            15,
            6,
            20,
            12
          ],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId);

      noParkingDynamicPaintLayersRef.current.push({
        layerId: 'parking-circle',
        paintProperty: 'circle-color',
        typeField,
        openingField,
        closingField
      });
      noParkingDynamicFilterLayersRef.current.push(filterEntry('parking-circle', 'Point'));

      addClickHandler(mapInstance, 'parking-circle');
      addHoverHandler(mapInstance, 'parking-circle');
      if (parkingTypeIconsLoadedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-circle-type-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: pointIconFilter,
            layout: {
              'icon-image': getParkingTypeIconImageExpression('parking_type') as maplibregl.ExpressionSpecification,
              'icon-size': 1.1,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-circle-type-icon');
          addHoverHandler(mapInstance, 'parking-circle-type-icon');
          noParkingDynamicFilterLayersRef.current.push({
            layerId: 'parking-circle-type-icon',
            geometryType: 'Point',
            typeField,
            openingField,
            closingField
          });
        } catch {
          // ignore
        }
      }
      
      console.log('✓ Added generic point layer (below labels)');
    } catch (err) {
      console.error('Error adding generic point layer:', err);
    }
  };

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading map...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg z-20">
          <p>{error}</p>
        </div>
      )}

      {/* Search bar: top-center, frosted glass */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
              className="flex-1 min-w-0 rounded-lg border-0 bg-transparent py-1.5 text-sm text-white placeholder-white/50 focus:ring-0"
              aria-label="Search for a place"
              aria-autocomplete="list"
            />
            {isSearching && (
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            )}
          </div>
          {searchDropdownOpen && (searchResults.length > 0 || isSearching) && (
            <ul
              className="max-h-60 overflow-auto border-t border-white/10 py-1"
              role="listbox"
            >
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
