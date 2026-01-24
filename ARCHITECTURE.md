# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Home Page   │  │   Map Page   │  │ Debug Console│          │
│  │      /       │  │    /map      │  │/debug/tileset│          │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘          │
│                            │                  │                   │
│                            │                  │                   │
│                    ┌───────▼──────────────────▼───────┐          │
│                    │      MapView Component            │          │
│                    │  (app/components/MapView.tsx)     │          │
│                    │                                    │          │
│                    │  • Fetches tileset metadata       │          │
│                    │  • Creates map instance            │          │
│                    │  • Adds tileset source             │          │
│                    │  • Generates style expressions     │          │
│                    │  • Renders layers dynamically      │          │
│                    │  • Handles user interactions       │          │
│                    └────────┬───────────────────────────┘          │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                      Next.js API Routes                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────┐  ┌──────────────────────────┐ │
│  │  /api/tileset/metadata         │  │  /api/tileset/data       │ │
│  │                                 │  │                          │ │
│  │  • Receives tileset ID          │  │  • Receives tileset ID   │ │
│  │  • Calls Mapbox TileJSON API   │  │  • Calls Mapbox API v1   │ │
│  │  • Returns layer info           │  │  • Returns field defs    │ │
│  │  • Returns bounds/center        │  │  • Returns field values  │ │
│  └────────────┬────────────────────┘  └──────────┬───────────────┘ │
│               │                                   │                 │
└───────────────┼───────────────────────────────────┼─────────────────┘
                │                                   │
                │ HTTPS                             │ HTTPS
                │                                   │
┌───────────────▼───────────────────────────────────▼─────────────────┐
│                       Mapbox APIs                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  TileJSON API (v4)      │  │  Tilesets API (v1)              │  │
│  │                         │  │                                 │  │
│  │  GET /v4/{id}.json      │  │  GET /tilesets/v1/{id}          │  │
│  │                         │  │                                 │  │
│  │  Returns:               │  │  Returns:                       │  │
│  │  • vector_layers[]      │  │  • Tileset details              │  │
│  │  • bounds               │  │  • Field definitions            │  │
│  │  • center               │  │  • Field types & values         │  │
│  │  • minzoom/maxzoom      │  │  • Layer descriptions           │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Vector Tiles API                                             │  │
│  │                                                               │  │
│  │  GET /v4/{id}/{z}/{x}/{y}.vector.pbf                          │  │
│  │                                                               │  │
│  │  Returns: Protocol Buffer encoded vector tile                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
app/
├── page.tsx                    # Home page
├── layout.tsx                  # Root layout
│
├── map/
│   └── page.tsx               # Map page (uses MapView)
│
├── components/
│   └── MapView.tsx            # Core map component
│       ├── State Management
│       │   ├── map instance
│       │   ├── tileset metadata
│       │   ├── loading state
│       │   └── error state
│       │
│       ├── Effects
│       │   ├── Fetch metadata on mount
│       │   └── Initialize map on mount
│       │
│       ├── Functions
│       │   ├── addTilesetLayers()
│       │   ├── addLayerBasedOnFields()
│       │   ├── createStyleExpressions()
│       │   ├── addClickHandler()
│       │   ├── addHoverHandler()
│       │   └── addGenericParkingLayer()
│       │
│       └── Render
│           ├── Loading indicator
│           ├── Error message
│           └── Map container
│
├── debug/
│   └── tileset/
│       └── page.tsx           # Debug console
│           ├── Tileset ID input
│           ├── Metadata display
│           ├── Layer inspector
│           └── Style examples
│
└── api/
    └── tileset/
        ├── metadata/
        │   └── route.ts       # Metadata API endpoint
        │       ├── Validate params
        │       ├── Fetch from Mapbox
        │       ├── Parse response
        │       └── Return JSON
        │
        └── data/
            └── route.ts       # Data API endpoint
                ├── Validate params
                ├── Fetch from Mapbox
                ├── Extract fields
                └── Return JSON
```

## Data Flow Diagram

```
┌─────────────┐
│   User      │
│   Visits    │
│   /map      │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  MapView Component Mounts                                 │
└──────┬───────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────────────────┐
       │                                             │
       ▼                                             ▼
┌─────────────────┐                          ┌──────────────┐
│ Fetch Metadata  │                          │ Initialize   │
│ useEffect       │                          │ Map          │
└──────┬──────────┘                          │ useEffect    │
       │                                     └──────┬───────┘
       ▼                                            │
┌─────────────────┐                                │
│ GET /api/       │                                │
│ tileset/        │                                │
│ metadata        │                                │
└──────┬──────────┘                                │
       │                                           │
       ▼                                           │
