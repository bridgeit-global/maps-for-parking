'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MUMBAI_CENTER = {
  lng: 72.8777,
  lat: 19.0760,
  zoom: 11.5
};

const GEOCODE_DEBOUNCE_MS = 300;
const FLY_TO_ZOOM = 15;

const PARKING_COLORS = {
  blue: '#3b82f6',
  lightGreen: '#90EE90',
  lightGray: '#9ca3af',
  defaultGray: '#6b7280'
} as const;

const NO_PARKING_ICON_URL = '/icons/no-parking.png';
const NO_PARKING_ICON_ID = 'no-parking-icon';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

function getParkingTypeColorExpression(): (string | string[])[] {
  const dayOfMonth = new Date().getDate();
  const isEvenDay = dayOfMonth % 2 === 0;
  const { blue, lightGreen, lightGray, defaultGray } = PARKING_COLORS;
  return [
    'match',
    ['get', 'parking_type'],
    'onStreet', blue,
    'offStreet', blue,
    'free', lightGreen,
    'even', isEvenDay ? lightGreen : lightGray,
    'odd', !isEvenDay ? lightGreen : lightGray,
    'no', lightGray,
    defaultGray
  ];
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
  const noParkingIconAddedRef = useRef(false);

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

  // Function to add tileset layers with dynamic styling
  const addTilesetLayers = (
    mapInstance: maplibregl.Map,
    sourceId: string,
    metadata: TilesetMetadata | null,
    beforeId?: string
  ) => {
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
      center: tilesetMetadata?.center 
        ? [tilesetMetadata.center[0], tilesetMetadata.center[1]] 
        : [MUMBAI_CENTER.lng, MUMBAI_CENTER.lat],
      zoom: tilesetMetadata?.center?.[2] || MUMBAI_CENTER.zoom
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

            // Load no-parking icon then add parking layers
            (async () => {
              try {
                const img = await loadImage(NO_PARKING_ICON_URL);
                if (map.current) {
                  map.current.addImage(NO_PARKING_ICON_ID, img, { pixelRatio: 2 });
                  noParkingIconAddedRef.current = true;
                }
              } catch (err) {
                console.warn('No-parking icon not loaded, skipping icon layers:', err);
              }
              if (map.current) {
                addTilesetLayers(map.current, sourceId, tilesetMetadata);
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
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [tilesetUrl, tilesetId, mapboxAccessToken, tilesetMetadata]);

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
    
    // Add polygon fill layer with geometry type filter (below labels)
    const fillLayerId = `${sourceLayer}-fill`;
    try {
      mapInstance.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': styleExpressions.fillColor,
          'fill-opacity': styleExpressions.fillOpacity,
        }
      }, beforeId); // Insert below labels

      // Add outline for polygons (below labels)
      const outlineLayerId = `${sourceLayer}-outline`;
      mapInstance.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': styleExpressions.outlineColor,
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      }, beforeId); // Insert below labels

      // Add click handler
      addClickHandler(mapInstance, fillLayerId);
      addHoverHandler(mapInstance, fillLayerId);

      // Label layer for polygons (parking type at centroid)
      if (styleExpressions.typeField) {
        const labelLayerId = `${sourceLayer}-fill-label`;
        try {
          mapInstance.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['==', ['geometry-type'], 'Polygon'],
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
        } catch {
          console.log(`Could not add polygon label layer: ${labelLayerId}`);
        }
        // No-parking icon for polygons where type is 'no'
        if (noParkingIconAddedRef.current) {
          try {
            mapInstance.addLayer({
              id: `${sourceLayer}-fill-no-icon`,
              type: 'symbol',
              source: sourceId,
              'source-layer': sourceLayer,
              filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', styleExpressions.typeField], 'no']],
              layout: {
                'icon-image': NO_PARKING_ICON_ID,
                'icon-size': 1.0,
                'icon-anchor': 'center',
                'icon-rotation-alignment': 'viewport',
                'symbol-placement': 'point'
              }
            }, beforeId);
            addClickHandler(mapInstance, `${sourceLayer}-fill-no-icon`);
            addHoverHandler(mapInstance, `${sourceLayer}-fill-no-icon`);
          } catch {
            // ignore
          }
        }
      }
      
      console.log(`✓ Added polygon (fill) layer: ${fillLayerId} (below labels)`);
    } catch (err) {
      console.log(`No polygon geometries in ${sourceLayer}`);
    }

    // Add line layer for linestrings with geometry type filter (below labels)
    const lineLayerId = `${sourceLayer}-line`;
    try {
      mapInstance.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': styleExpressions.lineColor,
          'line-width': styleExpressions.lineWidth,
          'line-opacity': 0.9
        }
      }, beforeId); // Insert below labels

      addClickHandler(mapInstance, lineLayerId);
      addHoverHandler(mapInstance, lineLayerId);

      // Label layer for polylines (horizontal label at line centroid)
      if (styleExpressions.typeField) {
        const lineLabelLayerId = `${sourceLayer}-line-label`;
        try {
          mapInstance.addLayer({
            id: lineLabelLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['==', ['geometry-type'], 'LineString'],
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
        } catch {
          console.log(`Could not add polyline label layer: ${lineLabelLayerId}`);
        }
        // No-parking icon for lines where type is 'no'
        if (noParkingIconAddedRef.current) {
          try {
            mapInstance.addLayer({
              id: `${sourceLayer}-line-no-icon`,
              type: 'symbol',
              source: sourceId,
              'source-layer': sourceLayer,
              filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', styleExpressions.typeField], 'no']],
              layout: {
                'icon-image': NO_PARKING_ICON_ID,
                'icon-size': 0.95,
                'icon-anchor': 'center',
                'icon-rotation-alignment': 'viewport',
                'symbol-placement': 'line-center'
              }
            }, beforeId);
            addClickHandler(mapInstance, `${sourceLayer}-line-no-icon`);
            addHoverHandler(mapInstance, `${sourceLayer}-line-no-icon`);
          } catch {
            // ignore
          }
        }
      }
      
      console.log(`✓ Added polyline (line) layer: ${lineLayerId} (below labels)`);
    } catch (err) {
      console.log(`No linestring geometries in ${sourceLayer}`);
    }

    // Add circle layer for points with geometry type filter (below labels)
    const circleLayerId = `${sourceLayer}-circle`;
    try {
      mapInstance.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': styleExpressions.circleColor,
          'circle-radius': styleExpressions.circleRadius,
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId); // Insert below labels

      addClickHandler(mapInstance, circleLayerId);
      addHoverHandler(mapInstance, circleLayerId);

      // No-parking icon for points where type is 'no'
      if (noParkingIconAddedRef.current && styleExpressions.typeField) {
        try {
          const noIconLayerId = `${sourceLayer}-circle-no-icon`;
          mapInstance.addLayer({
            id: noIconLayerId,
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', styleExpressions.typeField], 'no']],
            layout: {
              'icon-image': NO_PARKING_ICON_ID,
              'icon-size': 1.1,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport'
            }
          }, beforeId);
          addClickHandler(mapInstance, noIconLayerId);
          addHoverHandler(mapInstance, noIconLayerId);
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
    const typeField = fieldNames.find(f => 
      f.toLowerCase().includes('type') || 
      f.toLowerCase().includes('category') ||
      f.toLowerCase() === 'parking_type'
    );

    // Check for status fields
    const statusField = fieldNames.find(f => 
      f.toLowerCase().includes('status') || 
      f.toLowerCase().includes('availability')
    );

    const blue = '#3b82f6';           // onStreet, offStreet
    const lightGreen = '#166534';      // free; even/odd on matching date
    const lightGray = '#9ca3af';     // no; even/odd on non-matching date
    const defaultGray = '#6b7280';

    const dayOfMonth = new Date().getDate();
    const isEvenDay = dayOfMonth % 2 === 0;

    let colorExpression: any = defaultGray;

    if (typeField) {
      colorExpression = [
        'match',
        ['get', typeField],
        'onStreet', blue,
        'offStreet', blue,
        'free', lightGreen,
        'even', isEvenDay ? lightGreen : lightGray,
        'odd', !isEvenDay ? lightGreen : lightGray,
        'no', lightGray,
        defaultGray
      ];
    } else if (statusField) {
      colorExpression = [
        'match',
        ['get', statusField],
        'available', lightGreen,
        'occupied', '#ef4444',
        'reserved', '#f59e0b',
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
        10, 3,
        15, 6,
        20, 12
      ] as any,
      typeField: typeField ?? statusField ?? undefined
    };
  };

  // Add click handler for popup
  const addClickHandler = (mapInstance: maplibregl.Map, layerId: string) => {
    mapInstance.on('click', layerId, (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const properties = feature.properties || {};
        
        // Create HTML for all properties
        const propsHtml = Object.entries(properties)
          .filter(([key]) => !key.startsWith('_')) // Filter out internal properties
          .map(([key, value]) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `<p><strong>${formattedKey}:</strong> ${value}</p>`;
          })
          .join('');
        
        const popup = new maplibregl.Popup({ offset: 25 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2 min-w-[200px]">
              <h3 class="font-semibold text-lg mb-2">Feature Details</h3>
              ${propsHtml || '<p class="text-gray-500">No properties available</p>'}
            </div>
          `)
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

  // Fallback function for generic parking layer
  // beforeId parameter ensures layers are added below labels
  const addGenericParkingLayer = (mapInstance: maplibregl.Map, sourceId: string, beforeId?: string) => {
    const sourceLayer = tilesetId?.split('.').pop() || 'default';
    
    console.log('Adding generic parking layers for source-layer:', sourceLayer, beforeId ? `(below ${beforeId})` : '');
    
    // Add polygon layer (below labels)
    try {
      mapInstance.addLayer({
        id: 'parking-fill',
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': getParkingTypeColorExpression() as maplibregl.ExpressionSpecification,
          'fill-opacity': 0.6
        }
      }, beforeId); // Insert below labels

      // Add polygon outline (below labels)
      mapInstance.addLayer({
        id: 'parking-outline',
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': '#1f2937',
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      }, beforeId); // Insert below labels

      addClickHandler(mapInstance, 'parking-fill');
      addHoverHandler(mapInstance, 'parking-fill');

      // Polygon label layer (parking type at centroid)
      try {
        mapInstance.addLayer({
          id: 'parking-fill-label',
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: ['==', ['geometry-type'], 'Polygon'],
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
      } catch (err) {
        console.error('Error adding generic polygon label layer:', err);
      }
      if (noParkingIconAddedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-fill-no-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'parking_type'], 'no']],
            layout: {
              'icon-image': NO_PARKING_ICON_ID,
              'icon-size': 1.0,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport',
              'symbol-placement': 'point'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-fill-no-icon');
          addHoverHandler(mapInstance, 'parking-fill-no-icon');
        } catch {
          // ignore
        }
      }
      
      console.log('✓ Added generic polygon layer (below labels)');
    } catch (err) {
      console.error('Error adding generic polygon layer:', err);
    }

    // Add line layer for polylines (below labels)
    try {
      mapInstance.addLayer({
        id: 'parking-line',
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': getParkingTypeColorExpression() as maplibregl.ExpressionSpecification,
          'line-width': 3,
          'line-opacity': 0.9
        }
      }, beforeId); // Insert below labels

      addClickHandler(mapInstance, 'parking-line');
      addHoverHandler(mapInstance, 'parking-line');

      // Polyline label layer (horizontal label at line centroid)
      try {
        mapInstance.addLayer({
          id: 'parking-line-label',
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: ['==', ['geometry-type'], 'LineString'],
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
      } catch (err) {
        console.error('Error adding generic polyline label layer:', err);
      }
      if (noParkingIconAddedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-line-no-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'parking_type'], 'no']],
            layout: {
              'icon-image': NO_PARKING_ICON_ID,
              'icon-size': 0.95,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport',
              'symbol-placement': 'line-center'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-line-no-icon');
          addHoverHandler(mapInstance, 'parking-line-no-icon');
        } catch {
          // ignore
        }
      }
      
      console.log('✓ Added generic polyline layer (below labels)');
    } catch (err) {
      console.error('Error adding generic polyline layer:', err);
    }

    // Add circle layer for points (below labels)
    try {
      mapInstance.addLayer({
        id: 'parking-circle',
        type: 'circle',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': getParkingTypeColorExpression() as maplibregl.ExpressionSpecification,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 3,
            15, 6,
            20, 12
          ],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId); // Insert below labels

      addClickHandler(mapInstance, 'parking-circle');
      addHoverHandler(mapInstance, 'parking-circle');
      if (noParkingIconAddedRef.current) {
        try {
          mapInstance.addLayer({
            id: 'parking-circle-no-icon',
            type: 'symbol',
            source: sourceId,
            'source-layer': sourceLayer,
            filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'parking_type'], 'no']],
            layout: {
              'icon-image': NO_PARKING_ICON_ID,
              'icon-size': 1.1,
              'icon-anchor': 'center',
              'icon-rotation-alignment': 'viewport'
            }
          }, beforeId);
          addClickHandler(mapInstance, 'parking-circle-no-icon');
          addHoverHandler(mapInstance, 'parking-circle-no-icon');
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
