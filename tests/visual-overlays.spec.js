import { expect, test } from '@playwright/test';

const mapTilePattern = 'https://server.arcgisonline.com/**';
const nominatimPattern = 'https://nominatim.openstreetmap.org/**';
const overlayCanvas = '#sun-path-canvas';
const timelineCanvas = '#timeline-canvas';

const summerSolsticeNoon = '2024-06-21T16:00:00.000Z';
const springEquinoxNoon = '2024-03-20T12:00:00.000Z';
const summerSolsticeMidnight = '2024-06-21T00:00:00.000Z';

async function installNetworkMocks(page) {
  await page.route(mapTilePattern, route => route.fulfill({ status: 204 }));
  await page.route(nominatimPattern, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Test City' } })
  }));
}

async function loadApp(page) {
  await installNetworkMocks(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof map !== 'undefined' && map !== null && typeof datePicker !== 'undefined');
  await expect(page.locator('#loading')).toBeHidden();
  await page.addStyleTag({
    content: `
      #map, #map-container, .leaflet-container {
        background-color: #101827 !important;
      }
      #map .leaflet-tile {
        visibility: hidden !important;
      }
      #map .leaflet-control-container,
      #map .leaflet-control-attribution {
        display: none !important;
      }
    `
  });
}

async function setScene(page, instant, latitude = 40.7128, longitude = -74.006) {
  await page.evaluate(({ instant, latitude, longitude }) => {
    currentLat = latitude;
    currentLon = longitude;
    currentDate = new Date(instant);
    updateAll();
  }, { instant, latitude, longitude });
  await page.waitForTimeout(75);
}

async function expectOverlayScreenshot(page, name) {
  await expect(page.locator(overlayCanvas)).toHaveScreenshot(name, {
    animations: 'disabled',
    scale: 'css'
  });
}

async function canvasScreenshot(page, selector) {
  return page.locator(selector).screenshot({ animations: 'disabled', scale: 'css' });
}

async function readOverlayState(page) {
  return page.evaluate(() => {
    const center = {
      x: sunPathCanvas.width / 2,
      y: sunPathCanvas.height / 2
    };
    const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
    const position = SunCalc.getPosition(currentDate, currentLat, currentLon);
    const context = sunPathCanvas.getContext('2d');
    const pixels = context.getImageData(0, 0, sunPathCanvas.width, sunPathCanvas.height).data;
    const pixelCounts = { sunrise: 0, sunset: 0, marker: 0 };
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      const x = (index / 4) % sunPathCanvas.width;
      const y = Math.floor((index / 4) / sunPathCanvas.width);
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance < 30 || distance > 160) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red > 180 && green > 70 && green < 190 && blue < 80) pixelCounts.sunrise += 1;
      if (red > 140 && green >= 25 && green < 110 && blue < 80) pixelCounts.sunset += 1;
      if (red > 220 && green > 170 && blue < 120) pixelCounts.marker += 1;
    }
    return {
      center,
      pixelCounts,
      north: compassPoint(0, center, 150),
      east: compassPoint(90, center, 150),
      south: compassPoint(180, center, 150),
      west: compassPoint(270, center, 150),
      sunriseBearing: getSunEventBearing(times.sunrise, currentLat, currentLon),
      sunsetBearing: getSunEventBearing(times.sunset, currentLat, currentLon),
      sunrisePoint: compassPoint(getSunEventBearing(times.sunrise, currentLat, currentLon), center, 150),
      sunsetPoint: compassPoint(getSunEventBearing(times.sunset, currentLat, currentLon), center, 150),
      currentBearing: toCompassBearing(position),
      markerVisible: isSunMarkerVisible(position),
      timeline: getTimelineDaylight(times, currentDate, currentLat, currentLon),
      canvas: { width: sunPathCanvas.width, height: sunPathCanvas.height }
    };
  });
}

test.use({ timezoneId: 'UTC', viewport: { width: 1280, height: 720 } });

