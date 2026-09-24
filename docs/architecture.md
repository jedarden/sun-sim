# Sun Simulator Web Application - System Architecture

**Version:** 1.0.0
**Date:** 2025-11-14
**Last service contract reconciliation:** 2026-09-23
**Status:** Draft (mixed as-built contract and future design)
**Author:** System Architecture Designer

## Executive Summary

This document describes the shipped sun simulator and retains clearly labeled
future design material. The current application is a static, single-page client:
Leaflet renders Esri World Imagery tiles, SunCalc performs all solar calculations
in the browser, and Nominatim optionally supplies reverse-geocoded place names.
There is no application backend, runtime provider switch, service worker, or
persistent map/geocoding cache.

> **As-built boundary:** This is a mixed as-built and future-design draft. The
> shipped service contract is authoritative in sections 1.3, 2.1's Map Engine,
> 2.3, 4.4, 4.5, 6.1, 9.2, 11.3, 11.4, ADR-002, and ADR-004. Other module
> trees, Web Components, storage services, date-fns, build tooling, workers,
> monitoring, deployment steps, and pseudocode are proposals rather than current
> runtime facts unless a passage explicitly says otherwise.

## 1. System Overview

### 1.1 Purpose
The shipped sun simulator provides real-time visualization of:
- Sun azimuth and altitude
- Sunrise, sunset, solar noon, and day length
- A daily sun path
- Date, time, and animation controls
- Location-specific solar data

### 1.2 Key Requirements
- **Accuracy**: Astronomical calculations within ±0.3° in the checked reference cases
- **Performance**: Render updates at 60fps
- **Global Coverage**: Support any location worldwide
- **Responsiveness**: Mobile-first responsive design
- **Partial offline capability**: Solar calculations and controls continue after a successful app load; imagery, place-name lookup, and cold reloads are not guaranteed offline
- **Real-time**: Live updates with date/time changes

### 1.3 Shipped Service and Offline Contract

The browser makes direct requests to two public services. The shipped code does
not proxy, retry through another provider, or switch either endpoint at runtime.

```text
Tiles:       https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
Current UI credit: Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community
Maximum zoom: 18

Geocoding:   https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1
Attribution: Nominatim and © OpenStreetMap contributors
Request identity: attempts User-Agent: SunSimulator/1.0
```

`Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community` is the
shipped UI credit. Current [World Imagery service
metadata](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson)
identifies the same sources. Deployments must review the current [Esri terms
and data attributions](https://www.esri.com/en-us/legal/terms) and keep the
displayed credits aligned with their use.

Esri imagery is the only basemap layer. If its tiles fail, Leaflet keeps its
controls and map state, while unavailable images produce a blank basemap;
coordinates, overlays, and solar calculations continue. There is no OSM or
Mapbox tile fallback.

Nominatim is optional and is not the tile provider. Requests are debounced by
500 ms, successful results are cached in memory using coordinates rounded to two
decimal places, and failures are not cached, so a later update can retry them. If
`AbortController` exists, a
request is aborted after eight seconds. A timeout, HTTP 204/404, HTTP 429,
other HTTP failure, missing supported address field, CORS/network error, or JSON
parse error leaves the coordinates and calculations intact and displays
**Custom Location** with a status message.

The [public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
sets an absolute maximum of one request per second per application and requires
an identifying `Referer` or `User-Agent`, visible attribution, and caching. The
500 ms debounce is not an aggregate rate limiter, and browser Fetch support for
setting `User-Agent` varies. The production operator is responsible for policy
compliance and for selecting a suitable service or proxy if public-instance
access is unsuitable. OpenStreetMap attribution remains visible even on
fallback; the current Esri UI credit remains attached to the tile layer.

After a successful application load, the local Leaflet, SunCalc, and Flatpickr
assets and the date, timeline, animation, overlay, and calculation paths need no
application-server calls. Fresh imagery and place names need external network
access. Browser geolocation depends on the platform's positioning source. There
is no service worker, manifest, IndexedDB cache, persisted geocode cache, or
guaranteed offline reload path.

## 2. Technology Stack

### 2.1 Core Technologies

#### Proposed Frontend Framework
- **Vanilla JavaScript (ES6+)** - No framework overhead, maximum performance
- **Web Components** - Reusable, encapsulated UI components
- **CSS3 with Custom Properties** - Theming and responsive design
- **HTML5 Canvas** - High-performance overlay rendering

**Rationale:**
- Sun calculations are computation-intensive; avoiding framework overhead maximizes performance
- Web Components provide encapsulation without React/Vue bundle size
- Direct DOM manipulation for map integration
- Canvas provides 60fps rendering for overlays

#### Map Engine
- **Leaflet.js** - Vendored locally for map interaction
- **Esri World Imagery** - Direct satellite and aerial tile requests
- **No alternate tile provider** - Tile failures leave the Leaflet layer blank

**Rationale:**
- Leaflet provides the required 2D pan, zoom, and overlay behavior
- The Esri endpoint needs no API key in the shipped client
- The imagery and OpenStreetMap geocoding contracts remain separate services
- Mapbox GL remains a possible future replacement, not a shipped fallback

#### Astronomical Calculations (Current SunCalc Plus Proposed Extensions)
- **SunCalc.js** - Proven library for sun position calculations
- **Custom extensions** - Shadow calculations, twilight zones
- **date-fns** - Date/time manipulation (11KB, tree-shakeable)

**Rationale:**
- SunCalc is industry-standard, battle-tested
- Lightweight (5KB), no dependencies
- Accurate to ±0.3° in the checked reference cases for sun position
- Will extend with shadow ray-casting algorithms

### 2.2 Development Tools (Proposed, Not Shipped)

```json
{
  "build": "Vite",
  "testing": {
    "unit": "Vitest",
    "integration": "Testing Library",
    "e2e": "Playwright"
  },
  "linting": {
    "code": "ESLint",
    "style": "Stylelint"
  },
  "formatting": "Prettier",
  "bundling": "Vite + Rollup",
  "typeChecking": "JSDoc + TypeScript (checkJs)"
}
```

**Rationale:**
- Vite: Fast HMR, optimized builds, native ESM
- Vitest: Same config as Vite, fast, ESM-native
- Playwright: Cross-browser, reliable, screenshot testing
- JSDoc: Type safety without TypeScript compilation overhead

### 2.3 Third-Party Services

```yaml
Geocoding:
  provider: "Nominatim (OpenStreetMap)"
  operation: "reverse only"
  endpoint: "https://nominatim.openstreetmap.org/reverse"
  request_identity: "attempts User-Agent: SunSimulator/1.0"
  policy_limit: "maximum 1 request/second per application"
  fallback: "Custom Location"

Tiles:
  provider: "Esri World Imagery"
  endpoint: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  current_ui_credit: "Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community"
  service_metadata_credit: "Esri, Vantor, Earthstar Geographics, and the GIS User Community"
  fallback: "none; blank basemap"
```

## 3. System Architecture

### 3.1 High-Level Logical Architecture (Modules Are Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Map Component│  │ Control Panel│  │ Info Display │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Application State Layer                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   State Manager (Pub/Sub Event System)               │   │
│  │   - Location State    - Time State                   │   │
│  │   - Sun Data State    - Map State                    │   │
│  │   - UI Preferences    - Cache State                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Astronomical │  │   Shadow     │  │   Twilight   │      │
│  │   Engine     │  │   Calculator │  │   Zones      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Map      │  │  Geocoding   │  │    Render    │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Runtime State Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Browser memory: coordinates, date/time, map view,     │   │
│  │ solar state, and successful rounded-coordinate names  │   │
│  └──────────────────────────────────────────────────────┘   │
│  No IndexedDB, persisted tiles, or service worker          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture (Proposed, Not Shipped)

#### 3.2.1 Core Module Structure (Proposed)

```
src/
├── core/
│   ├── astronomical/
│   │   ├── SunCalculator.js       # Sun position calculations
│   │   ├── ShadowCalculator.js    # Shadow geometry
│   │   ├── TwilightZones.js       # Civil/nautical/astronomical twilight
│   │   ├── SolarAngles.js         # Hour angle, declination, etc.
│   │   └── constants.js           # Astronomical constants
│   │
│   ├── state/
│   │   ├── StateManager.js        # Central state management
│   │   ├── LocationState.js       # Location data state
│   │   ├── TimeState.js           # Date/time state
│   │   ├── SunDataState.js        # Calculated sun data
│   │   └── MapState.js            # Map view state
│   │
│   └── models/
│       ├── Location.js            # Location data model
│       ├── SunPosition.js         # Sun position data model
│       ├── DateTime.js            # Date/time data model
│       └── MapView.js             # Map view data model
│
├── services/
│   ├── MapService.js              # Leaflet map management
│   ├── GeocodingService.js        # Location search
│   ├── RenderService.js           # Canvas overlay rendering
│   ├── TileService.js             # Tile loading/caching
│   └── StorageService.js          # IndexedDB/LocalStorage
│
├── components/
│   ├── map/
│   │   ├── MapContainer.js        # Main map component
│   │   ├── SunOverlay.js          # Sun position overlay
│   │   ├── ShadowOverlay.js       # Shadow overlay
│   │   └── TwilightOverlay.js     # Twilight zones overlay
│   │
│   ├── controls/
│   │   ├── DateTimePicker.js      # Date/time selection
│   │   ├── LocationSearch.js      # Location search input
│   │   ├── PlaybackControls.js    # Time animation controls
│   │   └── SettingsPanel.js       # User preferences
│   │
│   └── display/
│       ├── SunDataDisplay.js      # Current sun data
│       ├── TimeDisplay.js         # Current time display
│       └── LocationDisplay.js     # Current location display
│
├── utils/
│   ├── geometry.js                # Geometric calculations
│   ├── color.js                   # Color utilities
│   ├── formatters.js              # Data formatters
│   ├── validators.js              # Input validation
│   └── debounce.js                # Performance utilities
│
└── main.js                        # Application entry point
```

### 3.3 Proposed Data Flow Architecture

```
User Interaction
      ↓
┌─────────────────┐
│  UI Component   │
└────────┬────────┘
         ↓ (emit event)
┌─────────────────┐
│  State Manager  │ ← Pub/Sub Event Bus
└────────┬────────┘
         ↓ (state change)
┌─────────────────┐
│ Business Logic  │ (Astronomical Engine)
└────────┬────────┘
         ↓ (calculated data)
┌─────────────────┐
│  State Manager  │ (update state)
└────────┬────────┘
         ↓ (notify subscribers)
┌─────────────────┐
│  UI Component   │ (re-render)
└─────────────────┘
         ↓
┌─────────────────┐
│ Render Service  │ (draw overlay)
└─────────────────┘
```

**Data Flow Principles:**
1. **Unidirectional Flow**: Data flows in one direction (UI → State → Logic → State → UI)
2. **Event-Driven**: Components communicate via events, not direct calls
3. **Immutable State**: State updates create new objects, not mutations
4. **Reactive Updates**: Components subscribe to state changes
5. **Optimized Rendering**: Only changed components re-render

## 4. Detailed Component Design (Proposed Except Shipped Service Snippets)

### 4.1 Astronomical Calculation Design (Proposed)

#### SunCalculator.js
```javascript
/**
 * Core sun position calculations using SunCalc library
 * Extended with custom algorithms for enhanced accuracy
 */
class SunCalculator {
  /**
   * Calculate sun position for given coordinates and time
   * @param {Date} date - Target date/time
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lng - Longitude (-180 to 180)
   * @returns {SunPosition} Sun position data
   */
  calculatePosition(date, lat, lng) {
    // Returns: { azimuth, altitude, zenith, distance }
  }

  /**
   * Calculate sun times (sunrise, sunset, twilights)
   */
  calculateTimes(date, lat, lng) {
    // Returns: { sunrise, sunset, solarNoon, civilDawn, etc. }
  }

  /**
   * Calculate solar angles (declination, hour angle)
   */
  calculateAngles(date, lat, lng) {
    // Returns: { declination, hourAngle, rightAscension }
  }
}
```

**Calculation Accuracy:**
- Position accuracy: ±0.3° in the checked reference cases (SunCalc 1.9.0)
- Time accuracy: ±2 minutes in the checked reference cases
- Valid date range: 1900-2100 (SunCalc limitation)

#### ShadowCalculator.js
```javascript
/**
 * Shadow geometry calculations
 * Uses ray-casting for 3D shadow projection
 */
class ShadowCalculator {
  /**
   * Calculate shadow direction and length
   * @param {SunPosition} sunPosition
   * @param {number} objectHeight - Height in meters
   * @returns {Shadow} Shadow data
   */
  calculateShadow(sunPosition, objectHeight) {
    // Ray-casting algorithm
    // Returns: { direction, length, tip: {lat, lng} }
  }

  /**
   * Project shadow on map (lat/lng coordinates)
   */
  projectShadowOnMap(shadow, objectLocation, map) {
    // Returns: array of {lat, lng} points for polyline
  }
}
```

#### TwilightZones.js
```javascript
/**
 * Calculate twilight zones across the globe
 * Determines day/night/twilight boundaries
 */
class TwilightZones {
  /**
   * Calculate terminator line (day/night boundary)
   */
  calculateTerminator(date) {
    // Returns: array of {lat, lng} points
  }

  /**
   * Calculate twilight boundaries
   */
  calculateTwilightBands(date) {
    // Returns: { civil, nautical, astronomical }
  }
}
```

### 4.2 State Management Design (Proposed)

#### StateManager.js - Event-Driven State
```javascript
/**
 * Centralized state management using Pub/Sub pattern
 * Immutable state updates with change notifications
 */
class StateManager {
  constructor() {
    this.state = {
      location: null,
      dateTime: null,
      sunData: null,
      mapView: null,
      preferences: null
    };
    this.subscribers = new Map();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(key, callback) {
    // Callback receives (newValue, oldValue)
  }

  /**
   * Update state and notify subscribers
   */
  setState(key, value) {
    // Immutable update, notify subscribers
  }

  /**
   * Get current state (read-only)
   */
  getState(key) {
    // Return frozen copy (immutable)
  }
}
```

**State Structure:**
```javascript
{
  location: {
    lat: number,
    lng: number,
    name: string,
    timezone: string,
    elevation?: number
  },

  dateTime: {
    timestamp: number,
    date: Date,
    timezone: string,
    isRealTime: boolean
  },

  sunData: {
    position: {
      azimuth: number,    // 0-360°
      altitude: number,   // -90 to 90°
      zenith: number,     // 0-180°
      distance: number    // AU
    },
    times: {
      sunrise: Date,
      sunset: Date,
      solarNoon: Date,
      civilDawn: Date,
      civilDusk: Date,
      nauticalDawn: Date,
      nauticalDusk: Date,
      astronomicalDawn: Date,
      astronomicalDusk: Date
    },
    angles: {
      declination: number,
      hourAngle: number,
      rightAscension: number
    },
    shadow: {
      direction: number,  // degrees from north
      length: number,     // meters per meter of height
      tip: { lat: number, lng: number }
    }
  },

  mapView: {
    center: { lat: number, lng: number },
    zoom: number,
    bounds: { north, south, east, west }
  },

  preferences: {
    units: 'metric' | 'imperial',
    theme: 'light' | 'dark' | 'auto',
    overlays: {
      sunPosition: boolean,
      shadows: boolean,
      twilightZones: boolean,
      sunPath: boolean
    },
    language: string
  }
}
```

### 4.3 Rendering Design (Proposed; Current Rendering Differs)

#### RenderService.js - Canvas Overlay Rendering
```javascript
/**
 * High-performance canvas rendering for map overlays
 * Optimized for 60fps real-time updates
 */
class RenderService {
  constructor(mapService) {
    this.canvas = this.createOverlayCanvas();
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.mapService = mapService;
    this.renderQueue = [];
  }

  /**
   * Render sun position marker
   */
  renderSunPosition(sunData, mapView) {
    // Draw sun icon at calculated position
    // Use requestAnimationFrame for smooth updates
  }

  /**
   * Render shadow overlay
   */
  renderShadow(shadow, mapView) {
    // Draw shadow as semi-transparent polygon
    // Gradient from dark to light
  }

  /**
   * Render twilight zones
   */
  renderTwilightZones(zones, mapView) {
    // Draw color-coded bands
    // Day (yellow), Civil (orange), Nautical (blue), Night (dark)
  }

  /**
   * Render sun path arc
   */
  renderSunPath(sunPositions, mapView) {
    // Draw arc showing sun trajectory
    // From sunrise to sunset
  }

  /**
   * Optimized render loop
   */
  render() {
    requestAnimationFrame(() => {
      this.clearCanvas();
      this.renderQueue.forEach(fn => fn());
      this.render();
    });
  }
}
```

**Rendering Optimizations:**
1. **Dirty Checking**: Only re-render changed elements
2. **Layer Compositing**: Separate canvases for static/dynamic layers
3. **Viewport Culling**: Only render visible elements
4. **RequestAnimationFrame**: Sync with browser refresh
5. **Web Workers**: Offload calculations to background threads

### 4.4 Map Service Integration

#### Leaflet Map Initialization
```javascript
map = L.map('map', {
  zoomControl: true,
  attributionControl: true
}).setView([currentLat, currentLon], 12);

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    maxZoom: 18
  }
).addTo(map);

map.on('moveend zoomend', function() {
  const center = map.getCenter();
  currentLat = center.lat;
  currentLon = center.lng;
  updateAll();
});
```

The application has no tile error handler, alternate layer, application-managed
tile cache, or provider switch. Incidental provider or browser caching is not a
service guarantee. A failed image request does not stop map state or solar
updates.

### 4.5 Geocoding Service

#### Nominatim Reverse Geocoding
```javascript
const url =
  `https://nominatim.openstreetmap.org/reverse?` +
  `format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

const response = await fetch(url, {
  headers: {
    'User-Agent': 'SunSimulator/1.0'
  },
  signal: controller ? controller.signal : undefined
});
```

The shipped client does not expose Nominatim search or autocomplete and does not
call a Mapbox geocoder. It uses the first available supported address field:
`city`, `town`, `village`, `hamlet`, `municipality`, `county`, `state`, or
`country`. Every non-success outcome resolves to **Custom Location** without
changing the selected coordinates or solar state. The visible Nominatim and
OpenStreetMap attribution is independent of the request outcome.

## 5. Proposed Data Models

### 5.1 Core Data Models

```javascript
/**
 * Location data model
 */
class Location {
  constructor(data) {
    this.lat = data.lat;          // -90 to 90
    this.lng = data.lng;          // -180 to 180
    this.name = data.name;        // Display name
    this.timezone = data.timezone; // IANA timezone
    this.elevation = data.elevation || 0; // meters
  }

  validate() {
    if (this.lat < -90 || this.lat > 90) throw new Error('Invalid latitude');
    if (this.lng < -180 || this.lng > 180) throw new Error('Invalid longitude');
  }

  toJSON() { /* ... */ }
  static fromJSON(json) { /* ... */ }
}

/**
 * Sun position data model
 */
class SunPosition {
  constructor(data) {
    this.azimuth = data.azimuth;      // 0-360° (0=North, 90=East)
    this.altitude = data.altitude;    // -90 to 90° (above horizon)
    this.zenith = data.zenith;        // 0-180° (from vertical)
    this.distance = data.distance;    // AU (astronomical units)
    this.timestamp = data.timestamp;  // When calculated
  }

  isAboveHorizon() {
    return this.altitude > 0;
  }

  toCardinalDirection() {
    // Convert azimuth to N, NE, E, SE, etc.
  }
}

/**
 * Date/Time state model
 */
class DateTime {
  constructor(data) {
    this.timestamp = data.timestamp || Date.now();
    this.timezone = data.timezone;
    this.isRealTime = data.isRealTime !== false;
  }

  toDate() {
    return new Date(this.timestamp);
  }

  setTime(hours, minutes) { /* ... */ }
  setDate(year, month, day) { /* ... */ }
}

/**
 * Map view state model
 */
class MapView {
  constructor(data) {
    this.center = data.center;  // { lat, lng }
    this.zoom = data.zoom;      // 2-18
    this.bounds = data.bounds;  // { north, south, east, west }
  }

  contains(lat, lng) { /* ... */ }
}
```

## 6. API Integration Points

### 6.1 External APIs

```yaml
Esri World Imagery:
  operation: "raster tiles"
  endpoint: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  maximum_zoom: 18
  api_key: "none in the shipped client"
  current_ui_credit: "Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community"
  service_metadata_credit: "Esri, Vantor, Earthstar Geographics, and the GIS User Community"
  client_cache: "no application-managed cache; incidental provider/browser caching only"
  fallback: "none; unavailable images leave a usable blank basemap"

Nominatim:
  operation: "reverse geocoding only"
  endpoint: "https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1"
  public_policy_limit: "maximum 1 request/second per application"
  request_identity: "valid Referer or User-Agent required"
  client_identity: "attempts User-Agent: SunSimulator/1.0"
  client_throttle: "500 ms debounce; not an aggregate 1 req/sec limiter"
  cache: "successful names only, in memory by coordinates rounded to 2 decimals"
  attribution: "Nominatim and © OpenStreetMap contributors"
  fallback: "Custom Location for timeout, 204/404, 429, other HTTP/network/CORS/JSON errors"
```

The OSM tile subdomains used by the superseded design are not requested by the
shipped app. OpenStreetMap is used only for reverse-geocoded names.

### 6.2 Proposed Internal API Design

```javascript
/**
 * Internal API for component communication
 */
const API = {
  // Location API
  location: {
    search: (query) => Promise<Location[]>,
    setCurrent: (location) => void,
    getCurrent: () => Location
  },

  // Time API
  time: {
    setCurrent: (dateTime) => void,
    getCurrent: () => DateTime,
    setRealTime: (enabled) => void,
    animate: (speed) => void
  },

  // Sun data API
  sun: {
    getPosition: () => SunPosition,
    getTimes: () => SunTimes,
    getAngles: () => SolarAngles,
    getShadow: (height) => Shadow
  },

  // Map API
  map: {
    setView: (center, zoom) => void,
    getView: () => MapView,
    addMarker: (lat, lng, options) => void,
    removeMarker: (id) => void
  },

  // Rendering API
  render: {
    enableOverlay: (type, enabled) => void,
    setStyle: (type, style) => void,
    refresh: () => void
  }
};
```

## 7. Testing Strategy

The shipped verification command is `npm test`, which runs Playwright against the
static app. No Vitest, Testing Library, coverage-threshold, or unit-test setup is
shipped. The remainder of this section is a proposed expansion, not a description
of current tests.

### 7.1 Proposed Test Pyramid

```
        ┌──────────────────┐
        │   E2E Tests      │  10% - Full user flows
        │   (Playwright)   │
        ├──────────────────┤
        │ Integration Tests│  30% - Component interaction
        │ (Testing Library)│
        ├──────────────────┤
        │   Unit Tests     │  60% - Individual functions
        │   (Vitest)       │
        └──────────────────┘
```

### 7.2 Proposed Test Categories

#### Unit Tests (Critical - 60% coverage target)

```javascript
// tests/core/astronomical/SunCalculator.test.js
describe('SunCalculator', () => {
  describe('calculatePosition', () => {
    it('calculates correct azimuth for known positions', () => {
      // Test against known ephemeris data
      const calc = new SunCalculator();
      const result = calc.calculatePosition(
        new Date('2024-03-20T12:00:00Z'), // Vernal equinox
        0, // Equator
        0  // Prime meridian
      );
      expect(result.azimuth).toBeCloseTo(0, 1); // North ±0.1°
    });

    it('handles edge cases (poles, date line)', () => {
      // Test: North Pole (90°N)
      // Test: South Pole (90°S)
      // Test: International Date Line (±180°)
    });

    it('validates input ranges', () => {
      // Should throw for lat > 90 or < -90
      // Should throw for lng > 180 or < -180
    });
  });

  describe('calculateTimes', () => {
    it('calculates sunrise/sunset for various latitudes', () => {
      // Test: Equator (always ~12hr day)
      // Test: Arctic Circle (midnight sun/polar night)
      // Test: Mid-latitudes (seasonal variation)
    });
  });
});

// tests/core/astronomical/ShadowCalculator.test.js
describe('ShadowCalculator', () => {
  it('calculates shadow length correctly', () => {
    // tan(altitude) = height / shadow_length
    // Verify geometric relationships
  });

  it('calculates shadow direction from sun azimuth', () => {
    // Shadow direction = (azimuth + 180) % 360
  });
});
```

**Critical Test Data Sets:**
```javascript
// Test locations spanning globe
const TEST_LOCATIONS = [
  { name: 'Equator', lat: 0, lng: 0 },
  { name: 'North Pole', lat: 90, lng: 0 },
  { name: 'South Pole', lat: -90, lng: 0 },
  { name: 'Arctic Circle', lat: 66.5, lng: 0 },
  { name: 'Tropic of Cancer', lat: 23.5, lng: 0 },
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Date Line West', lat: 0, lng: -179.9 },
  { name: 'Date Line East', lat: 0, lng: 179.9 }
];

// Test dates for seasonal variation
const TEST_DATES = [
  { name: 'Vernal Equinox', date: '2024-03-20' },
  { name: 'Summer Solstice', date: '2024-06-21' },
  { name: 'Autumnal Equinox', date: '2024-09-22' },
  { name: 'Winter Solstice', date: '2024-12-21' },
  { name: 'Leap Day', date: '2024-02-29' }
];
```

#### Integration Tests (30% coverage)

```javascript
// tests/integration/sun-calculation-flow.test.js
describe('Sun Calculation Flow', () => {
  it('updates sun position when location changes', async () => {
    // 1. Set location
    // 2. Verify sun calculation triggered
    // 3. Verify state updated
    // 4. Verify UI re-rendered
  });

  it('updates sun position when time changes', async () => {
    // Time slider → calculation → state → render
  });

  it('handles timezone changes correctly', async () => {
    // Location with different timezone
    // Verify local time vs UTC calculations
  });
});

// tests/integration/map-rendering.test.js
describe('Map Rendering Integration', () => {
  it('renders sun overlay at correct position', async () => {
    // Calculate position → convert to pixels → render
  });

  it('updates overlay when map is zoomed/panned', async () => {
    // Map event → recalculate pixels → re-render
  });
});
```

#### E2E Tests (10% coverage)

```javascript
// tests/e2e/user-flows.spec.js
import { test, expect } from '@playwright/test';

test('complete sun visualization workflow', async ({ page }) => {
  await page.goto('/');

  // 1. Search for location
  await page.fill('[data-testid="location-search"]', 'New York');
  await page.click('[data-testid="search-result-0"]');

  // 2. Verify map centered
  const mapCenter = await page.locator('[data-testid="map"]')
    .getAttribute('data-center');
  expect(mapCenter).toContain('40.7128');

  // 3. Change date/time
  await page.fill('[data-testid="date-input"]', '2024-06-21');
  await page.fill('[data-testid="time-input"]', '12:00');

  // 4. Verify sun data displayed
  const sunAltitude = await page.locator('[data-testid="sun-altitude"]')
    .textContent();
  expect(parseFloat(sunAltitude)).toBeGreaterThan(70); // High sun in summer

  // 5. Enable shadow overlay
  await page.click('[data-testid="overlay-shadows"]');

  // 6. Verify shadow rendered (screenshot test)
  await expect(page).toHaveScreenshot('summer-solstice-noon.png');
});

test('time animation playback', async ({ page }) => {
  // Play button → animate time → verify smooth updates
});

test('mobile responsive behavior', async ({ page, viewport }) => {
  // Test on mobile viewport
  // Verify touch controls
  // Verify responsive layout
});
```

### 7.3 Proposed Performance Testing

```javascript
// tests/performance/calculation-benchmarks.test.js
describe('Performance Benchmarks', () => {
  it('calculates 10,000 positions in < 100ms', () => {
    const calc = new SunCalculator();
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      calc.calculatePosition(
        new Date(),
        Math.random() * 180 - 90,
        Math.random() * 360 - 180
      );
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('renders 60fps during time animation', async () => {
    // Measure frame rate during animation
    // Should maintain 60fps (16.67ms per frame)
  });
});
```

### 7.4 Proposed Test Data & Fixtures

```
tests/
├── fixtures/
│   ├── locations.json          # Test location data
│   ├── ephemeris.json          # Known sun positions
│   ├── screenshots/            # Visual regression tests
│   └── mock-tiles/             # Mock map tiles
│
├── helpers/
│   ├── astronomical-helpers.js # Test utilities
│   ├── dom-helpers.js          # DOM test utilities
│   └── mock-services.js        # Service mocks
│
└── setup/
    ├── vitest.config.js        # Vitest configuration
    ├── playwright.config.js    # Playwright configuration
    └── test-setup.js           # Global test setup
```

## 8. Proposed Performance Optimization

### 8.1 Calculation Optimization

```javascript
/**
 * Memoization for expensive calculations
 */
class MemoizedSunCalculator extends SunCalculator {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheSize = 1000;
  }

  calculatePosition(date, lat, lng) {
    const key = `${date.getTime()}_${lat}_${lng}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const result = super.calculatePosition(date, lat, lng);

    if (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, result);
    return result;
  }
}
```

### 8.2 Rendering Optimization

```javascript
/**
 * Debounced rendering for map events
 */
