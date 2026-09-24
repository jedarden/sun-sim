# 🌞 Sun Simulator

Interactive web application for visualizing sun position, sunrise/sunset times, and solar paths for any location and date/time.

**Timezone behavior:** Solar calculations use absolute instants and the selected coordinates, while all displayed dates and clock times use the browser's local timezone. Selecting a location does not switch the display to that location's timezone or to UTC; DST, UTC date boundaries, and the date line are covered by `tests/timezone.spec.js`.

**Live:** [sunsim.jedarden.com](https://sunsim.jedarden.com)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-live-green.svg)
![External services](https://img.shields.io/badge/external_services-no_API--key_fees-yellow.svg)

---

## ✨ Features

🧭 **Compass Rose Overlay** - Visual compass with cardinal directions and sunrise/sunset bearings

☀️ **Real-time Sun Position** - Calculate azimuth and altitude angles with visual bearing indicator

🌅 **Sunrise/Sunset Lines** - Orange/red lines showing exact bearing and time

🗺️ **Interactive Map** - Pan and zoom to select any location worldwide

📍 **GPS Location Button** - One-click location detection using browser geolocation API, with an inline fallback when permission or location is unavailable

🏙️ **Automatic Place-Name Detection** - Reverse geocoding with Nominatim to display city, town, county, state, or country names, with timeout/rate-limit/no-result fallbacks and visible attribution

📅 **Date Navigation** - Arrow keys and buttons to scroll through the year

⏰ **Color-Coded Timeline** - Visual day/night representation with smooth animations

🌍 **Global Coverage** - Works at all latitudes including polar regions

📱 **Mobile Responsive** - Touch-friendly interface with drag controls

💰 **No API keys** - Uses public Esri and Nominatim services; network access and provider attribution are required

🎯 **Reference-validated accuracy** - SunCalc 1.9.0 solar calculations (±0.3° position and ±2 minute rise/set in the USNO fixture suite)

🔗 **GitHub Integration** - Repository link in header for easy access to source code

---

## 🚀 Quick Start

### Option 1: Docker from GitHub Container Registry (Easiest)

```bash
# Pull and run the pre-built image
docker pull ghcr.io/jedarden/sun-sim:0.1.15
docker run -d -p 3000:3000 --name sun-sim ghcr.io/jedarden/sun-sim:0.1.15
```

Access at: **http://localhost:3000**

### Option 2: Docker Build Locally

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t sun-simulator .
docker run -p 3000:3000 sun-simulator
```

Access at: **http://localhost:3000**

### Option 3: Python Server (No Dependencies)

```bash
# Run the built-in Python server
python3 serve.py

# Or specify a custom port
python3 serve.py 8080
```

Access at: **http://localhost:3000** (or your custom port)

### Option 4: Any HTTP Server

The application is a static webpage, so you can use any web server:

```bash
# Node.js http-server
npx http-server -p 3000

# PHP built-in server
php -S localhost:3000

# Python
python -m http.server 3000
```

---

## 🎮 Usage

### 1. 📍 Select Location
- Pan and zoom the map to center the crosshair on your desired location
- Coordinates update automatically in the side panel

### 2. 📅 Choose Date
- Use the date picker to select any date
- Navigate with keyboard shortcuts:
  - **↑** Next day
  - **↓** Previous day
  - **←** Previous month
  - **→** Next month
  - **Shift + ←** Previous week
  - **Shift + →** Next week
  - **T** Jump to today

### 3. ⏰ Set Time
- Drag the color-coded timeline to change time of day
- Watch the sun marker move around the compass rose

### 4. 📊 View Sun Data
- **Azimuth** - Compass direction (0-360°)
- **Altitude** - Angle above horizon
- **Sunrise/Sunset** - Exact times and bearings
- **Solar Noon** - Sun's highest point
- **Day Length** - Hours of daylight

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| 📐 Solar Calculations | [SunCalc.js](https://github.com/mourner/suncalc) | ±0.3° in the checked reference cases |
| 🗺️ Interactive Maps | [Leaflet.js](https://leafletjs.com/) | Pan/zoom controls |
| 🛰️ Satellite Imagery | [ESRI World Imagery](https://www.arcgis.com/) | Esri-hosted satellite and aerial tiles; requires network access |
| 📍 Location Names | [Nominatim](https://nominatim.openstreetmap.org/) | Optional reverse geocoding; requires network access for a named result |
| 📅 Date Picker | [Flatpickr](https://flatpickr.js.org/) | Date selection |
| 💻 Frontend | Vanilla JavaScript | No framework dependencies |

### Map and location service contract

The shipped browser client calls these public services directly:

| Capability | Request | Current UI credit | When the network is unavailable |
| --- | --- | --- | --- |
| Esri World Imagery tiles | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (maximum zoom 18) | `Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community` | Leaflet remains usable over a blank map. Panning, zooming, coordinates, overlays, and solar calculations continue; there is no alternate tile layer. |
| Nominatim reverse geocoding | `https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1` | A Nominatim link and `© OpenStreetMap contributors` remain visible | Coordinates and solar calculations continue; an uncached lookup uses **Custom Location** with an inline status message. |

The Esri credit above is the shipped UI credit. Current [World Imagery service
metadata](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson)
identifies the same sources. Deployments must review the current [Esri terms and
data attributions](https://www.esri.com/en-us/legal/terms) and keep the displayed
credits aligned with their use.

OpenStreetMap supplies location names, not the basemap. Nominatim requests are
debounced for 500 ms, successful names are cached in memory by coordinates
rounded to two decimal places, and an eight-second abort timeout is applied when
`AbortController` is available. Failures are not cached. A timeout, no result,
HTTP 429, or network/CORS/JSON failure does not block the rest of the app.

The [Nominatim public-service policy](https://operations.osmfoundation.org/policies/nominatim/)
allows an absolute maximum of one request per second per application, requires
an identifying HTTP `Referer` or `User-Agent`, and requires visible attribution
and caching. The request attempts `User-Agent: SunSimulator/1.0`, but browser
Fetch support for overriding this header varies. The 500 ms debounce is not an
aggregate one-request-per-second limiter, so deployments must not treat the
public endpoint as a quota-backed production geocoder. The shipped hard-coded
public-instance integration is not, by itself, a complete Nominatim-policy
configuration. Operators remain responsible for compliance with the current
policy and the [Esri terms and data
attributions](https://www.esri.com/en-us/legal/terms).

### Offline behavior

There is no service worker, web manifest, application-managed map-tile cache, or
offline reload guarantee. Provider or browser caching may retain an incidental
tile, but that is not an offline guarantee. A successful load is still required
before disconnecting.

| Functionality | After the app has loaded | Requires network |
| --- | --- | --- |
| Solar calculations, date/timeline controls, animation, and overlays | Continue locally | No |
| Map interaction and coordinate selection | Continue; imagery may be blank | For fresh Esri tiles |
| Location-name lookup | A cached name remains in memory; an uncached lookup uses **Custom Location** | For a live place name |
| GPS button | Uses the browser geolocation service; an offline positioning source may be available | Not guaranteed by this app |
| Cold start or refresh while offline | Not supported as a service contract | Yes |

---

## 🔄 Releases and deployment

`VERSION` records the image version. The `sun-sim-build` Argo Workflow on
`iad-ci` builds and publishes the pinned GHCR image; GitHub Actions is not used
for this repository. The production deployment is managed through the public
[`jedarden/declarative-config`](https://github.com/jedarden/declarative-config)
GitOps repository.

The application itself is static, so a source checkout can also be served by
any static host using the commands in Quick Start.

---

## 📚 Documentation

- 📖 [Architecture](docs/architecture.md) - System design and technical details
- 📍 [Geolocation failure behavior](docs/GEOCODING-FALLBACKS.md) - GPS and Nominatim error, fallback, and attribution policy
- 🧭 [Compass Rose Feature](docs/COMPASS-ROSE-FEATURE.md) - Compass visualization guide
- 📅 [Date Navigation](docs/DATE-NAVIGATION.md) - Navigation controls and shortcuts
- ⚡ [Enhanced Features](docs/ENHANCED-FEATURES.md) - Advanced capabilities
- Testing and performance notes: [docs/notes/testing.md](docs/notes/testing.md)

---

## 📊 Performance Metrics

| Metric | Result |
|--------|--------|
| 🎯 Position Accuracy | ±0.3° against the USNO reference fixtures |
| ⏱️ Timing Accuracy | ±2 minutes against the USNO reference fixtures |
| 🚀 Load Time | < 2.1 seconds |
| 📦 Bundle Size | ~11KB (gzipped) |
| 🎬 Frame Rate | 58–60 FPS in the repeatable rendering check; p95 frame time ≤20ms |

The accuracy figures are fixture-validated bounds for the locations and dates in `tests/fixtures/solar-references.json`; they are not guarantees for every coordinate, date, or atmospheric condition. The position fixture checks the unrounded SunCalc result, while the UI displays angles to one decimal place.

The rendering check is in `tests/performance.spec.js` and can be run with `npm run test:performance`. It samples native `requestAnimationFrame` timing after warm-up at 1280×720 and 390×844 with a device-pixel ratio of 1, mocking map tiles and reverse geocoding for repeatability. It covers map overlay updates, sun-path redraws, mouse/touch timeline dragging, and animation. The budget is a p95 frame interval of at most 20ms and no more than 5% of frames over 20ms. A reference run in headless Chromium 151.0.7922.173 on 2026-09-23 passed all 8 cases at 58–60 FPS with p95 intervals of 16.7–16.8ms, and an independent repeat run the same day reproduced 60.0 FPS on every case with p95 intervals of 16.7–16.8ms.

---

## 🌐 Browser Support

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+
✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 📄 License

MIT License - Free to use, modify, and distribute.

---

## 🙏 Credits

- **SunCalc** - Vladimir Agafonkin ([mourner/suncalc](https://github.com/mourner/suncalc))
- **Leaflet** - Interactive mapping library
- **ESRI** - World Imagery satellite and aerial tile provider
- **OpenStreetMap** - Reverse-geocoded location data through Nominatim

---

## 💬 Support

For issues or questions:
- 🐛 [Create an issue](https://github.com/jedarden/sun-sim/issues)
- 📖 Check the [documentation](docs/)
- ⭐ Star the repo if you find it useful!

---

<p align="center">
  <strong>Status:</strong> Live | <strong>Release:</strong> 0.1.15 | <strong>External services:</strong> No API-key fees
</p>

<p align="center">
  Made with ☀️ and ☕
</p>

---

Part of [jedarden.com](https://jedarden.com) · Read the write-up: [jedarden.com/projects/sunsim/](https://jedarden.com/projects/sunsim/)

*This GitHub repo is a read-only mirror of git.ardenone.com/jedarden/sun-sim — issues and PRs are welcome here either way.*
