# Testing Documentation

## Overview

The sun-sim repository includes automated smoke tests for solar calculation correctness using Playwright. These tests verify that the sun position, sunrise/sunset times, and day length calculations are accurate within reasonable tolerances for known reference cases.

## Test Coverage

The current test suite (`tests/solar-calculations.spec.js`) covers:

1. **Equator on Equinox** - Validates that day length is approximately 12 hours at the equator on the vernal equinox (March 20, 2024)

2. **New York City Summer Solstice** - Verifies sunrise/sunset times against timeanddate.com reference data for NYC on June 21, 2024, with ±2 minute tolerance

3. **Arctic Circle Midnight Sun** - Tests that locations above the Arctic Circle (Tromsø, Norway) correctly display "24h (Midnight Sun)" on the summer solstice

4. **Arctic Circle Polar Night** - Tests that locations above the Arctic Circle correctly display "0h (Polar Night)" on the winter solstice

5. **Sun Position Calculations** - Verifies azimuth and altitude calculations at solar noon on the equinox

6. **Seasonal Variation** - Validates that mid-latitude locations (London, UK) show realistic seasonal day length differences between summer and winter solstices

## Running Tests

### Prerequisites

Install Node.js dependencies:

```bash
npm install
```

Install Playwright browsers (only needed once):

```bash
npm run test:install
```

**Note:** On NixOS or other non-standard Linux distributions, you may need to install additional system libraries for Chromium to run. On standard Linux distributions (Ubuntu, Debian, etc.) or in CI environments, the tests should run without additional dependencies.

### Run Tests

```bash
# Run tests headless (default)
npm test

# Run tests in headed mode (see browser window)
npm run test:headed

# Run tests in debug mode (with Playwright Inspector)
npm run test:debug
```

### Test Output

Test results are saved in `playwright-report/`:
- `index.html` - Interactive HTML report with screenshots of failures
- Run `npx playwright show-report` to view the report

## Test Tolerances

The tests use reasonable tolerances that match the accuracy of the underlying SunCalc library:

- **Time accuracy**: ±2 minutes for sunrise/sunset times (SunCalc claims ±1 minute)
- **Angle accuracy**: ±5 degrees for sun position (SunCalc claims ±0.01°)
- **Day length**: ±15 minutes for equinox tests (accounts for atmospheric refraction and definition variations)

## Reference Data Sources

Test reference values are derived from:
- **Equinox**: Astronomical definition (~12h day at equator)
- **New York City**: timeanddate.com sunrise/sunset times
- **Arctic phenomena**: Established astronomical definitions of midnight sun and polar night

## Test Architecture

The test suite uses Playwright to:
1. Start the local development server (`python3 serve.py`)
2. Load the application in a headless Chromium browser
3. Set location, date, and time programmatically
4. Read displayed values from the DOM
5. Assert against expected reference values

Tests deliberately use the actual browser DOM rather than unit testing the calculation functions directly, ensuring the full stack (SunCalc integration → UI rendering) works correctly.

## Future Test Expansion

The current tests are intentionally minimal "smoke tests" covering the most critical correctness claims. Future test additions could include:

- **E2E flows**: User workflows (location search, time slider, animation controls)
- **Visual regression**: Screenshot comparisons for sun path rendering
- **Performance**: Calculation and rendering benchmarks
- **Cross-browser**: Firefox, Safari, mobile browsers
- **Accessibility**: Screen reader and keyboard navigation tests

See `docs/architecture.md` section 7 for the full intended test strategy.
