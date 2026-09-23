# Testing Documentation

## Overview

The repository has three complementary Playwright suites:

- `tests/solar-reference.spec.js` checks the vendored SunCalc results against fixed U.S. Naval Observatory (USNO) reference fixtures.
- `tests/solar-calculations.spec.js` provides broader smoke coverage for equinox, seasonal, and polar UI states.
- `tests/timezone.spec.js` verifies the browser-timezone display contract across DST transitions, UTC date boundaries, the date line, and both hemispheres.

The reference suite is the accuracy contract. Its cases cover Quito at the equinox, New York and London near the June solstice, Sydney near the December solstice, and Tromsø during midnight sun and polar night. Each case includes coordinates, an exact UTC instant, solar altitude and true-north azimuth, sunrise, solar noon, sunset, and day length where applicable.

## Running Tests

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

## Reference Data

All reference values come from the USNO Astronomical Applications Department APIs:

- Position: `https://aa.usno.navy.mil/api/celnav`
- Rise, set, and transit: `https://aa.usno.navy.mil/api/rstt/oneday`

`tests/fixtures/solar-references.json` records the exact query URL, coordinates, UTC instant, and USNO fields used for every case. Position fixtures use `almanac_data.hc` for geometric altitude and `almanac_data.zn` for true-north azimuth. Rise/set fixtures use the USNO local clock values converted to UTC, retaining the source's whole-minute precision.

## Test Architecture

The reference tests load the real page, set the application state, call `updateAll`, and read both the rendered values and the underlying SunCalc values. This verifies the complete path from the vendored library through the browser UI. Polar fixtures also verify that invalid rise/set dates render as `No sunrise` and `No sunset` rather than as placeholder clock values.
