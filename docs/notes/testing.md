# Testing Documentation

## Overview

The repository has two complementary Playwright suites for solar calculations:

- `tests/solar-reference.spec.js` checks the vendored SunCalc results against fixed U.S. Naval Observatory (USNO) reference fixtures.
- `tests/solar-calculations.spec.js` provides broader smoke coverage for equinox, seasonal, and polar UI states.

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

The tests set the browser timezone to UTC and request USNO times with `tz=0`. This keeps the fixture comparison independent of the machine running the tests. The application itself continues to display times in the browser's local timezone.

## Reference Data

All reference values come from the USNO Astronomical Applications Department APIs:

- Position: `https://aa.usno.navy.mil/api/celnav`
- Rise, set, and transit: `https://aa.usno.navy.mil/api/rstt/oneday`

`tests/fixtures/solar-references.json` records the exact query URL, coordinates, UTC instant, and USNO fields used for every case. Position fixtures use `almanac_data.hc` for geometric altitude and `almanac_data.zn` for true-north azimuth. Rise/set fixtures use the USNO local clock values converted to UTC, retaining the source's whole-minute precision.

## Test Architecture

The reference tests load the real page, set the application state, call `updateAll`, and read both the rendered values and the underlying SunCalc values. This verifies the complete path from the vendored library through the browser UI. Polar fixtures also verify that invalid rise/set dates render as `No sunrise` and `No sunset` rather than as placeholder clock values.
