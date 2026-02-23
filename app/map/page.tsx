import Link from "next/link";
import MapView from "../components/MapView";

export default function MapPage() {
  // You can pass tileset configuration via environment variables
  // For now, we'll use optional props that can be configured
  const tilesetUrl = process.env.NEXT_PUBLIC_TILESET_URL;
  const tilesetId = process.env.NEXT_PUBLIC_TILESET_ID;
  const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  return (
    <div className="h-screen flex flex-col bg-[#0b1118] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1118]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-white transition hover:text-white/80"
            >
              Maps for Parking
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/40">
              Mumbai parking zones
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Map Container */}
      <div className="relative flex-1">
        <MapView
          tilesetUrl={tilesetUrl}
          tilesetId={tilesetId}
          mapboxAccessToken={mapboxAccessToken}
        />
      </div>
    </div>
  );
}
