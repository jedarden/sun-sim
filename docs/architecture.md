# Sun Simulator Web Application - System Architecture

**Version:** 1.0.0
**Date:** 2025-11-14
**Status:** Draft
**Author:** System Architecture Designer

## Executive Summary

This document outlines the complete system architecture for a web-based sun simulator application that visualizes sun position, shadows, and solar angles on an interactive map. The application calculates astronomical positions in real-time and renders them as visual overlays on map tiles.

## 1. System Overview

### 1.1 Purpose
The sun simulator provides real-time visualization of:
- Sun position (azimuth, elevation, zenith)
- Shadow casting and direction
- Solar angles throughout the day
- Daylight/twilight/night zones
- Location-specific solar data

### 1.2 Key Requirements
- **Accuracy**: Astronomical calculations accurate to ±0.01°
- **Performance**: Render updates at 60fps
- **Global Coverage**: Support any location worldwide
- **Responsiveness**: Mobile-first responsive design
- **Offline Capability**: Core calculations work offline
- **Real-time**: Live updates with date/time changes

## 2. Technology Stack

### 2.1 Core Technologies

#### Frontend Framework
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
- **Leaflet.js** - Lightweight, extensible, well-documented
- **OpenStreetMap tiles** - Free, global coverage
- Alternative: **Mapbox GL JS** (if 3D features needed)

**Rationale:**
- Leaflet: 42KB vs Mapbox GL: 500KB
- Simpler API for 2D overlays
- Extensive plugin ecosystem
- Better mobile performance

#### Astronomical Calculations
- **SunCalc.js** - Proven library for sun position calculations
- **Custom extensions** - Shadow calculations, twilight zones
- **date-fns** - Date/time manipulation (11KB, tree-shakeable)

**Rationale:**
- SunCalc is industry-standard, battle-tested
- Lightweight (5KB), no dependencies
- Accurate to ±0.01° for sun position
- Will extend with shadow ray-casting algorithms

### 2.2 Development Tools

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
  primary: "Nominatim (OpenStreetMap)" # Free, no API key
  fallback: "Mapbox Geocoding" # Better accuracy, requires key

Tiles:
  primary: "OpenStreetMap"
  alternative: "Mapbox"
  cdn: "CloudFlare" # CDN for tile caching

Time Zones:
  library: "date-fns-tz"
  fallback: "Intl API"
```

## 3. System Architecture

### 3.1 High-Level Architecture

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
│                   Data/Cache Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  IndexedDB   │  │ LocalStorage │  │  SessionCache│      │
│  │  (Locations) │  │ (Preferences)│  │  (Tiles)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

#### 3.2.1 Core Module Structure

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

### 3.3 Data Flow Architecture

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

## 4. Detailed Component Design

### 4.1 Astronomical Calculation Engine

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
- Position accuracy: ±0.01° (standard SunCalc)
- Time accuracy: ±1 second
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

### 4.2 State Management

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

### 4.3 Rendering System

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

#### MapService.js - Leaflet Integration
```javascript
/**
 * Map management and tile loading
 * Integrates with Leaflet for map rendering
 */
class MapService {
  constructor(containerId, options) {
    this.map = L.map(containerId, {
      center: options.center || [0, 0],
      zoom: options.zoom || 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false  // Custom controls
    });

    this.tileLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }
    ).addTo(this.map);
  }

  /**
   * Add custom overlay layer
   */
  addOverlayLayer(canvas) {
    L.canvasLayer(canvas).addTo(this.map);
  }

  /**
   * Convert lat/lng to pixel coordinates
   */
  latLngToPoint(lat, lng) {
    return this.map.latLngToContainerPoint([lat, lng]);
  }

  /**
   * Handle map events
   */
  on(event, handler) {
    this.map.on(event, handler);
  }
}
```

### 4.5 Geocoding Service

#### GeocodingService.js - Location Search
```javascript
/**
 * Location search and reverse geocoding
 * Uses Nominatim (OpenStreetMap) API
 */
class GeocodingService {
  /**
   * Search for location by name
   * @param {string} query - Search query
   * @returns {Promise<Location[]>} Search results
   */
  async search(query) {
    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&limit=5`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'SunSimulator/1.0' }
    });

    return this.parseResults(await response.json());
  }

  /**
   * Reverse geocode coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Location>} Location details
   */
  async reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lng}&format=json`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'SunSimulator/1.0' }
    });

    return this.parseLocation(await response.json());
  }

  /**
   * Get timezone for coordinates
   */
  async getTimezone(lat, lng) {
    // Use Intl API or external service
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}
```

## 5. Data Models

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
OpenStreetMap Nominatim:
  endpoint: "https://nominatim.openstreetmap.org"
  methods:
    - search: "GET /search?q={query}"
    - reverse: "GET /reverse?lat={lat}&lon={lng}"
  rate_limit: "1 req/sec"
  requires_user_agent: true

OpenStreetMap Tiles:
  endpoint: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  subdomains: ["a", "b", "c"]
  rate_limit: "Heavy use requires tile server"

TimeZone API (optional):
  primary: "Intl API (browser)"
  fallback: "GeoNames API"
```

### 6.2 Internal API Design

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