test.describe('Solar overlay visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('keeps the compass oriented with north at the top', async ({ page }) => {
    await setScene(page, summerSolsticeMidnight);
    await expectOverlayScreenshot(page, 'compass-orientation.png');
  });

  test('renders all cardinal and intercardinal labels', async ({ page }) => {
    await setScene(page, summerSolsticeMidnight);
    await expectOverlayScreenshot(page, 'cardinal-labels.png');
  });

  test('shows sunrise and sunset bearings in their seasonal positions', async ({ page }) => {
    await setScene(page, springEquinoxNoon);
    await expectOverlayScreenshot(page, 'sunrise-sunset-bearings.png');
  });

  test('keeps the compass north-up and maps equinox events east and west', async ({ page }) => {
    await setScene(page, springEquinoxNoon, 0, -78.5);
    const state = await readOverlayState(page);

    expect(state.north.x).toBeCloseTo(state.center.x, 5);
    expect(state.north.y).toBeCloseTo(state.center.y - 150, 5);
    expect(state.east.x).toBeCloseTo(state.center.x + 150, 5);
    expect(state.east.y).toBeCloseTo(state.center.y, 5);
    expect(state.south.x).toBeCloseTo(state.center.x, 5);
    expect(state.south.y).toBeCloseTo(state.center.y + 150, 5);
    expect(state.west.x).toBeCloseTo(state.center.x - 150, 5);
    expect(state.west.y).toBeCloseTo(state.center.y, 5);

    expect(state.sunriseBearing).toBeGreaterThan(80);
    expect(state.sunriseBearing).toBeLessThan(100);
    expect(state.sunsetBearing).toBeGreaterThan(260);
    expect(state.sunsetBearing).toBeLessThan(280);
    expect(state.pixelCounts.sunrise).toBeGreaterThan(0);
    expect(state.pixelCounts.sunset).toBeGreaterThan(0);
    expect(state.sunrisePoint.x).toBeGreaterThan(state.center.x + 140);
    expect(Math.abs(state.sunrisePoint.y - state.center.y)).toBeLessThan(1);
    expect(state.sunsetPoint.x).toBeLessThan(state.center.x - 140);
    expect(Math.abs(state.sunsetPoint.y - state.center.y)).toBeLessThan(1);
    expect(state.markerVisible).toBe(true);
  });

  test('omits polar-day event rays while keeping the sun marker visible', async ({ page }) => {
    await setScene(page, '2024-06-21T00:00:00.000Z', 69.6492, 18.9553);
    const state = await readOverlayState(page);

    expect(state.sunriseBearing).toBeNull();
    expect(state.sunsetBearing).toBeNull();
    expect(state.pixelCounts.sunrise).toBe(0);
    expect(state.pixelCounts.sunset).toBe(0);
    expect(state.pixelCounts.marker).toBeGreaterThan(0);
    expect(state.markerVisible).toBe(true);
    expect(state.timeline.polarDay).toBe(true);
    expect(state.timeline.polarNight).toBe(false);
    await expect(page.locator('#info-sunrise')).toHaveText('No sunrise');
    await expect(page.locator('#info-sunset')).toHaveText('No sunset');
  });

  test('omits polar-night event rays and the sun marker', async ({ page }) => {
    await setScene(page, '2024-12-21T12:00:00.000Z', 69.6492, 18.9553);
    const state = await readOverlayState(page);

    expect(state.sunriseBearing).toBeNull();
    expect(state.sunsetBearing).toBeNull();
    expect(state.pixelCounts.sunrise).toBe(0);
    expect(state.pixelCounts.sunset).toBe(0);
    expect(state.pixelCounts.marker).toBe(0);
    expect(state.markerVisible).toBe(false);
    expect(state.timeline.polarDay).toBe(false);
    expect(state.timeline.polarNight).toBe(true);
    await expect(page.locator('#info-sunrise')).toHaveText('No sunrise');
    await expect(page.locator('#info-sunset')).toHaveText('No sunset');
  });

  test('uses the documented horizon threshold for marker visibility', async ({ page }) => {
    const visibility = await page.evaluate(() => ({
      below: isSunMarkerVisible({ azimuth: 0, altitude: -0.11 * Math.PI / 180 }),
      atThreshold: isSunMarkerVisible({ azimuth: 0, altitude: -0.1 * Math.PI / 180 }),
      above: isSunMarkerVisible({ azimuth: 0, altitude: -0.09 * Math.PI / 180 })
    }));

    expect(visibility).toEqual({ below: false, atThreshold: false, above: true });
  });

  test('shows the glowing current-sun marker and bearing', async ({ page }) => {
    await setScene(page, summerSolsticeNoon);
    await expectOverlayScreenshot(page, 'current-sun-marker.png');
  });

  test('keeps the daily sun-path overlay visible as time advances', async ({ page }) => {
    await setScene(page, '2024-06-21T10:00:00.000Z');
    const morning = await canvasScreenshot(page, overlayCanvas);

    await setScene(page, summerSolsticeNoon);
    const noon = await canvasScreenshot(page, overlayCanvas);
    expect(Buffer.compare(morning, noon)).not.toBe(0);

    await setScene(page, '2024-06-21T22:00:00.000Z');
    const evening = await canvasScreenshot(page, overlayCanvas);
    expect(Buffer.compare(noon, evening)).not.toBe(0);
    await expectOverlayScreenshot(page, 'sun-path-arc.png');
  });

  test('redraws the overlay when the map is repositioned', async ({ page }) => {
    await setScene(page, summerSolsticeNoon);
    const before = await canvasScreenshot(page, overlayCanvas);
    const dimensionsBefore = await readOverlayState(page);

    await page.evaluate(() => map.setView([0, 0], 12, { animate: false }));
    await expect.poll(() => page.evaluate(() => [
      Number(currentLat.toFixed(3)),
      Number(currentLon.toFixed(3))
    ])).toEqual([0, 0]);

    const after = await canvasScreenshot(page, overlayCanvas);
    expect(Buffer.compare(before, after)).not.toBe(0);
    await expectOverlayScreenshot(page, 'map-repositioned.png');

    await page.setViewportSize({ width: 1100, height: 700 });
    await expect.poll(async () => (await readOverlayState(page)).canvas).not.toEqual(dimensionsBefore.canvas);
  });

  test('renders the color-coded day, twilight, and night timeline', async ({ page }) => {
    await setScene(page, springEquinoxNoon);
    const colors = await page.locator(timelineCanvas).evaluate((canvas) => {
      const context = canvas.getContext('2d');
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const unique = new Set();
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0) continue;
        unique.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      return [...unique];
    });

    expect(colors).toEqual(expect.arrayContaining(['26,26,62', '135,206,235']));
    await expect(page.locator(timelineCanvas)).toHaveScreenshot('color-coded-timeline.png', {
      animations: 'disabled',
      scale: 'css'
    });
  });
});
