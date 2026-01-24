import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tilesetId = searchParams.get('tilesetId');
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

  try {
    // Fetch tileset metadata from Mapbox Tilesets API
    const response = await fetch(
      `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${accessToken}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch tileset metadata', details: errorText },
        { status: response.status }
      );
    }

    const metadata = await response.json();

    return NextResponse.json({
      success: true,
      metadata,
      layers: metadata.vector_layers || [],
      bounds: metadata.bounds,
      center: metadata.center,
      minzoom: metadata.minzoom,
      maxzoom: metadata.maxzoom,
    });
  } catch (error) {
    console.error('Error fetching tileset metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