class OptimizedRenderService extends RenderService {
  constructor(mapService) {
    super(mapService);
    this.renderDebounced = debounce(this.render.bind(this), 16); // 60fps
    this.isDirty = false;
  }

  markDirty() {
    this.isDirty = true;
    this.renderDebounced();
  }

  render() {
    if (!this.isDirty) return;

    requestAnimationFrame(() => {
      super.render();
      this.isDirty = false;
    });
  }
}
```

### 8.3 Bundle Optimization

```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['leaflet'],
          'astronomical': [
            './src/core/astronomical/SunCalculator.js',
            './src/core/astronomical/ShadowCalculator.js'
          ]
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
};
```

**Target Bundle Sizes:**
- Initial load: < 100KB (gzipped)
- Vendor chunk: < 50KB
- App chunk: < 50KB
- Total assets: < 200KB

### 8.4 Web Worker Offloading

```javascript
// workers/sun-calculator.worker.js
/**
 * Offload calculations to Web Worker
 * Prevents blocking main thread
 */
self.addEventListener('message', (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'CALCULATE_POSITION':
      const result = calculatePosition(data.date, data.lat, data.lng);
      self.postMessage({ type: 'POSITION_RESULT', result });
      break;

    case 'CALCULATE_PATH':
      const path = calculateDailyPath(data.date, data.lat, data.lng);
      self.postMessage({ type: 'PATH_RESULT', path });
      break;
  }
});
```

## 9. Security Considerations

### 9.1 Proposed Input Validation

```javascript
/**
 * Validate all user inputs
 */
