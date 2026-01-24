import Link from 'next/link';
import MapView from '../components/MapView';

export default function MapPage() {
  // You can pass tileset configuration via environment variables
  // For now, we'll use optional props that can be configured
  const tilesetUrl = process.env.NEXT_PUBLIC_TILESET_URL;
  const tilesetId = process.env.NEXT_PUBLIC_TILESET_ID;
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link 
              href="/" 
              className="text-2xl font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Maps for Parking
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Mumbai Parking Zones
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapView 
          tilesetUrl={tilesetUrl}
          tilesetId={tilesetId}
          mapboxAccessToken={mapboxAccessToken}
        />
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 z-20 max-w-xs">
        <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Parking Zones</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-gray-700 dark:text-gray-300">Paid Parking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-gray-700 dark:text-gray-300">Free Parking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-gray-700 dark:text-gray-300">Restricted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-gray-700 dark:text-gray-300">Time Restricted</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Click on any zone to see detailed information
        </p>
        <Link
          href="/debug/tileset"
          className="mt-3 block text-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          🔍 Debug Tileset Data
        </Link>
      </div>
    </div>
  );
}
