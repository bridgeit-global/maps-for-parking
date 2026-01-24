# Configuration Guide

## Environment Variables

Create a `.env.local` file in the project root with the following configuration:

### Required Variables

```env
# Mapbox Access Token
# Get your token from: https://account.mapbox.com/access-tokens/
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here

# Tileset ID
# Format: username.tileset-id
# Example: john.mumbai-parking-zones
NEXT_PUBLIC_TILESET_ID=username.tileset-id
```

### Optional Variables

```env
# Direct Tileset URL (alternative to TILESET_ID)
# Use either TILESET_ID or TILESET_URL, not both
NEXT_PUBLIC_TILESET_URL=https://api.mapbox.com/v4/username.tileset-id/{z}/{x}/{y}.vector.pbf?access_token=YOUR_TOKEN
```

## Getting a Mapbox Access Token

1. **Sign up for Mapbox**
   - Go to [https://account.mapbox.com/auth/signup/](https://account.mapbox.com/auth/signup/)
   - Create a free account

2. **Get your access token**
   - Navigate to [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/)
   - Copy your default public token (starts with `pk.`)
   - Or create a new token with these scopes:
     - `styles:read`
     - `fonts:read`
     - `datasets:read`
     - `tilesets:read`

3. **Add to .env.local**
   ```env
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsZXhhbXBsZSJ9.example
   ```

## Creating a Tileset

### Option 1: Using Mapbox Studio

1. **Go to Mapbox Studio**
   - Visit [https://studio.mapbox.com/](https://studio.mapbox.com/)
   - Sign in with your account

2. **Create a new tileset**
   - Click "Tilesets" in the sidebar
   - Click "New tileset"
   - Upload your GeoJSON, CSV, or other supported format

3. **Get your tileset ID**
   - After upload, you'll see your tileset ID (format: `username.tileset-id`)
   - Copy this ID to your `.env.local`

### Option 2: Using Mapbox Tiling Service (MTS)

1. **Prepare your data**
   - Create a GeoJSON file with your parking data
   - Ensure proper structure with geometry and properties

2. **Upload using Mapbox CLI**
   ```bash
   # Install Mapbox CLI
   npm install -g @mapbox/mapbox-cli

   # Upload tileset
   mapbox upload username.tileset-id data.geojson
   ```

3. **Use the tileset ID**
   - Add to `.env.local`: `NEXT_PUBLIC_TILESET_ID=username.tileset-id`

## Example GeoJSON Structure

Your parking data should follow this structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [72.8777, 19.0760],
            [72.8780, 19.0760],
            [72.8780, 19.0763],
            [72.8777, 19.0763],
            [72.8777, 19.0760]
          ]
        ]
      },
      "properties": {
        "parking_type": "paid",
        "name": "Bandra Parking Zone",
        "capacity": 50,
        "rate": "₹40/hour",
        "timing": "24 hours",
        "description": "Public parking near Bandra station"
      }
    }
  ]
}
```

## Recommended Properties

Include these properties in your features for best results:

### Essential
- `parking_type` - Type of parking (paid, free, restricted, time-restricted, permit, disabled, loading)
- `name` - Name of the parking zone

### Optional
- `description` - Detailed description
- `status` - Current status (available, occupied, reserved)
- `capacity` - Total parking capacity (number)
- `availability` - Available spots (number)
- `timing` - Operating hours (string)
- `rules` - Parking rules/restrictions (string)
- `rate` - Parking rate/fee (string)
- `address` - Location address (string)
- `zone_id` - Unique zone identifier (string)
- `contact` - Contact information (string)

## Verification

After configuration, verify your setup:

1. **Start the development server**
   ```bash
   pnpm dev
   ```

2. **Check the debug console**
   - Go to [http://localhost:3000/debug/tileset](http://localhost:3000/debug/tileset)
   - Your tileset ID should be pre-filled
   - Click "Fetch Data" to see your tileset structure

3. **View the map**
   - Go to [http://localhost:3000/map](http://localhost:3000/map)
   - Your parking zones should appear on the map
   - Click on zones to see feature properties

## Troubleshooting

### "Failed to fetch tileset metadata"

**Possible causes:**
- Invalid Mapbox access token
- Incorrect tileset ID format
- Tileset doesn't exist
- Token doesn't have required scopes

**Solutions:**
- Verify token starts with `pk.`
- Check tileset ID format: `username.tileset-id`
- Confirm tileset exists in Mapbox Studio
- Create new token with correct scopes

### "Tileset not showing on map"

**Possible causes:**
- Wrong zoom level
- Data outside visible bounds
- Incorrect source-layer name
- Geometry type mismatch

**Solutions:**
- Zoom to your data location
- Check bounds in debug console
- Verify source-layer matches tileset structure
- Ensure geometry types are supported (Polygon, LineString, Point)

### "Environment variables not loading"

**Possible causes:**
- `.env.local` not in project root
- Variables don't start with `NEXT_PUBLIC_`
- Server not restarted after changes

**Solutions:**
- Place `.env.local` in project root (same level as `package.json`)
- Ensure all variables start with `NEXT_PUBLIC_`
- Restart development server after changing `.env.local`

## Security Notes

- ✅ **DO** use public tokens (starting with `pk.`) for client-side code
- ✅ **DO** restrict token scopes to minimum required
- ✅ **DO** use URL restrictions for production tokens
- ❌ **DON'T** use secret tokens (starting with `sk.`) in client-side code
- ❌ **DON'T** commit `.env.local` to version control
- ❌ **DON'T** share tokens publicly

## Production Deployment

For production deployment:

1. **Set environment variables in your hosting platform**
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Build & Deploy → Environment
   - Other platforms: Follow their documentation

2. **Use production token**
   - Create a separate token for production
   - Add URL restrictions to limit usage
   - Set appropriate scopes

3. **Configure domain restrictions**
   - In Mapbox account settings
   - Add your production domain
   - This prevents token abuse

## Additional Resources

- [Mapbox Access Tokens](https://docs.mapbox.com/help/getting-started/access-tokens/)
- [Mapbox Tilesets API](https://docs.mapbox.com/api/maps/tilesets/)
- [Mapbox Studio Manual](https://docs.mapbox.com/studio-manual/overview/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