class InputValidator {
  static validateLatitude(lat) {
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new ValidationError('Invalid latitude');
    }
  }

  static validateLongitude(lng) {
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      throw new ValidationError('Invalid longitude');
    }
  }

  static validateDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new ValidationError('Invalid date');
    }
  }

  static sanitizeInput(input) {
    // Remove HTML tags, scripts
    return DOMPurify.sanitize(input);
  }
}
```

### 9.2 External Service Policy

The public Nominatim instance requires an aggregate maximum of one request per
second for the whole application, a valid identifying HTTP `Referer` or
`User-Agent`, clear attribution, and caching. The current client applies a
500 ms per-update debounce and caches successful names in memory. It cancels
stale in-flight requests when `AbortController` is available; otherwise it
ignores their responses by request ID. It does **not** implement a
one-request-per-second queue, cache
failures, expose a runtime service switch, or guarantee that browser Fetch will
send the requested `User-Agent`. HTTP 429 is handled as a visible, recoverable
fallback rather than proof that requests were compliant.

A production deployment that cannot stay below the public policy limit, meet
the identification requirement, or switch services without an application
update must use a suitable service through a switchable configuration or proxy.
The shipped hard-coded public-instance integration is not, by itself, a
complete Nominatim-policy production configuration.

### 9.3 Content Security Policy (Future Example)

No CSP is deployed. The example below is not compatible with the current
inline application script as written and must be redesigned and tested before
adoption; the Esri and Nominatim origins document the direct requests that a
future policy must permit.

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://server.arcgisonline.com data:;
  connect-src 'self' https://nominatim.openstreetmap.org;
  font-src 'self';
">
```

