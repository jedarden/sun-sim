# Testing Documentation

## Overview

The repository has eight complementary Playwright suites:

- `tests/solar-reference.spec.js` checks the vendored SunCalc results against fixed U.S. Naval Observatory (USNO) reference fixtures.
- `tests/solar-calculations.spec.js` provides broader smoke coverage for equinox, seasonal, and polar UI states.
- `tests/timezone.spec.js` verifies the browser-timezone display contract across DST transitions, UTC date boundaries, the date line, and both hemispheres.
- `tests/geolocation-fallbacks.spec.js` verifies that GPS and Nominatim failures remain inline and non-blocking.
- `tests/user-workflows.spec.js` exercises map selection, date controls, keyboard shortcuts, presets, timeline scrubbing, animation controls, and midnight rollover.
- `tests/visual-overlays.spec.js` provides screenshot baselines and functional assertions for compass orientation and labels, equinox and polar bearing states, marker visibility, redraw/resize behavior, the sun-path overlay, map repositioning, and the color-coded timeline.
- `tests/performance.spec.js` measures native animation-frame cadence for map overlays, sun-path rendering, timeline dragging, and animation at desktop and mobile viewports.
- `tests/mobile.spec.js` verifies the stacked mobile layout, 44px controls, touch map pan and zoom, touch-driven controls and timeline scrubbing, and canvas rendering across narrow mobile viewport sizes.

The reference suite is the accuracy contract. Its cases cover Quito at the equinox, New York and London near the June solstice, Sydney near the December solstice, and Tromsø during midnight sun and polar night. Each case includes coordinates, an exact UTC instant, solar altitude and true-north azimuth, sunrise, solar noon, sunset, and day length where applicable.

## Running Tests

`npm test` is self-contained: `scripts/test.js` installs dependencies from
`package-lock.json` when `node_modules` is missing and then invokes the locally
installed `@playwright/test` CLI by explicit path. It never resolves
`playwright` through `PATH`, so a bare checkout (or a host whose only
`playwright` binary is an unrelated Python install that rejects the `test`
subcommand) still runs the real suite.

Install dependencies and the Chromium browser once:

```bash
npm install
npm run test:install
```

Run the suite headlessly:

```bash
npm test
```

Other Playwright modes are available through `npm run test:headed` and `npm run test:debug`.

## Accuracy Contract

The checked bounds are stored with the fixtures in `tests/fixtures/solar-references.json` and are enforced by the reference tests:

- **Position**: ±0.3° for the unrounded SunCalc result. The test separately verifies that the UI's one-decimal display is a rounding of that result.
- **Timing**: ±2 minutes for sunrise, solar noon, sunset, and the displayed day-length minute.

These are measured bounds for the six fixed cases against the vendored SunCalc 1.9.0 model, not a universal error guarantee for every location, date, or atmospheric condition. USNO publishes calculated rather than observed values; local weather and atmospheric refraction can change observed sunrise and sunset.

The reference tests set the browser timezone to UTC and request USNO times with `tz=0`. This keeps the fixture comparison independent of the machine running the tests. The application itself uses the browser's local timezone for displayed dates and clock times.

## Timezone, DST, and Date Contract

- **Display policy**: All visible dates and clock times use the browser's IANA timezone. They are not formatted in the selected location's timezone and are not formatted in UTC. The selected coordinates affect solar geometry only; the app does not infer an IANA timezone from latitude and longitude.
- **Calculation model**: `currentDate` is an absolute JavaScript `Date` instant. SunCalc receives that instant and the selected coordinates and returns absolute sunrise, solar-noon, and sunset instants. A browser timezone only changes how those instants are rendered.
- **Calendar navigation**: The date picker and calendar navigation use browser-local civil dates. Day navigation preserves the local wall-clock fields, so moving across a spring-forward or fall-back boundary changes elapsed time by 23 or 25 hours while keeping the displayed clock time. The date picker is synchronized whenever `currentDate` changes.
- **DST gaps and overlaps**: A local time in a spring-forward gap is normalized by the browser's `Date` rules. During a fall-back overlap, a wall-clock time can occur twice; the absolute instant remains authoritative. Animation advances elapsed milliseconds, so it crosses DST transitions and midnight without inventing a local hour.
- **UTC boundaries and the date line**: Header and picker dates can be one calendar day away from their UTC date. Locations on either side of the ±180° longitude boundary continue to use absolute instants; their solar events can fall on adjacent UTC dates. Neither case changes the browser-timezone display policy.
- **Hemisphere behavior**: Latitude changes solar geometry and day length as expected: June is the longer day at the selected northern location and the shorter day at the selected southern location, with the pattern reversed in December.

The timezone suite uses Playwright's `timezoneId` setting to run the same page under `America/New_York`, `America/Los_Angeles`, `Australia/Sydney`, and `UTC`. Run it directly with:

```bash
npx playwright test tests/timezone.spec.js
```

## Geolocation and Nominatim failures

The geolocation suite runs with mocked browser location errors and mocked
Nominatim responses. It verifies permission denial, unavailable positions,
timeouts, HTTP 429 rate limits, and no-result payloads. Each case checks the
inline status and `Custom Location` fallback, visible Nominatim/OpenStreetMap
attribution, and that the date navigation and solar controls remain usable.

Run it directly with:

