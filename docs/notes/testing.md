# Testing Documentation

> **Maintained test guide.** The simulator and its tests moved to the
> [jedarden.com repository](https://git.ardenone.com/jedarden/jedarden.com/).
> The page is at
> [`public/sun-simulator/`](https://git.ardenone.com/jedarden/jedarden.com/src/branch/main/public/sun-simulator/)
> and the Playwright suite is at
> [`tests/sun-simulator/`](https://git.ardenone.com/jedarden/jedarden.com/src/branch/main/tests/sun-simulator/).
> This checkout is a read-only historical record; run the commands below from
> the jedarden.com checkout, not from this repository.

## Commands

From the root of `jedarden.com`, install the locked dependencies and the
Chromium browser once:

```bash
npm ci
npx playwright install chromium
```

Run all 12 browser suites, including the checked-in visual baselines, with:

```bash
npm run test:sun-simulator
```

The command uses `playwright.sun-simulator.config.mjs`. Playwright starts
`node scripts/serve-static.mjs public/sun-simulator 3010` for the simulator
page and a second `node scripts/serve-static.mjs public 3011` for the
Agentation cases, which need `/sun-simulator/` and the site-root `/toolbar.js`
at the same time. Override the ports with `SUN_SIM_TEST_PORT` and
`SUN_SIM_SITE_PORT` when running concurrent checks.

CI runs the same behavioral checks without Linux-specific screenshot
comparisons:

```bash
npm run test:sun-simulator -- --ignore-snapshots
```

To run one browser suite, pass its path through the migrated config, for
example:

```bash
npx playwright test --config playwright.sun-simulator.config.mjs \
  tests/sun-simulator/accessibility.spec.js
```

## Playwright matrix

All browser suites use the Chromium project in
`playwright.sun-simulator.config.mjs` and load the real static page. Network
providers are mocked in suites where an external response is not the subject
of the check.

| Suite | Coverage |
| --- | --- |
| `tests/sun-simulator/accessibility.spec.js` | axe WCAG A/AA and best-practice scans on desktop and mobile; keyboard order and visible focus; date shortcuts; the location-status live region; canvas-label contrast; and reduced-motion behavior. |
| `tests/sun-simulator/agentation-mount.spec.js` | Agentation mounts on the simulator at desktop and mobile when `?feedback=1` is present, and does not load by default. It also pins the shared gate on the autobattler page. |
| `tests/sun-simulator/features.spec.js` | Sun-path projection and polar states; the shadow tool; twilight phases; coordinate and place search; basemap switching; and year CSV export. |
| `tests/sun-simulator/geolocation-fallbacks.spec.js` | GPS absence, denial, unavailable and timeout cases; Nominatim errors and success; request coalescing, spacing, cancellation and caching; and continued UI usability. |
| `tests/sun-simulator/mobile.spec.js` | Stacked responsive layout, touch targets, date and playback controls, map pan and pinch zoom, timeline gestures, timezone behavior, and functional canvas rendering after resize. |
| `tests/sun-simulator/performance.spec.js` | Native `requestAnimationFrame` budgets for map overlays, sun-path rendering, timeline dragging, and animation at desktop and mobile viewports. |
| `tests/sun-simulator/reverse-geocoding.spec.js` | Address-field selection, two-decimal caching, debounce, timeout, stale-response protection, failed-cell retry, and status clearing. |
| `tests/sun-simulator/solar-calculations.spec.js` | Equinox, seasonal, polar and solar-noon smoke cases against the rendered application. |
| `tests/sun-simulator/solar-reference.spec.js` | Fixed USNO position and rise/set fixtures, including polar `No sunrise` and `No sunset` states. The fixture is at `tests/sun-simulator/fixtures/solar-references.json`. |
| `tests/sun-simulator/timezone.spec.js` | Location-timezone display, DST transitions, calendar/date-line boundaries, open-ocean timezone lookup, map movement, and opposite-hemisphere seasons. |
| `tests/sun-simulator/user-workflows.spec.js` | Map selection, date controls and shortcuts, seasonal presets, mouse and touch timeline scrubbing, animation speeds, play/pause, midnight rollover, attribution, and the post-load offline contract. |
| `tests/sun-simulator/visual-overlays.spec.js` | Compass orientation and labels, sunrise/sunset bearings, current-sun and sun-path markers, polar visibility, map redraw, and the color-coded timeline, with checked-in screenshots. |

The visual baselines live beside the suite in
`tests/sun-simulator/visual-overlays.spec.js-snapshots/`. Refresh them only
after an intentional visual change:

```bash
npm run test:sun-simulator -- --update-snapshots
```

The performance suite uses a 1280×720 desktop profile and a 390×844 touch
profile at device-pixel ratio 1. It samples native frame timing after warm-up;
the documented budget is p95 ≤20ms with no more than 5% of frames over 20ms.

## Non-browser route and availability checks

The Playwright matrix is complemented by Node tests in the jedarden.com root:

- `tests/sun-simulator-page.test.js` checks the handwritten route, metadata,
  local asset references, external-service allowlist, control bindings, and
  the `?feedback=1` Agentation gate.
- `tests/sun-simulator-calculations.test.js`,
  `tests/sun-simulator-csv.test.js`, and
  `tests/sun-simulator-validation.test.js` cover the calculation, export, and
  input-validation contracts without a browser.
- `tests/sun-simulator-built.test.js` checks that the build ships the static
  page and its vendored assets. `tests/sun-simulator-served.test.js` starts
  `scripts/serve-static.mjs` over `dist/` and checks route availability,
  content types, `HEAD`, query-string assets, the root Agentation bundle, 404
  handling, and traversal protection.
- `tests/sun-simulator-deployed.test.js` covers the deployed-smoke checker.
  The live availability check is opt-in and runs against a chosen origin:

  ```bash
  SUN_SIMULATOR_TEST_ORIGIN=https://jedarden.com \
    npm run verify:sun-simulator:deployed
  ```

  It checks the canonical route, bare-path redirect, `HEAD`, page metadata,
  byte parity, vendored assets, `/toolbar.js`, and the route's non-negotiated
  HTML response. It is not a browser test.

Run the Node contracts normally with:

```bash
npm test
```

To include the build and the served-output checks in a fresh checkout, use:

```bash
npm run build && npm test
```

`npm run verify:ci` includes the simulator Playwright run with
`--ignore-snapshots` as part of the jedarden.com verification pipeline. Run
`npm test` separately for the Node source/build/served contracts described
above; the former standalone repository deployment commands are not part of
this workflow.

## Accuracy contract

The checked bounds are stored in
`tests/sun-simulator/fixtures/solar-references.json`:

- **Position:** ±0.3° for the unrounded SunCalc result; the UI's one-decimal
  value is checked as a rounding of that result.
- **Timing:** ±2 minutes for sunrise, solar noon, sunset, and displayed day
  length in the fixed cases.

These are measured bounds for the fixture locations and dates, not a universal
error guarantee for every coordinate, date, or atmospheric condition. USNO
publishes calculated values; observed events can differ with local conditions.