## 10. Accessibility Requirements and Proposed Markup

The application includes ARIA and keyboard behaviors, but no WCAG conformance
audit is part of this repository. The markup and feature examples below are
proposals, not a compliance claim.

### 10.1 Proposed ARIA Labels and Roles

```html
<!-- Map container -->
<div id="map" role="application" aria-label="Interactive sun simulator map">
  <!-- Overlays -->
</div>

<!-- Controls -->
<div class="controls" role="region" aria-label="Sun simulator controls">
  <input
    type="date"
    id="date-picker"
    aria-label="Select date"
    aria-describedby="date-help"
  />
  <span id="date-help" class="sr-only">
    Choose a date to visualize sun position
  </span>
</div>

<!-- Data display -->
<div role="region" aria-live="polite" aria-atomic="true">
  <dl>
    <dt>Sun Altitude:</dt>
    <dd id="sun-altitude">45.2°</dd>
    <dt>Sun Azimuth:</dt>
    <dd id="sun-azimuth">180.5°</dd>
  </dl>
</div>
```

### 10.2 Proposed Keyboard Navigation

```javascript
/**
 * Keyboard controls for map and time controls
 */
class KeyboardController {
  constructor(mapService, timeService) {
    this.setupKeyBindings();
  }

  setupKeyBindings() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'ArrowUp':    // Zoom in
        case 'ArrowDown':  // Zoom out
        case 'ArrowLeft':  // Time -1 hour
        case 'ArrowRight': // Time +1 hour
        case ' ':          // Play/pause animation
        case 'Escape':     // Close panels
        // etc.
      }
    });
  }
}
```

