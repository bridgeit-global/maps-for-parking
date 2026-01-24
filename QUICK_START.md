# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Configure Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
NEXT_PUBLIC_TILESET_ID=username.tileset-id
```

Get your Mapbox token: https://account.mapbox.com/access-tokens/

### Step 2: Run Development Server

```bash
pnpm dev
```

### Step 3: View Your Map

Open http://localhost:3000/map

## 🔍 Debug Your Tileset

Visit http://localhost:3000/debug/tileset to:
- ✅ Inspect tileset structure
- ✅ View all data layers
- ✅ Check field definitions
- ✅ See example style expressions

## 📊 What You'll See

The map automatically:
- 🗺️ Loads your tileset data
- 🎨 Colors features by type/status
- 🖱️ Shows popups on click
- 📍 Centers on your data

## 🎨 Color Coding

Default colors based on `parking_type`:
- 🔵 Blue - Paid parking
- 🟢 Green - Free parking
- 🔴 Red - Restricted
- 🟡 Yellow - Time restricted

## 📝 Recommended Data Structure

```json
{
  "type": "Feature",
  "geometry": { ... },
  "properties": {
    "parking_type": "paid",
    "name": "Zone Name",
    "capacity": 50,
    "rate": "₹40/hour"
  }
}
```

## 🛠️ Troubleshooting

### Map not loading?
- Check `.env.local` exists
- Verify Mapbox token is valid
- Restart dev server

### Tileset not showing?
- Use debug console at `/debug/tileset`
- Check browser console (F12)
- Verify tileset ID format

### Wrong colors?
- Check field names in debug console
- Ensure values match style expressions
- See `TILESET_GUIDE.md` for customization

## 📚 Documentation

- **Full Guide**: [TILESET_GUIDE.md](./TILESET_GUIDE.md)
- **Configuration**: [CONFIGURATION.md](./CONFIGURATION.md)
- **Implementation**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

## 🆘 Need Help?

1. Check the debug console: `/debug/tileset`
2. Review browser console logs
3. Read the documentation files
4. Check Mapbox Studio for tileset status

## 🎯 Key URLs

- **Home**: http://localhost:3000
- **Map**: http://localhost:3000/map
- **Debug**: http://localhost:3000/debug/tileset
- **Mapbox Studio**: https://studio.mapbox.com/

## ✨ Features

- ✅ Automatic layer detection
- ✅ Dynamic style expressions
- ✅ Multi-geometry support (Polygon, Line, Point)
- ✅ Interactive popups
- ✅ Zoom-adaptive styling
- ✅ Debug console
- ✅ Comprehensive documentation

---

**Ready to customize?** See [TILESET_GUIDE.md](./TILESET_GUIDE.md) for advanced configuration.
