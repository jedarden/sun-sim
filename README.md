# 🌞 Sun Simulator

Interactive web application for visualizing sun position, sunrise/sunset times, and solar paths for any location and date/time.

**Live:** [sunsim.jedarden.com](https://sunsim.jedarden.com)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production-green.svg)
![Cost](https://img.shields.io/badge/cost-%240-success.svg)

---

## ✨ Features

🧭 **Compass Rose Overlay** - Visual compass with cardinal directions and sunrise/sunset bearings

☀️ **Real-time Sun Position** - Calculate azimuth and altitude angles with visual bearing indicator

🌅 **Sunrise/Sunset Lines** - Orange/red lines showing exact bearing and time

🗺️ **Interactive Map** - Pan and zoom to select any location worldwide

📍 **GPS Location Button** - One-click location detection using browser geolocation API

🏙️ **Automatic City Detection** - Reverse geocoding with Nominatim to display location names

📅 **Date Navigation** - Arrow keys and buttons to scroll through the year

⏰ **Color-Coded Timeline** - Visual day/night representation with smooth animations

🌍 **Global Coverage** - Works at all latitudes including polar regions

📱 **Mobile Responsive** - Touch-friendly interface with drag controls

💰 **Zero Cost** - Free satellite imagery, no API keys required

🎯 **High Accuracy** - SunCalc-powered solar calculations (±0.01° position, ±1 minute timing)

🔗 **GitHub Integration** - Repository link in header for easy access to source code

---

## 🚀 Quick Start

### Option 1: Docker from GitHub Container Registry (Easiest)

```bash
# Pull and run the pre-built image
docker pull ghcr.io/jedarden/sun-sim:0.1.14
docker run -d -p 3000:3000 --name sun-sim ghcr.io/jedarden/sun-sim:0.1.14
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
| 📐 Solar Calculations | [SunCalc.js](https://github.com/mourner/suncalc) | ±0.01° accuracy |
| 🗺️ Interactive Maps | [Leaflet.js](https://leafletjs.com/) | Pan/zoom controls |
| 🛰️ Satellite Imagery | [ESRI World Imagery](https://www.arcgis.com/) | Free high-res tiles |
| 📅 Date Picker | [Flatpickr](https://flatpickr.js.org/) | Date selection |
| 💻 Frontend | Vanilla JavaScript | No framework dependencies |

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
- 🧭 [Compass Rose Feature](docs/COMPASS-ROSE-FEATURE.md) - Compass visualization guide
- 📅 [Date Navigation](docs/DATE-NAVIGATION.md) - Navigation controls and shortcuts
- ⚡ [Enhanced Features](docs/ENHANCED-FEATURES.md) - Advanced capabilities

---

## 📊 Performance Metrics

| Metric | Result |
|--------|--------|
| 🎯 Position Accuracy | ±0.01° (SunCalc library) |
| ⏱️ Timing Accuracy | ±1 minute (SunCalc library) |
| 🚀 Load Time | < 2.1 seconds |
| 📦 Bundle Size | ~11KB (gzipped) |
| 🎬 Frame Rate | 58-60 FPS |

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
- **ESRI** - Satellite imagery provider
- **OpenStreetMap** - Map data contributors

---

## 💬 Support

For issues or questions:
- 🐛 [Create an issue](https://github.com/jedarden/sun-sim/issues)
- 📖 Check the [documentation](docs/)
- ⭐ Star the repo if you find it useful!

---

<p align="center">
  <strong>Status:</strong> ✅ Production Ready | <strong>Release:</strong> 0.1.14 | <strong>Cost:</strong> $0
</p>

<p align="center">
  Made with ☀️ and ☕
</p>

---

Part of [jedarden.com](https://jedarden.com) · Read the write-up: [jedarden.com/projects/sunsim/](https://jedarden.com/projects/sunsim/)

*This GitHub repo is a read-only mirror of git.ardenone.com/jedarden/sun-sim — issues and PRs are welcome here either way.*