### 10.3 Proposed Screen Reader Support

```javascript
/**
 * Announce changes to screen readers
 */
class A11yAnnouncer {
  announce(message, priority = 'polite') {
    const announcer = document.getElementById('a11y-announcer');
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

// Usage:
announcer.announce('Sun position updated: altitude 45 degrees, azimuth 180 degrees');
```

## 11. Deployment Architecture

### 11.1 Current Static Hosting

```text
Document root: repository root
Entry point: index.html
Build step: none
Built-in command: python3 serve.py [port]
Alternative: any static HTTP server or the Docker image
```

The shipped package scripts do not define a production build.

### 11.2 Proposed CDN Strategy

```javascript
// vite.config.js
export default {
  build: {
    assetsInlineLimit: 4096, // Inline assets < 4KB
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'chunks/[name].[hash].js',
        entryFileNames: '[name].[hash].js'
      }
    }
  }
};
```

### 11.3 Caching Strategy

```text
Built-in Python server:
  HTML:          no-cache, no-store
  /vendor/:      max-age=31536000, immutable

Application persistence:
  Geocoding:     successful names only, in memory for the current page
  Map tiles:     no application cache; incidental browser caching is not guaranteed
  App shell:     no service worker or manifest
```

The future cache header values previously shown for hashed assets, imagery,
tiles, and API responses are not part of the shipped application. The HTML is
explicitly not persisted, so a cold offline reload has no supported path.

