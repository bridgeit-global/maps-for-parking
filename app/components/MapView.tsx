'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MUMBAI_CENTER = {
  lng: 72.8777,
  lat: 19.0760,
  zoom: 11.5
};

interface MapViewProps {
  tilesetUrl?: string;
  tilesetId?: string;
  mapboxAccessToken?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tilesetMetadata, setTilesetMetadata] = useState<TilesetMetadata | null>(null);
  const [dataLayers, setDataLayers] = useState<string[]>([]);

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

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize the map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'openmaptiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'openmaptiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
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

            // Add layers based on tileset metadata
            addTilesetLayers(map.current, sourceId, tilesetMetadata);
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

  // Function to add tileset layers with dynamic styling
  const addTilesetLayers = (
    mapInstance: maplibregl.Map,
    sourceId: string,
    metadata: TilesetMetadata | null
  ) => {
    if (!metadata?.vector_layers || metadata.vector_layers.length === 0) {
      // Fallback: Add a generic layer if no metadata
      addGenericParkingLayer(mapInstance, sourceId);
      return;
    }

    metadata.vector_layers.forEach((layer, index) => {
      const layerId = layer.id;
      const fields = layer.fields || {};
      
      console.log(`Adding layer: ${layerId}`, fields);

      // Determine geometry type and add appropriate layer
      addLayerBasedOnFields(mapInstance, sourceId, layerId, fields, index);
    });
  };

  // Function to add layer with appropriate styling based on fields
  const addLayerBasedOnFields = (
    mapInstance: maplibregl.Map,
    sourceId: string,
    sourceLayer: string,
    fields: Record<string, any>,
    layerIndex: number
  ) => {
    // Create style expressions based on available fields
    const styleExpressions = createStyleExpressions(fields);
    
    // Add polygon fill layer with geometry type filter
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
      });

      // Add outline for polygons
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
      });

      // Add click handler
      addClickHandler(mapInstance, fillLayerId);
      addHoverHandler(mapInstance, fillLayerId);
      
      console.log(`✓ Added polygon (fill) layer: ${fillLayerId}`);
    } catch (err) {
      console.log(`No polygon geometries in ${sourceLayer}`);
    }

    // Add line layer for linestrings with geometry type filter
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
      });

      addClickHandler(mapInstance, lineLayerId);
      addHoverHandler(mapInstance, lineLayerId);
      
      console.log(`✓ Added polyline (line) layer: ${lineLayerId}`);
    } catch (err) {
      console.log(`No linestring geometries in ${sourceLayer}`);
    }

    // Add circle layer for points with geometry type filter
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
      });

      addClickHandler(mapInstance, circleLayerId);
      addHoverHandler(mapInstance, circleLayerId);
      
      console.log(`✓ Added point (circle) layer: ${circleLayerId}`);
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

    // Default color expression
    let colorExpression: any = '#3b82f6'; // default blue

    if (typeField) {
      // Create color expression based on type field
      colorExpression = [
        'match',
        ['get', typeField],
        'paid', '#3b82f6',        // blue
        'free', '#10b981',        // green
        'restricted', '#ef4444',  // red
        'time-restricted', '#f59e0b', // amber
        'time_restricted', '#f59e0b',
        'permit', '#8b5cf6',      // purple
        'disabled', '#6366f1',    // indigo
        'loading', '#f97316',     // orange
        '#6b7280'                 // gray (default)
      ];
    } else if (statusField) {
      colorExpression = [
        'match',
        ['get', statusField],
        'available', '#10b981',   // green
        'occupied', '#ef4444',    // red
        'reserved', '#f59e0b',    // amber
        '#6b7280'                 // gray (default)
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
      ]
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
  const addGenericParkingLayer = (mapInstance: maplibregl.Map, sourceId: string) => {
    const sourceLayer = tilesetId?.split('.').pop() || 'default';
    
    console.log('Adding generic parking layers for source-layer:', sourceLayer);
    
    // Add polygon layer
    try {
      mapInstance.addLayer({
        id: 'parking-fill',
        type: 'fill',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': [
            'match',
            ['get', 'parking_type'],
            'paid', '#3b82f6',
            'free', '#10b981',
            'restricted', '#ef4444',
            'time-restricted', '#f59e0b',
            'time_restricted', '#f59e0b',
            '#6b7280'
          ],
          'fill-opacity': 0.6
        }
      });

      // Add polygon outline
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
      });

      addClickHandler(mapInstance, 'parking-fill');
      addHoverHandler(mapInstance, 'parking-fill');
      
      console.log('✓ Added generic polygon layer');
    } catch (err) {
      console.error('Error adding generic polygon layer:', err);
    }

    // Add line layer for polylines
    try {
      mapInstance.addLayer({
        id: 'parking-line',
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': [
            'match',
            ['get', 'parking_type'],
            'paid', '#3b82f6',
            'free', '#10b981',
            'restricted', '#ef4444',
            'time-restricted', '#f59e0b',
            'time_restricted', '#f59e0b',
            '#6b7280'
          ],
          'line-width': 3,
          'line-opacity': 0.9
        }
      });

      addClickHandler(mapInstance, 'parking-line');
      addHoverHandler(mapInstance, 'parking-line');
      
      console.log('✓ Added generic polyline layer');
    } catch (err) {
      console.error('Error adding generic polyline layer:', err);
    }

    // Add circle layer for points
    try {
      mapInstance.addLayer({
        id: 'parking-circle',
        type: 'circle',
        source: sourceId,
        'source-layer': sourceLayer,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'parking_type'],
            'paid', '#3b82f6',
            'free', '#10b981',
            'restricted', '#ef4444',
            'time-restricted', '#f59e0b',
            'time_restricted', '#f59e0b',
            '#6b7280'
          ],
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
      });

      addClickHandler(mapInstance, 'parking-circle');
      addHoverHandler(mapInstance, 'parking-circle');
      
      console.log('✓ Added generic point layer');
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
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
