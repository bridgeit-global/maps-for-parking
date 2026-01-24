# Maps for Parking - Mumbai

An interactive map application for visualizing parking zones in Mumbai using Mapbox Vector Tiles and MapLibre GL JS.

## Features

- 🗺️ **Interactive Map** - Navigate Mumbai with OpenStreetMap base layer
- 🅿️ **Parking Zones** - Visualize parking data from Mapbox tilesets
- 🎨 **Dynamic Styling** - Automatic color-coding based on parking type/status
- 📊 **Data Inspection** - Click on zones to see detailed information
- 🔍 **Debug Console** - Inspect tileset structure and fields
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_TILESET_ID=username.tileset-id
```

To get a Mapbox access token:
1. Sign up at [Mapbox](https://account.mapbox.com/auth/signup/)
2. Go to your [Access Tokens](https://account.mapbox.com/access-tokens/) page
3. Copy your default public token or create a new one

### 3. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Pages

- **/** - Home page with project overview
- **/map** - Interactive map with parking data visualization
- **/debug/tileset** - Debug console to inspect tileset structure

## Tileset Integration

This application automatically reads from your Mapbox tileset and renders it with intelligent styling based on the data structure.

### Supported Features

- ✅ Automatic layer detection from tileset metadata
- ✅ Dynamic style expressions based on field types
- ✅ Geometry type filtering (Polygons → fills, Polylines → lines, Points → circles)
- ✅ Support for Polygon, LineString, and Point geometries
- ✅ Color-coding by parking type or status
- ✅ Interactive popups with feature properties
- ✅ Zoom-adaptive styling

### Data Fields

The application looks for these common fields and styles them automatically:

- `parking_type` / `type` / `category` - Used for color-coding
- `status` / `availability` - Alternative field for color-coding
- Any other fields - Displayed in popup on click

**See [TILESET_GUIDE.md](./TILESET_GUIDE.md) for detailed documentation.**

## Project Structure

```
maps-for-parking/
├── app/
│   ├── components/
│   │   └── MapView.tsx          # Main map component
│   ├── api/
│   │   └── tileset/
│   │       ├── metadata/        # Tileset metadata API
│   │       └── data/            # Tileset data API
│   ├── map/
│   │   └── page.tsx             # Map page
│   ├── debug/
│   │   └── tileset/
│   │       └── page.tsx         # Debug console
│   └── page.tsx                 # Home page
├── public/                      # Static assets
├── TILESET_GUIDE.md            # Detailed tileset documentation
└── README.md                   # This file
```

## Technologies

- **Next.js 16** - React framework with App Router
- **MapLibre GL JS** - Open-source map rendering library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Mapbox Vector Tiles** - Efficient vector tile format

## Development

### Build for Production

```bash
pnpm build
pnpm start
```

### Lint Code

```bash
pnpm lint
```

## Debugging

### Using the Debug Console

1. Go to [http://localhost:3000/debug/tileset](http://localhost:3000/debug/tileset)
2. Enter your tileset ID
3. Click "Fetch Data"
4. Inspect:
   - Vector layers and their fields
   - Zoom levels and bounds
   - Field types and values
   - Example style expressions

### Browser Console

The map component logs detailed information:
- Tileset metadata
- Available data layers
- Layer fields and types
- Style expressions being applied

## Customization

### Change Colors

Edit `app/components/MapView.tsx` in the `createStyleExpressions` function:

```typescript
colorExpression = [
  'match',
  ['get', 'parking_type'],
  'paid', '#YOUR_COLOR',
  'free', '#YOUR_COLOR',
  '#DEFAULT_COLOR'
];
```

### Add Custom Layers

Modify the `addLayerBasedOnFields` function to add custom layer configurations.

### Change Map Style

Update the base map style in the map initialization:

```typescript
style: {
  version: 8,
  sources: {
    // Add your custom sources
  },
  layers: [
    // Add your custom layers
  ]
}
```

## Troubleshooting

**Map not loading?**
- Check your Mapbox access token
- Verify network connectivity
- Check browser console for errors

**Tileset not showing?**
- Verify tileset ID format (`username.tileset-id`)
- Ensure you're zoomed to the correct level
- Use the debug console to inspect tileset structure

**Wrong colors?**
- Check field names in your data
- Verify field values match style expressions
- Use debug console to see actual field names

## Resources

- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js/docs/)
- [Mapbox Style Specification](https://docs.mapbox.com/style-spec/)
- [Mapbox Vector Tiles](https://docs.mapbox.com/vector-tiles/specification/)
- [Next.js Documentation](https://nextjs.org/docs)

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