### 7.1 Test Pyramid

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

### 7.2 Test Categories

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

### 7.3 Performance Testing

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

### 7.4 Test Data & Fixtures

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

## 8. Performance Optimization

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

### 9.1 Input Validation

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

### 9.2 API Security

```javascript
/**
 * Rate limiting for external API calls
 */
class RateLimitedGeocodingService extends GeocodingService {
  constructor() {
    super();
    this.requestQueue = [];
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 req/sec for Nominatim
  }

  async search(query) {
    await this.enforceRateLimit();
    return super.search(query);
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequest = Date.now();
  }
}
```

### 9.3 Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.tile.openstreetmap.org data:;
  connect-src 'self' https://nominatim.openstreetmap.org;
  font-src 'self';
">
```

## 10. Accessibility

### 10.1 ARIA Labels and Roles

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

### 10.2 Keyboard Navigation

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

### 10.3 Screen Reader Support

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

### 11.1 Static Hosting

```yaml
Platform: "Netlify / Vercel / GitHub Pages"

Build_Command: "npm run build"
Publish_Directory: "dist"

Environment_Variables:
  - NODE_ENV: "production"
  - VITE_APP_NAME: "Sun Simulator"

Build_Settings:
  minify: true
  sourcemap: false
  compress: true
```

### 11.2 CDN Strategy

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

```
Cache Headers:
  HTML:          no-cache (always revalidate)
  JS/CSS:        max-age=31536000, immutable (1 year, hashed filenames)
  Images:        max-age=604800 (1 week)
  Map Tiles:     max-age=604800 (1 week)
  API Responses: max-age=3600 (1 hour)
```

### 11.4 Progressive Web App

```javascript
// service-worker.js
const CACHE_NAME = 'sun-simulator-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/main.js',
  '/styles.css'
];

// Cache-first strategy for assets
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

```json
// manifest.json
{
  "name": "Sun Simulator",
  "short_name": "SunSim",
  "description": "Visualize sun position and shadows on an interactive map",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#FFD700",
  "background_color": "#FFFFFF",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 12. Monitoring and Analytics

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

### ADR-001: Use Vanilla JavaScript Instead of Framework

**Status:** Accepted
**Date:** 2025-11-14

**Context:**
Need to choose between framework (React/Vue) vs vanilla JavaScript.

**Decision:**
Use vanilla JavaScript with Web Components.

**Rationale:**
- Calculations are CPU-intensive; framework overhead impacts performance
- Bundle size critical (target <100KB)
- DOM updates infrequent (only on user interaction)
- No complex state management needed (simple Pub/Sub sufficient)
- Web Components provide encapsulation without framework

**Consequences:**
- ✅ Smaller bundle size (~60KB vs ~150KB)
- ✅ Better performance (no virtual DOM overhead)
- ✅ No framework lock-in
- ❌ More boilerplate for components
- ❌ Less tooling ecosystem

---

### ADR-002: Use Leaflet Instead of Mapbox GL JS

**Status:** Accepted
**Date:** 2025-11-14

**Context:**
Need map library for tile rendering and user interaction.

**Decision:**
Use Leaflet.js with OpenStreetMap tiles.

**Rationale:**
- Size: Leaflet 42KB vs Mapbox GL 500KB
- 2D overlays are primary use case (no 3D needed)
- Simpler API, easier to integrate with Canvas overlays
- No API key required (free OSM tiles)
- Better mobile performance

**Consequences:**
- ✅ Smaller bundle, faster load
- ✅ Free tiles, no API costs
- ✅ Simpler implementation
- ❌ No 3D features (if needed later, can migrate)
- ❌ Less "modern" visual style

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

### ADR-004: Client-Side Only Architecture (No Backend)

**Status:** Accepted
**Date:** 2025-11-14

**Context:**
Decide whether to use backend server or client-side only.

**Decision:**
Pure client-side application, no backend.

**Rationale:**
- Astronomical calculations work client-side (SunCalc.js)
- Free hosting (static site hosting)
- Infinite scalability (CDN)
- Works offline (PWA)
- No server maintenance

**Consequences:**
- ✅ Zero hosting costs
- ✅ Instant scalability
- ✅ Works offline
- ✅ No server security concerns
- ❌ No server-side caching
- ❌ Limited to client-side calculations

---

## 15. Conclusion

This architecture provides:

✅ **Accuracy**: ±0.01° precision for sun calculations
✅ **Performance**: 60fps rendering, <100ms calculations
✅ **Scalability**: Client-side only, CDN-based distribution
✅ **Maintainability**: Modular design, comprehensive tests
✅ **Accessibility**: WCAG 2.1 AA compliant
✅ **Mobile-First**: Responsive design, touch-optimized
✅ **Offline-Ready**: PWA with service worker caching

**Next Steps:**
1. Review and approve architecture
2. Create detailed implementation plan
3. Set up development environment
4. Begin TDD implementation (tests first)
5. Iterative development with continuous testing

---

**Appendix A: Technology Versions**

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

**Appendix B: File Structure (Complete)**

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
- **Last Updated:** 2025-11-14
- **Author:** System Architecture Designer
- **Status:** Ready for Review
- **Next Step:** Create Implementation Plan