### 11.4 Progressive Web App (Future Work)

The shipped repository has no service worker, web manifest, installable icons,
or offline tile dataset. The earlier service-worker and manifest examples were
design sketches and do not describe existing files.

A future offline implementation must cache the app shell, define explicit
policies for vendor assets and Esri requests, and use only imagery authorized
for the intended offline/export use. Caching ordinary World Imagery requests in
a service worker must not be represented as blanket permission to bundle or
export the imagery. Until those pieces exist, the supported contract is local
calculations after a successful load, not full offline operation.

## 12. Proposed Monitoring and Analytics

### 12.1 Error Tracking

```javascript
/**
 * Global error handler
 */
class ErrorTracker {
  static init() {
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack
      });
    });
  }

  static logError(error) {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    console.error('Application Error:', error);
  }
}
```

### 12.2 Performance Monitoring

```javascript
/**
 * Performance metrics collection
 */
class PerformanceMonitor {
  static collectMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');

    return {
      // Page load metrics
      domContentLoaded: navigation.domContentLoadedEventEnd,
      loadComplete: navigation.loadEventEnd,
      firstPaint: paint.find(e => e.name === 'first-paint')?.startTime,
      firstContentfulPaint: paint.find(e => e.name === 'first-contentful-paint')?.startTime,

      // Resource metrics
      totalResources: performance.getEntriesByType('resource').length,

      // Custom metrics
      calculationTime: this.measureCalculationTime(),
      renderTime: this.measureRenderTime()
    };
  }
}
```

### 12.3 User Analytics (Privacy-Preserving)

```javascript
/**
 * Privacy-preserving analytics
 * No PII, no tracking cookies
 */
class Analytics {
  static trackEvent(category, action, label) {
    // Use privacy-preserving analytics (Plausible, Fathom)
    // Only track:
    // - Feature usage (which overlays enabled)
    // - Performance metrics (calculation times)
    // - Error rates
    // NO user identification, NO location tracking
  }
}
```

## 13. Future Enhancements

### 13.1 Roadmap (Phase 2+)

**Advanced Features:**
1. **3D Globe View** - Three.js for 3D visualization
2. **Solar Panel Optimization** - Calculate optimal panel angles
3. **Photography Planning** - Golden hour, blue hour
4. **Historical Data** - View sun position on any past date
5. **Solar Eclipse Visualization** - Moon shadow paths
6. **Multiple Location Comparison** - Compare sun at different locations
7. **Export Features** - Export data as CSV/JSON
8. **API** - Provide API for developers

**Technical Improvements:**
1. **WebAssembly** - Port calculations to WASM for 10x speed
2. **IndexedDB Caching** - Cache calculated positions
3. **Service Worker** - Full offline functionality
4. **WebGL Rendering** - GPU-accelerated overlays
5. **Real-time Collaboration** - Share views with others

### 13.2 Scalability Considerations

```
Current Architecture:
  - Client-side only
  - No backend required
  - Scales horizontally via CDN

Future Scaling (if needed):
  - Edge Computing: CloudFlare Workers for calculations
  - Database: Cache frequently-requested positions
  - WebSocket: Real-time multi-user collaboration
  - API Gateway: Rate limiting, authentication
```

## 14. Architecture Decision Records (ADRs)

### ADR-001: Use Vanilla JavaScript Instead of a Framework

**Status:** Accepted
**Date:** 2025-11-14
**Reconciled:** 2026-09-23

**Context:**
The application needs browser-side calculations and a static deployment without
a build or framework runtime.

**Decision:**
Use vanilla JavaScript and direct DOM updates in `index.html`. Do not use
Web Components or an application Pub/Sub layer.

**Rationale:**
- SunCalc and the UI can run directly in supported browsers
- The static app needs no bundler or framework runtime
- Existing state is small enough for direct variables and event handlers

**Consequences:**
- ✅ No framework or build dependency
- ✅ Straightforward static deployment
- ❌ UI organization and state coordination live in one large document
- ❌ Reuse and unit isolation require future refactoring

---

### ADR-002: Use Leaflet with Esri World Imagery

**Status:** Accepted
**Date:** 2025-11-14
**Reconciled:** 2026-09-23

**Context:**
The map needs 2D tile rendering and user interaction without a configured API
key in the shipped client.

**Decision:**
Use the locally vendored Leaflet.js with direct Esri World Imagery tile
requests. Keep OpenStreetMap limited to optional Nominatim reverse geocoding.
Mapbox is not a shipped tile or geocoding fallback.

**Rationale:**
- Leaflet provides the required 2D interaction and overlay integration
- The Esri endpoint supplies the intended satellite and aerial view
- The current endpoint requires no key, but use remains subject to attribution
  and Esri terms; it is not an unrestricted or offline data grant

**Consequences:**
- ✅ Satellite and aerial basemap with no configured key
- ✅ Simple 2D implementation
- ❌ Imagery requires network access and all credits required by the current Esri terms
- ❌ No alternate tile provider when requests fail
- ❌ No guaranteed offline imagery

---

### ADR-003: Use Canvas for Overlay Rendering

**Status:** Accepted
**Date:** 2025-11-14

**Context:**
Need to render sun overlays on map (SVG vs Canvas vs WebGL).

**Decision:**
Use HTML5 Canvas for overlay rendering.

