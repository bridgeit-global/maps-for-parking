'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TilesetDebugPage() {
  const [tilesetId, setTilesetId] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [tilesetData, setTilesetData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tileset ID from environment
  useEffect(() => {
    const envTilesetId = process.env.NEXT_PUBLIC_TILESET_ID || '';
    setTilesetId(envTilesetId);
  }, []);

  const fetchMetadata = async () => {
    if (!tilesetId) {
      setError('Please enter a tileset ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch metadata
      const metaResponse = await fetch(
        `/api/tileset/metadata?tilesetId=${encodeURIComponent(tilesetId)}`
      );

      if (!metaResponse.ok) {
        const errorData = await metaResponse.json();
        throw new Error(errorData.error || 'Failed to fetch metadata');
      }

      const metaData = await metaResponse.json();
      setMetadata(metaData);

      // Fetch tileset data
      const dataResponse = await fetch(
        `/api/tileset/data?tilesetId=${encodeURIComponent(tilesetId)}`
      );

      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setTilesetData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/map"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to Map
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Tileset Debug Console
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Inspect your tileset metadata and data structure
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tileset ID
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={tilesetId}
              onChange={(e) => setTilesetId(e.target.value)}
              placeholder="username.tileset-id"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={fetchMetadata}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Fetch Data'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {metadata && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Tileset Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Min Zoom</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {metadata.minzoom || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Max Zoom</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {metadata.maxzoom || 22}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Layers</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {metadata.layers?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Center</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {metadata.center?.join(', ') || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Vector Layers */}
            {metadata.layers && metadata.layers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Vector Layers
                </h2>
                <div className="space-y-4">
                  {metadata.layers.map((layer: any, index: number) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {layer.id}
                      </h3>
                      {layer.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {layer.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        {layer.minzoom !== undefined && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Min Zoom</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {layer.minzoom}
                            </p>
                          </div>
                        )}
                        {layer.maxzoom !== undefined && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Max Zoom</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {layer.maxzoom}
                            </p>
                          </div>
                        )}
                      </div>
                      {layer.fields && Object.keys(layer.fields).length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Fields:
                          </p>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                              {JSON.stringify(layer.fields, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bounds */}
            {metadata.bounds && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Bounds
                </h2>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
                  <pre className="text-sm text-gray-800 dark:text-gray-200">
                    {JSON.stringify(metadata.bounds, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Tileset Data (from Tilesets API v1) */}
            {tilesetData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Tileset Data (API v1)
                </h2>
                {tilesetData.fields && Object.keys(tilesetData.fields).length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Field Definitions
                    </h3>
                    {Object.entries(tilesetData.fields).map(([layerName, layerInfo]: [string, any]) => (
                      <div key={layerName} className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          Layer: {layerName}
                        </h4>
                        {layerInfo.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {layerInfo.description}
                          </p>
                        )}
                        <div className="space-y-2">
                          {layerInfo.fields?.map((field: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                                  {field.name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({field.type})
                                </span>
                              </div>
                              {field.values && field.values.length > 0 && (
                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                  Values: {field.values.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Full Response:</p>
                  <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(tilesetData.tileset, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Style Expression Examples */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Example Style Expressions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Based on the detected fields, here are some style expressions you can use:
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
                <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
{`// Example fill-color expression
'fill-color': [
  'match',
  ['get', 'parking_type'], // Replace with your actual field name
  'paid', '#3b82f6',
  'free', '#10b981',
  'restricted', '#ef4444',
  '#6b7280' // default
]

// Example opacity based on field value
'fill-opacity': [
  'case',
  ['has', 'availability'],
  ['*', ['/', ['get', 'availability'], 100], 0.8],
  0.6
]

// Example size based on zoom
'circle-radius': [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 3,
  15, 6,
  20, 12
]`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
