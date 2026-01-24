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

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 w-60 rounded-2xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">
            Parking Zones
          </h3>
          <span className="rounded-full bg-[#137fec]/20 px-2 py-0.5 text-[10px] font-semibold text-[#6fb1ff]">
            Live
          </span>
        </div>
        <div className="space-y-2 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded bg-blue-500" />
            Paid Parking
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded bg-emerald-400" />
            Free Parking
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded bg-red-400" />
            Restricted
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded bg-yellow-400" />
            Time Restricted
          </div>
        </div>
        <p className="mt-3 text-[11px] text-white/50">
          Click any zone for detailed information.
        </p>
        <Link
          href="/debug/tileset"
          className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
        >
          Debug Tileset Data
        </Link>
      </div>
    </div>
  );
}
