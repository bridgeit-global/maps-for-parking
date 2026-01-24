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
    // Fetch tileset source data from Mapbox Tilesets API v1
    const response = await fetch(
      `https://api.mapbox.com/tilesets/v1/${tilesetId}?access_token=${accessToken}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox Tilesets API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch tileset data', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      tileset: data,
      layers: data.vector_layers || [],
      fields: extractFieldsFromLayers(data.vector_layers || []),
    });
  } catch (error) {
    console.error('Error fetching tileset data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper function to extract field information from vector layers
function extractFieldsFromLayers(layers: any[]) {
  const fieldsMap: Record<string, any> = {};

  layers.forEach((layer) => {
    const layerName = layer.id;
    const fields = layer.fields || {};

    fieldsMap[layerName] = {
      name: layerName,
      description: layer.description || '',
      fields: Object.entries(fields).map(([key, value]: [string, any]) => ({
        name: key,
        type: value.type || 'unknown',
        values: value.values || [],
      })),
    };
  });

  return fieldsMap;
}
