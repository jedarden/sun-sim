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

    await page.evaluate(() => map.setView([0, 0], 12, { animate: false }));
    await expect.poll(() => page.evaluate(() => [
      Number(currentLat.toFixed(3)),
      Number(currentLon.toFixed(3))
    ])).toEqual([0, 0]);

    const after = await canvasScreenshot(page, overlayCanvas);
    expect(Buffer.compare(before, after)).not.toBe(0);
    await expectOverlayScreenshot(page, 'map-repositioned.png');
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