```bash
npx playwright test tests/geolocation-fallbacks.spec.js
```

## User workflow coverage

The user workflow suite drives the documented controls in Chromium. It covers map dragging for location selection, all date navigation buttons and keyboard shortcuts, seasonal date presets, mouse and touch timeline scrubbing, play/pause behavior, every speed preset, and animation rollover across midnight.

Run it directly with:

```bash
npx playwright test tests/user-workflows.spec.js
```

## Mobile responsive and touch coverage

The mobile suite runs with touch-enabled mobile emulation and checks 320×568, 360×640, and 390×844 layouts. It verifies the stacked map and internally scrolling control panel, 44px minimum primary-control targets, touch date and playback controls, a mocked GPS request, one-finger map panning, pinch zoom, touch zoom buttons, timeline tap and drag synchronization, cross-midnight daylight rendering in a non-UTC browser timezone, and resolution-matched functional canvas pixels after viewport resizing.

Run it directly with:

```bash
npx playwright test tests/mobile.spec.js
```

Automated touch coverage is Chromium-only. The Playwright configuration runs one Chromium project, and the one-finger and two-finger gesture helpers use Chromium's `Input.dispatchTouchEvent` DevTools Protocol. That protocol is not portable to Firefox or WebKit, Playwright's `isMobile` option is not supported in Firefox, and the high-level Playwright touchscreen API only provides single-point taps. Emulation also does not exercise real iOS or Android hardware, browser chrome or dynamic viewport behavior, safe-area insets, actual device pixel ratios, or browser-specific touch-action policies. Geolocation, reverse geocoding, and map tiles are mocked, so the suite does not validate permissions or external services on a device. Flatpickr's generated day cells remain 39×39 so all seven columns fit the 320px profile; the suite verifies that the picker opens by touch but excludes those popup cells from the 44px primary-control assertion. Functional pixel assertions are used instead of a mobile screenshot baseline, which keeps rendering coverage independent of Linux-specific baseline names while leaving real-device visual differences to manual validation.

## Visual overlay coverage

The visual suite uses UTC scenes, mocked map tiles, and a fixed viewport so canvas screenshots are repeatable. It covers compass orientation, cardinal and intercardinal labels, sunrise and sunset bearings, the current-sun marker, the sun-path overlay as time advances, map repositioning, and the color-coded timeline. To refresh the checked-in baselines after an intentional visual change, run:

```bash
npx playwright test tests/visual-overlays.spec.js --update-snapshots
```

## Rendering performance check

Run the repeatable rendering check with:

```bash
npm run test:performance
```

The check uses the browser's native `requestAnimationFrame` clock, discards a 36-frame warm-up, and records 60 frames for each workload. Map tiles and reverse-geocoding responses are mocked so network timing does not determine the result. The desktop profile is 1280×720 with mouse input; the mobile profile is 390×844 with touch input. Both use a device-pixel ratio of 1 and UTC. The Playwright test server uses port 3010 by default; set `SUN_SIM_TEST_PORT` when running parallel checks.

The frame-time budget is a p95 interval of at most 20ms, with no more than 5% of sampled frames exceeding 20ms. The check covers map movement and overlay synchronization, direct sun-path redraws, timeline mouse/touch dragging, and the real animation loop. It also verifies that animation advances the application clock.

Because the development host is shared, a one-second sampling window can absorb a transient scheduler spike that no application change caused. A case that misses the budget is therefore re-sampled once against a fresh animation sequence and passes if either window meets the budget; every window's summary is attached to the Playwright report, and a genuinely slow rendering path still fails because it misses in both windows. The budget itself is unchanged.

The reference run on 2026-09-23 used headless Chromium 151.0.7922.173. All 8 cases passed: average frame rate was 58–60 FPS and p95 frame intervals were 16.7–16.8ms. The result is an environment-specific validation of the documented 60 FPS target, not a guarantee for every device or browser.

An independent repeat run on 2026-09-23 (same host and browser build, executed as part of bead sunsim-fe97aa6b) reproduced the result: all 8 cases passed at 60.0 FPS with p95 frame intervals of 16.7–16.8ms on both profiles, well inside the 20ms budget. The re-sample safeguard exists because one identical-code clean-extraction run earlier the same day missed two desktop windows while the host was under heavy load from unrelated builds; re-running the same commit on a calmer machine passed 66/66. The check is therefore repeatable, and its verdict tracks the rendering path rather than ambient host load.

## Reference Data

All reference values come from the USNO Astronomical Applications Department APIs:

- Position: `https://aa.usno.navy.mil/api/celnav`
- Rise, set, and transit: `https://aa.usno.navy.mil/api/rstt/oneday`

`tests/fixtures/solar-references.json` records the exact query URL, coordinates, UTC instant, and USNO fields used for every case. Position fixtures use `almanac_data.hc` for geometric altitude and `almanac_data.zn` for true-north azimuth. Rise/set fixtures use the USNO local clock values converted to UTC, retaining the source's whole-minute precision.

## Test Architecture

The reference tests load the real page, set the application state, call `updateAll`, and read both the rendered values and the underlying SunCalc values. This verifies the complete path from the vendored library through the browser UI. Polar fixtures also verify that invalid rise/set dates render as `No sunrise` and `No sunset` rather than as placeholder clock values.