┌─────────────────┐                                │
│ Mapbox TileJSON │                                │
│ API             │                                │
└──────┬──────────┘                                │
       │                                           │
       ▼                                           │
┌─────────────────┐                                │
│ Store Metadata  │                                │
│ setTilesetMeta  │                                │
└──────┬──────────┘                                │
       │                                           │
       │                                           ▼
       │                                    ┌──────────────┐
       │                                    │ Create Map   │
       │                                    │ Instance     │
       │                                    └──────┬───────┘
       │                                           │
       │                                           ▼
       │                                    ┌──────────────┐
       │                                    │ Map 'load'   │
       │                                    │ Event        │
       │                                    └──────┬───────┘
       │                                           │
       └───────────────────────────────────────────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Add Tileset  │
                                            │ Source       │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ For Each     │
                                            │ Vector Layer │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Analyze      │
                                            │ Fields       │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Create Style │
                                            │ Expressions  │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Add Layers   │
                                            │ (Fill/Line/  │
                                            │  Circle)     │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Add Click    │
                                            │ Handlers     │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Add Hover    │
                                            │ Handlers     │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Map Ready    │
                                            │ (Loading     │
                                            │  Complete)   │
                                            └──────────────┘
```

## Style Expression Generation

```
Field Analysis
      │
      ▼
┌─────────────────┐
│ Get Field Names │
└────────┬────────┘
         │
         ▼
    ┌────────────────────────────────┐
    │ Check for Common Patterns      │
    ├────────────────────────────────┤
    │ • "type" or "category"         │
    │ • "status" or "availability"   │
    │ • Other fields                 │
    └────────┬───────────────────────┘
             │
             ├──────────────────┬──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
    │ Type Field     │ │ Status Field   │ │ Default        │
    │ Found          │ │ Found          │ │ (No Pattern)   │
    └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
    │ Create 'match' │ │ Create 'match' │ │ Use Solid      │
    │ Expression     │ │ Expression     │ │ Color          │
    │                │ │                │ │                │
    │ ['match',      │ │ ['match',      │ │ '#3b82f6'      │
    │  ['get',       │ │  ['get',       │ │                │
    │   'type'],     │ │   'status'],   │ │                │
    │  'paid',       │ │  'available',  │ │                │
    │  '#3b82f6',    │ │  '#10b981',    │ │                │
    │  'free',       │ │  'occupied',   │ │                │
    │  '#10b981',    │ │  '#ef4444',    │ │                │
    │  ...]          │ │  ...]          │ │                │
    └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
             │                  │                  │
             └──────────────────┴──────────────────┘
                                │
                                ▼
                        ┌────────────────┐
                        │ Return Style   │
                        │ Expressions    │
                        │                │
                        │ {              │
                        │   fillColor,   │
                        │   fillOpacity, │
                        │   lineColor,   │
                        │   circleColor, │
                        │   ...          │
                        │ }              │
                        └────────────────┘
```

## Layer Rendering Strategy

```
Vector Layer
      │
      ▼
┌─────────────────┐
│ Get Layer Info  │
│ • id            │
│ • fields        │
│ • minzoom       │
│ • maxzoom       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Analyze Fields  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Style    │
│ Expressions     │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Add Fill Layer │ │ Add Line Layer │ │ Add Circle Lyr │
│ with Filter:   │ │ with Filter:   │ │ with Filter:   │
│ geometry-type  │ │ geometry-type  │ │ geometry-type  │
│ = 'Polygon'    │ │ = 'LineString' │ │ = 'Point'      │
│                │ │                │ │                │
│ + Add Outline  │ │                │ │                │
│   Layer        │ │                │ │                │
└────────┬───────┘ └────────┬───────┘ └────────┬───────┘
         │                  │                  │
         │ Polygons only    │ Polylines only   │ Points only
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────────────────────────────────────────┐
│ Add Interactivity                                  │
├────────────────────────────────────────────────────┤
│ • Click handler → Show popup with properties       │
│ • Hover handler → Change cursor to pointer         │
└────────────────────────────────────────────────────┘
```

### Geometry Type Filtering

Each layer uses a geometry type filter to ensure proper rendering:

```javascript
// Fill layer - renders polygons only
filter: ['==', ['geometry-type'], 'Polygon']

// Line layer - renders polylines only
filter: ['==', ['geometry-type'], 'LineString']