**Rationale:**
- Target 60fps performance for time animations
- Canvas faster than SVG for frequent redraws
- Simpler than WebGL for 2D shapes
- Good browser support
- Easy integration with Leaflet

**Consequences:**
- ✅ 60fps rendering achieved
- ✅ Smooth animations
- ✅ Lightweight implementation
- ❌ Harder to debug than SVG
- ❌ No automatic scaling (need to redraw on resize)

---

### ADR-004: Client-Side Application Without an Application Backend

**Status:** Accepted
**Date:** 2025-11-14
**Reconciled:** 2026-09-23

**Context:**
The application can serve its code statically, but it still uses external map,
geocoding, and browser geolocation services.

**Decision:**
Keep solar calculations and UI state in the browser without an application
backend or runtime geocoding proxy. Do not claim full offline operation.

**Rationale:**
- SunCalc performs the core calculations locally
- Static delivery needs no application server
- External service failures have non-blocking UI fallbacks
- A service worker and offline imagery strategy are not implemented

**Consequences:**
- ✅ Calculations and controls continue after a successful app load
- ✅ No application backend to operate
- ❌ Cold offline reload is unsupported
- ❌ Fresh Esri imagery requires network access
- ❌ Public Nominatim use requires deployment-level policy compliance
- ❌ No persistent application cache or server-side geocoding control

---

## 15. Conclusion

The shipped application provides:

- **Reference-checked solar results** for the fixtures covered by Playwright
- **Static client-side delivery** with no application backend
- **Direct vanilla-JavaScript controls** for date, time, animation, map, and
  overlays
- **Network-dependent Esri imagery** with a blank-map fallback
- **Optional Nominatim place names** with **Custom Location** fallback
- **Selected ARIA and keyboard behaviors**, without a WCAG conformance claim
- **Partial offline operation**: local calculations continue after a successful
  load, while imagery, place-name lookup, and cold reloads remain
  network-dependent

The modular file layout, expanded test pyramid, date-fns tooling, storage layer,
CDN strategy, and monitoring examples in this draft remain future design.

---

**Appendix A: Proposed Technology Versions (Not Shipped)**

This is a target dependency set, not `package.json`. The current static client
vendors Leaflet, SunCalc, and Flatpickr and uses Playwright as its sole
development dependency.

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "suncalc": "^1.9.0",
    "date-fns": "^3.0.0",
    "date-fns-tz": "^2.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/dom": "^9.0.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

**Appendix B: Proposed File Structure (Not Shipped)**

The tree below is a future modularization target. The current implementation is
`index.html`, `serve.py`, vendored assets, and Playwright tests at the repository
root.

```
sun-simulator/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── robots.txt
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── src/
│   ├── main.js
│   │
│   ├── core/
│   │   ├── astronomical/
│   │   │   ├── SunCalculator.js
│   │   │   ├── ShadowCalculator.js
│   │   │   ├── TwilightZones.js
│   │   │   ├── SolarAngles.js
│   │   │   └── constants.js
│   │   │
│   │   ├── state/
│   │   │   ├── StateManager.js
│   │   │   ├── LocationState.js
│   │   │   ├── TimeState.js
│   │   │   ├── SunDataState.js
│   │   │   └── MapState.js
│   │   │
│   │   └── models/
│   │       ├── Location.js
│   │       ├── SunPosition.js
│   │       ├── DateTime.js
│   │       └── MapView.js
│   │
│   ├── services/
│   │   ├── MapService.js
│   │   ├── GeocodingService.js
│   │   ├── RenderService.js
│   │   ├── TileService.js
│   │   └── StorageService.js
│   │
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapContainer.js
│   │   │   ├── SunOverlay.js
│   │   │   ├── ShadowOverlay.js
│   │   │   └── TwilightOverlay.js
│   │   │
│   │   ├── controls/
│   │   │   ├── DateTimePicker.js
│   │   │   ├── LocationSearch.js
│   │   │   ├── PlaybackControls.js
│   │   │   └── SettingsPanel.js
│   │   │
│   │   └── display/
│   │       ├── SunDataDisplay.js
│   │       ├── TimeDisplay.js
│   │       └── LocationDisplay.js
│   │
│   ├── utils/
│   │   ├── geometry.js
│   │   ├── color.js
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── debounce.js
│   │
│   ├── workers/
│   │   └── sun-calculator.worker.js
│   │
│   └── styles/
│       ├── main.css
│       ├── map.css
│       ├── controls.css
│       └── variables.css
│
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   │   └── astronomical/
│   │   │       ├── SunCalculator.test.js
│   │   │       ├── ShadowCalculator.test.js
│   │   │       └── TwilightZones.test.js
│   │   └── utils/
│   │       └── geometry.test.js
│   │
│   ├── integration/
│   │   ├── sun-calculation-flow.test.js
│   │   └── map-rendering.test.js
│   │
│   ├── e2e/
│   │   ├── user-flows.spec.js
│   │   └── mobile.spec.js
│   │
│   ├── performance/
│   │   └── calculation-benchmarks.test.js
│   │
│   ├── fixtures/
│   │   ├── locations.json
│   │   ├── ephemeris.json
│   │   └── screenshots/
│   │
│   ├── helpers/
│   │   ├── astronomical-helpers.js
│   │   ├── dom-helpers.js
│   │   └── mock-services.js
│   │
│   └── setup/
│       ├── vitest.config.js
│       ├── playwright.config.js
│       └── test-setup.js
│
├── docs/
│   ├── architecture.md          # This file
│   ├── implementation-plan.md   # Next deliverable
│   ├── api-reference.md
│   └── user-guide.md
│
├── config/
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── prettier.config.js
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json
├── package-lock.json
├── .gitignore
├── .env.example
└── README.md
```

---

**Document Metadata:**
- **Version:** 1.0.0
- **Last Updated:** 2026-09-23
- **Author:** System Architecture Designer
- **Status:** Draft (mixed as-built contract and future design)
- **Next Step:** Validate the proposed future-design sections separately
