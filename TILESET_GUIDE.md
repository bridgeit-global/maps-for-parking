# Tileset Integration Guide

This guide explains how the Mapbox tileset integration works in the Maps for Parking application.

## Overview

The application uses Mapbox Vector Tiles to display parking data on an interactive map. The tileset layer automatically adapts to your data structure using dynamic style expressions.

## Configuration

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_TILESET_ID=username.tileset-id
NEXT_PUBLIC_TILESET_URL=https://api.mapbox.com/v4/username.tileset-id/{z}/{x}/{y}.vector.pbf?access_token=YOUR_TOKEN
```

**Note:** You can use either `NEXT_PUBLIC_TILESET_ID` (recommended) or `NEXT_PUBLIC_TILESET_URL`.

### Tileset ID Format

For Mapbox tilesets, the ID should be in the format: `username.tileset-id`

Example: `john.mumbai-parking-zones`

## How It Works

### 1. Metadata Fetching

When the map loads, it automatically fetches tileset metadata from the Mapbox API:

```typescript
GET /api/tileset/metadata?tilesetId=username.tileset-id
```

This returns:
- Vector layer information
- Field definitions and types
- Zoom levels (min/max)
- Bounds and center coordinates

### 2. Dynamic Layer Creation

The application automatically creates map layers based on the tileset metadata with proper geometry type filtering:

- **Fill layers** - For polygon geometries (parking zones) with `['==', ['geometry-type'], 'Polygon']` filter
- **Line layers** - For linestring/polyline geometries (parking boundaries) with `['==', ['geometry-type'], 'LineString']` filter
- **Circle layers** - For point geometries (parking locations) with `['==', ['geometry-type'], 'Point']` filter

Each layer type only renders features with the matching geometry type, ensuring:
- Polygons render as filled areas with outlines
- Polylines render as lines
- Points render as circles

### 3. Style Expressions

Style expressions are dynamically generated based on your data fields:

#### Color by Type

If your tileset has a field like `parking_type`, `type`, or `category`:

```javascript
'fill-color': [
  'match',
  ['get', 'parking_type'],
  'paid', '#3b82f6',        // Blue
  'free', '#10b981',        // Green
  'restricted', '#ef4444',  // Red
  'time-restricted', '#f59e0b', // Amber
  '#6b7280'                 // Gray (default)
]
```

#### Color by Status

If your tileset has a `status` or `availability` field:

```javascript
'fill-color': [
  'match',
  ['get', 'status'],
  'available', '#10b981',   // Green
  'occupied', '#ef4444',    // Red
  'reserved', '#f59e0b',    // Amber
  '#6b7280'                 // Gray (default)
]
```

#### Size by Zoom

For circle/point layers, the size adapts to zoom level:

```javascript
'circle-radius': [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 3,   // At zoom 10, radius is 3
  15, 6,   // At zoom 15, radius is 6
  20, 12   // At zoom 20, radius is 12
]
```

## Data Structure

### Recommended Fields

For optimal styling, include these fields in your tileset data:

#### Required Fields
- `parking_type` - Type of parking (paid, free, restricted, etc.)
- Geometry - GeoJSON geometry (Polygon, LineString, or Point)

#### Optional Fields
- `name` - Name of the parking zone
- `description` - Detailed description
- `status` - Current status (available, occupied, reserved)
- `capacity` - Total parking capacity
- `availability` - Available spots
- `timing` - Operating hours
- `rules` - Parking rules/restrictions
- `rate` - Parking rate/fee
- `address` - Location address

### Example GeoJSON Feature

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  },
  "properties": {
    "parking_type": "paid",
    "name": "Bandra West Parking Zone",
    "description": "Public parking near Bandra station",
    "capacity": 50,
    "availability": 12,
    "timing": "24 hours",
    "rate": "₹40/hour",
    "rules": "No overnight parking",
    "address": "Linking Road, Bandra West"
  }
}
```

## Debugging

### Debug Console