// Circle layer - renders points only
filter: ['==', ['geometry-type'], 'Point']
```

This ensures:
- ✅ Polygons are rendered as filled areas with outlines
- ✅ Polylines are rendered as lines (not attempted as fills)
- ✅ Points are rendered as circles (not attempted as fills or lines)
- ✅ No geometry type mismatches or rendering errors

## Technology Stack

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  React 19                                            │
│    └── Next.js 16 (App Router)                      │
│          ├── TypeScript                             │
│          ├── Tailwind CSS                           │
│          └── MapLibre GL JS                         │
│                └── Mapbox Vector Tiles              │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    Backend                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Next.js API Routes                                  │
│    └── Server-side API handlers                     │
│          └── Fetch from Mapbox APIs                 │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                External Services                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Mapbox APIs                                         │
│    ├── TileJSON API (v4)                            │
│    ├── Tilesets API (v1)                            │
│    └── Vector Tiles API                             │
│                                                      │
│  OpenStreetMap                                       │
│    └── Raster Tiles (Base Map)                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Server-Side API Proxy
**Decision**: Use Next.js API routes to proxy Mapbox API calls

**Rationale**:
- Keeps access token secure (not exposed in client code)
- Allows response transformation and caching
- Provides error handling and logging
- Enables future rate limiting

### 2. Dynamic Layer Generation
**Decision**: Automatically create layers based on metadata

**Rationale**:
- No manual configuration needed
- Adapts to any tileset structure
- Reduces maintenance burden
- Supports multiple geometry types

### 3. Field-Based Styling
**Decision**: Analyze field names to determine styling strategy

**Rationale**:
- Works with common naming conventions
- Provides sensible defaults
- Easy to customize
- Handles various data structures

### 4. Geometry Type Filtering
**Decision**: Add fill, line, and circle layers with geometry type filters

**Rationale**:
- Ensures polygons render as fills (not lines or circles)
- Ensures polylines render as lines (not fills or circles)
- Ensures points render as circles (not fills or lines)
- Supports mixed geometry types in a single tileset
- Prevents rendering errors and improves performance
- Uses native MapLibre GL expressions for efficiency

### 5. Client-Side Metadata Fetching
**Decision**: Fetch metadata in the browser, not at build time

**Rationale**:
- Supports dynamic tileset changes
- Enables debug console
- Reduces build complexity
- Allows runtime configuration

## Performance Characteristics

### Initial Load
1. **Map initialization**: ~100-200ms
2. **Metadata fetch**: ~500-1000ms
3. **Tileset source add**: ~50-100ms
4. **Layer creation**: ~10-50ms per layer
5. **First tile load**: ~200-500ms

**Total**: ~1-2 seconds for first render

### Runtime Performance
- **Tile loading**: Cached by Mapbox
- **Pan/zoom**: Hardware accelerated
- **Click handlers**: <10ms response
- **Style updates**: Immediate

### Optimization Opportunities
1. Cache metadata in localStorage
2. Preload tiles for common areas
3. Lazy load debug console
4. Optimize style expressions
5. Use Web Workers for data processing

## Security Considerations

### Access Token Protection
- ✅ Public tokens only in client code
- ✅ API routes proxy sensitive calls
- ✅ Token validation on server
- ✅ URL restrictions in production

### Data Validation
- ✅ Validate tileset ID format
- ✅ Sanitize user inputs
- ✅ Handle API errors gracefully
- ✅ Prevent XSS in popups

### Rate Limiting
- ⚠️ Currently relies on Mapbox limits
- 🔄 Future: Add application-level limits
- 🔄 Future: Implement caching strategy

## Scalability

### Current Capacity
- Supports any size tileset (limited by Mapbox)
- Handles multiple vector layers
- Works with millions of features
- Efficient tile-based rendering

### Future Scaling
1. Add Redis cache for metadata
2. Implement CDN for static assets
3. Use edge functions for API routes
4. Add database for user preferences
5. Implement real-time updates via WebSocket

## Monitoring & Debugging

### Built-in Tools
- Browser console logging
- Debug console UI
- Error boundaries
- Network request inspection

### Recommended Tools
- Mapbox Studio for tileset management
- Chrome DevTools for performance
- React DevTools for component inspection
- Network tab for API debugging

## Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vercel / Netlify                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Edge Network                                        │
│    ├── Static Assets (CDN)                          │
│    ├── API Routes (Serverless Functions)            │
│    └── SSR Pages (Server-side Rendering)            │
│                                                      │
│  Environment Variables                               │
│    ├── NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN              │
│    └── NEXT_PUBLIC_TILESET_ID                       │
│                                                      │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  Mapbox Platform                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  • Vector Tiles (Global CDN)                         │
│  • Tilesets API                                      │
│  • TileJSON API                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

This architecture provides a scalable, maintainable, and performant solution for rendering Mapbox vector tilesets with dynamic styling and interactivity.
