import { NextResponse } from 'next/server';

/**
 * Proxies Mapbox Tilequery API to return sample features from a vector tileset.
 * Use for inspecting parking_type, opening_time, closing_time etc. in real data.
 * GET /api/tileset/sample?tilesetId=...&lon=72.83&lat=19&radius=5000&limit=50
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tilesetId = searchParams.get('tilesetId');
  const lon = searchParams.get('lon') ?? '72.83';
  const lat = searchParams.get('lat') ?? '19';
  const radius = searchParams.get('radius') ?? '5000';
  const limit = searchParams.get('limit') ?? '50';
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!tilesetId) {
    return NextResponse.json(
      { error: 'Tileset ID is required' },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Mapbox access token not configured' },
      { status: 500 }
    );
  }

  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 50));
  const url = `https://api.mapbox.com/v4/${tilesetId}/tilequery/${lon},${lat}.json?radius=${radius}&limit=${limitNum}&access_token=${accessToken}`;

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Tilequery failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Tilequery error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