Visit `/debug/tileset` to access the Tileset Debug Console:

1. Enter your tileset ID
2. Click "Fetch Data"
3. Inspect:
   - Vector layers
   - Field definitions
   - Zoom levels and bounds
   - Example style expressions

### Browser Console

The application logs detailed information to the browser console:

```
Tileset metadata: {...}
Available data layers: ["parking"]
Layer "parking" fields: {...}
Adding layer: parking {...}
```

### Common Issues

#### Tileset Not Showing

1. **Check Mapbox token** - Ensure `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is valid
2. **Verify tileset ID** - Confirm the format is `username.tileset-id`
3. **Check zoom levels** - Ensure you're zoomed to the correct level for your data
4. **Inspect console** - Look for error messages in browser console

#### Wrong Colors

1. **Check field names** - The app looks for fields like `parking_type`, `type`, `status`
2. **Verify field values** - Ensure values match the style expression (e.g., "paid", "free")
3. **Use debug console** - Check actual field names and values in `/debug/tileset`

#### Layer Not Rendering

1. **Geometry type** - Ensure your geometry type (Polygon/LineString/Point) matches
2. **Source layer** - The app uses the last part of tileset ID as source layer name
3. **Bounds** - Check if features are within the visible map bounds

## API Endpoints

### GET /api/tileset/metadata

Fetch tileset metadata from Mapbox TileJSON API (v4).

**Query Parameters:**
- `tilesetId` - The Mapbox tileset ID

**Response:**
```json
{
  "success": true,
  "metadata": {...},
  "layers": [...],
  "bounds": [-180, -90, 180, 90],
  "center": [lng, lat, zoom],
  "minzoom": 0,
  "maxzoom": 22
}
```

### GET /api/tileset/data

Fetch detailed tileset information from Mapbox Tilesets API (v1).

**Query Parameters:**
- `tilesetId` - The Mapbox tileset ID

**Response:**
```json
{
  "success": true,
  "tileset": {...},
  "layers": [...],
  "fields": {
    "layer_name": {
      "name": "layer_name",
      "fields": [
        {
          "name": "parking_type",
          "type": "String",
          "values": ["paid", "free", "restricted"]
        }
      ]
    }
  }
}
```

## Custom Styling

### Override Default Colors

Edit `app/components/MapView.tsx` and modify the `createStyleExpressions` function:

```typescript
const createStyleExpressions = (fields: Record<string, any>) => {
  return {
    fillColor: [
      'match',
      ['get', 'parking_type'],
      'paid', '#YOUR_COLOR',
      'free', '#YOUR_COLOR',
      // ... add more colors
      '#DEFAULT_COLOR'
    ],
    fillOpacity: 0.7, // Change opacity
    // ... other style properties
  };
};
```

### Add Custom Layers

In the `addLayerBasedOnFields` function, add custom layer configurations:

```typescript
mapInstance.addLayer({
  id: 'custom-layer',
  type: 'fill',
  source: sourceId,
  'source-layer': sourceLayer,
  paint: {
    // Your custom paint properties
  },
  layout: {
    // Your custom layout properties
  }
});
```

## Performance Tips

1. **Optimize zoom levels** - Set appropriate minzoom/maxzoom for your tileset
2. **Simplify geometries** - Use simplified geometries for lower zoom levels
3. **Limit features** - Keep feature count reasonable per tile
4. **Use vector tiles** - Vector tiles are more efficient than GeoJSON for large datasets
5. **Cache tiles** - Mapbox automatically caches tiles for better performance

## Resources

- [Mapbox Vector Tiles Specification](https://docs.mapbox.com/vector-tiles/specification/)
- [Mapbox Style Specification](https://docs.mapbox.com/style-spec/)
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [Mapbox Tilesets API](https://docs.mapbox.com/api/maps/tilesets/)

## Support

For issues or questions:
1. Check the debug console at `/debug/tileset`
2. Review browser console logs
3. Verify tileset configuration at [Mapbox Studio](https://studio.mapbox.com/)
