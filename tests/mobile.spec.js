import { expect, test } from '@playwright/test';

const FIXED_DATE = '2024-06-21T16:00:00.000Z';
const mapTilePattern = 'https://server.arcgisonline.com/**';
const nominatimPattern = 'https://nominatim.openstreetmap.org/**';
const mobileViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 }
];

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
  await setScene(page, FIXED_DATE);
}

async function setScene(page, instant, latitude = 40.7128, longitude = -74.006) {
  await page.evaluate(({ instant, latitude, longitude }) => {
    pauseAnimation();
    currentDate = new Date(instant);
    currentLat = latitude;
    currentLon = longitude;
    map.setView([latitude, longitude], map.getZoom(), { animate: false });
    updateAll();
  }, { instant, latitude, longitude });
  await expect.poll(() => page.evaluate(() => currentDate.toISOString())).toBe(instant);
}

async function readMapState(page) {
  return page.evaluate(() => {
    const center = map.getCenter();
    return {
      latitude: center.lat,
      longitude: center.lng,
      zoom: map.getZoom(),
      appLatitude: currentLat,
      appLongitude: currentLon
    };
  });
}

async function dispatchTouch(client, type, touchPoints) {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints });
}

async function dragOneFinger(page, start, end, steps = 8) {
  const client = await page.context().newCDPSession(page);
  try {
    await dispatchTouch(client, 'touchStart', [start]);
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      await dispatchTouch(client, 'touchMove', [{
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
      }]);
    }
    await dispatchTouch(client, 'touchEnd', []);
  } finally {
    await client.detach();
  }
}

async function pinchMap(page, box) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const startGap = 40;
  const endGap = 150;
  const client = await page.context().newCDPSession(page);
  try {
    await dispatchTouch(client, 'touchStart', [
      { x: centerX - startGap / 2, y: centerY },
      { x: centerX + startGap / 2, y: centerY }
    ]);
    for (let step = 1; step <= 8; step += 1) {
      const gap = startGap + (endGap - startGap) * step / 8;
      await dispatchTouch(client, 'touchMove', [
        { x: centerX - gap / 2, y: centerY },
        { x: centerX + gap / 2, y: centerY }
      ]);
    }
    await dispatchTouch(client, 'touchEnd', []);
  } finally {
    await client.detach();
  }
}

async function readCanvasState(page) {
  return page.evaluate(() => {
    const countOpaquePixels = canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) opaque += 1;
      }
      return opaque;
    };

    const timelinePixels = timelineCanvas.getContext('2d')
      .getImageData(0, 0, timelineCanvas.width, timelineCanvas.height).data;
    const timelineColors = new Set();
    for (let index = 0; index < timelinePixels.length; index += 4) {
      if (timelinePixels[index + 3] > 0) {
        timelineColors.add(`${timelinePixels[index]},${timelinePixels[index + 1]},${timelinePixels[index + 2]}`);
      }
    }

    const mapRect = document.querySelector('#map-container').getBoundingClientRect();
    const panelRect = document.querySelector('#control-panel').getBoundingClientRect();
    const timelineRect = timelineCanvas.getBoundingClientRect();
    return {
      opaqueSunPathPixels: countOpaquePixels(sunPathCanvas),
      timelineColors: [...timelineColors],
      sunPathWidth: sunPathCanvas.width,
      sunPathHeight: sunPathCanvas.height,
      mapClientWidth: document.querySelector('#map-container').clientWidth,
      mapClientHeight: document.querySelector('#map-container').clientHeight,
      sunPathCssWidth: sunPathCanvas.getBoundingClientRect().width,
      sunPathCssHeight: sunPathCanvas.getBoundingClientRect().height,
      timelineWidth: timelineCanvas.width,
      timelineHeight: timelineCanvas.height,
      timelineCssWidth: timelineRect.width,
      timelineCssHeight: timelineRect.height,
      panelContentWidth: panelRect.width - parseFloat(getComputedStyle(document.querySelector('#control-panel')).paddingLeft) * 2,
      mapWidth: mapRect.width,
      mapHeight: mapRect.height
    };
  });
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  timezoneId: 'UTC'
});

test.describe('Mobile layout and touch interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('stacks the map and scrolling controls without horizontal overflow', async ({ page }) => {
    for (const viewport of mobileViewports) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => document.documentElement.clientWidth)).toBe(viewport.width);
      const layout = await page.evaluate(() => {
        const main = document.querySelector('#main-content');
        const mapContainer = document.querySelector('#map-container');
        const controlPanel = document.querySelector('#control-panel');
        const timeline = document.querySelector('#timeline-canvas');
        const mainRect = main.getBoundingClientRect();
        const mapRect = mapContainer.getBoundingClientRect();
        const panelRect = controlPanel.getBoundingClientRect();
        const timelineRect = timeline.getBoundingClientRect();
        return {
          flexDirection: getComputedStyle(main).flexDirection,
          mainWidth: mainRect.width,
          mainHeight: mainRect.height,
          mapWidth: mapRect.width,
          mapHeight: mapRect.height,
          mapBottom: mapRect.bottom,
          panelWidth: panelRect.width,
          panelHeight: panelRect.height,
          panelTop: panelRect.top,
          panelClientHeight: controlPanel.clientHeight,
          panelScrollHeight: controlPanel.scrollHeight,
          timelineWidth: timelineRect.width,
          timelineHeight: timelineRect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth
        };
      });

      expect(layout.flexDirection).toBe('column');
      expect(layout.mainWidth).toBeCloseTo(viewport.width, 0);
      expect(layout.mapWidth).toBeCloseTo(viewport.width, 0);
      expect(layout.panelWidth).toBeCloseTo(viewport.width, 0);
      expect(layout.mapBottom).toBeCloseTo(layout.panelTop, 0);
      expect(layout.mapHeight).toBeGreaterThan(0);
      expect(layout.panelHeight).toBeLessThanOrEqual(viewport.height * 0.45 + 1);
      expect(layout.panelScrollHeight).toBeGreaterThan(layout.panelClientHeight);
      expect(layout.timelineWidth).toBeGreaterThan(0);
      expect(layout.timelineHeight).toBeGreaterThanOrEqual(44);
      expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width);
    }
  });

  test('provides 44px touch targets for mobile controls', async ({ page }) => {
    const targetSelectors = [
      '.github-link',
      '#btn-use-gps',
      '#date-picker',
      '.nav-btn',
      '.shortcut-btn',
      '#btn-play-pause',
      '.speed-btn',
      '#timeline-canvas',
      '.leaflet-control-zoom-in',
      '.leaflet-control-zoom-out'
    ];

    for (const selector of targetSelectors) {
      const targets = page.locator(selector);
      const count = await targets.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const target = targets.nth(index);
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeVisible();
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('operates date, animation, picker, and location controls by touch', async ({ page, context }) => {
    await setScene(page, '2024-03-15T12:00:00.000Z');
    await page.locator('#btn-next-day').tap();
    await expect(page.locator('#date-picker')).toHaveValue('2024-03-16');

    await page.locator('[data-date="summer-solstice"]').tap();
    await expect(page.locator('#date-picker')).toHaveValue('2024-06-21');
    expect(await page.evaluate(() => currentDate.getHours())).toBe(12);

    const speedButton = page.locator('.speed-btn[data-speed="2min"]');
    await speedButton.tap();
    await expect(speedButton).toHaveClass(/active/);
    expect(await page.evaluate(() => currentSpeedId)).toBe('2min');

    const playButton = page.locator('#btn-play-pause');
    await playButton.tap();
    await expect(playButton).toHaveClass(/playing/);
    await playButton.tap();
    await expect(playButton).not.toHaveClass(/playing/);
    await expect(page.locator('.play-label')).toHaveText('Play');

    await context.grantPermissions(['geolocation'], { origin: new URL(page.url()).origin });
    await context.setGeolocation({ latitude: 34.0522, longitude: -118.2437 });
    await page.locator('#btn-use-gps').tap();
    await expect.poll(() => page.evaluate(() => [Number(currentLat.toFixed(4)), Number(currentLon.toFixed(4))]))
      .toEqual([34.0522, -118.2437]);
    await expect(page.locator('.location-coords')).toHaveText('34.0522°N, 118.2437°W');

    await page.locator('#date-picker').tap();
    await expect(page.locator('.flatpickr-calendar.open')).toBeVisible();
    for (const selector of ['.flatpickr-prev-month', '.flatpickr-next-month']) {
      const box = await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('pans the map with one finger and synchronizes location state', async ({ page }) => {
    const before = await readMapState(page);
    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox).not.toBeNull();
    const y = mapBox.y + mapBox.height * 0.5;

    await dragOneFinger(
      page,
      { x: mapBox.x + mapBox.width * 0.8, y },
      { x: mapBox.x + mapBox.width * 0.2, y }
    );

    await expect.poll(() => page.evaluate(() => {
      const center = map.getCenter();
      const moved = Math.abs(center.lat - 40.7128) + Math.abs(center.lng + 74.006) > 0.01;
      const synchronized = Math.abs(currentLat - center.lat) < 0.000001
        && Math.abs(currentLon - center.lng) < 0.000001;
      return moved && synchronized;
    })).toBe(true);
    const after = await readMapState(page);
    expect(after.zoom).toBe(before.zoom);
    expect(after.appLatitude).toBeCloseTo(after.latitude, 6);
    expect(after.appLongitude).toBeCloseTo(after.longitude, 6);
    await expect(page.locator('.location-coords')).not.toHaveText('40.7128°N, 74.0060°W');
  });

  test('pinch-zooms the map', async ({ page }) => {
    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox).not.toBeNull();
    const before = await readMapState(page);

    await pinchMap(page, mapBox);
    await expect.poll(() => page.evaluate(() => map.getZoom())).toBeGreaterThan(before.zoom);
    await expect.poll(() => page.evaluate(() => {
      const center = map.getCenter();
      return Math.abs(currentLat - center.lat) < 0.000001
        && Math.abs(currentLon - center.lng) < 0.000001;
    })).toBe(true);
    const after = await readMapState(page);
    expect(after.appLatitude).toBeCloseTo(after.latitude, 6);
    expect(after.appLongitude).toBeCloseTo(after.longitude, 6);
  });

  test('taps the map zoom controls', async ({ page }) => {
    const before = await readMapState(page);
    await page.locator('.leaflet-control-zoom-in').tap();
    await expect.poll(() => page.evaluate(() => map.getZoom())).toBe(before.zoom + 1);
    await page.waitForFunction(() => !map._animatingZoom);
    await page.locator('.leaflet-control-zoom-out').tap();
    await expect.poll(() => page.evaluate(() => map.getZoom())).toBe(before.zoom);
    await page.waitForFunction(() => !map._animatingZoom);
  });

  test('taps and drags the timeline with synchronized canvas rendering', async ({ page }) => {
    await setScene(page, '2024-06-21T12:00:00.000Z');
    const timeline = page.locator('#timeline-canvas');
    const playButton = page.locator('#btn-play-pause');
    await playButton.tap();
    await expect(playButton).toHaveClass(/playing/);
    await timeline.scrollIntoViewIfNeeded();
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();
    const before = await page.evaluate(() => ({
      timeline: timelineCanvas.toDataURL(),
      sunPath: sunPathCanvas.toDataURL()
    }));

    await timeline.tap({ position: { x: box.width * 0.25, y: box.height / 2 } });
    await expect.poll(() => page.evaluate(() => {
      const minutes = currentDate.getHours() * 60 + currentDate.getMinutes();
      return Math.abs(minutes - 6 * 60) <= 3;
    })).toBe(true);
    expect(await page.evaluate(() => isPlaying)).toBe(false);
    await expect(page.locator('.play-label')).toHaveText('Play');

    const start = { x: box.x + box.width * 0.25, y: box.y + box.height / 2 };
    const end = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };
    await dragOneFinger(page, start, end);
    await expect.poll(() => page.evaluate(() => {
      const minutes = currentDate.getHours() * 60 + currentDate.getMinutes();
      return Math.abs(minutes - 18 * 60) <= 3;
    })).toBe(true);

    const released = await page.evaluate(() => ({
      instant: currentDate.toISOString(),
      timeline: timelineCanvas.toDataURL(),
      sunPath: sunPathCanvas.toDataURL(),
      expectedAzimuth: `${toCompassBearing(SunCalc.getPosition(currentDate, currentLat, currentLon)).toFixed(1)}°`,
      expectedAltitude: `${(SunCalc.getPosition(currentDate, currentLat, currentLon).altitude * 180 / Math.PI).toFixed(1)}°`
    }));
    expect(released.timeline).not.toBe(before.timeline);
    expect(released.sunPath).not.toBe(before.sunPath);
    await expect(page.locator('#info-azimuth')).toHaveText(released.expectedAzimuth);
    await expect(page.locator('#info-altitude')).toHaveText(released.expectedAltitude);
    await page.waitForTimeout(75);
    expect(await page.evaluate(() => currentDate.toISOString())).toBe(released.instant);
  });

  test('renders functional mobile canvases after viewport resizing', async ({ page }) => {
    const dimensions = [];

    for (const viewport of mobileViewports) {
      await page.setViewportSize(viewport);
      await setScene(page, FIXED_DATE);
      await expect.poll(() => page.evaluate(() => {
        const container = document.querySelector('#map-container');
        const timelineRect = timelineCanvas.getBoundingClientRect();
        return sunPathCanvas.width === container.clientWidth
          && sunPathCanvas.height === container.clientHeight
          && timelineCanvas.width === Math.round(timelineRect.width)
          && timelineCanvas.height === Math.round(timelineRect.height);
      })).toBe(true);

      const canvasState = await readCanvasState(page);
      dimensions.push(canvasState);
      expect(canvasState.sunPathWidth).toBe(canvasState.mapClientWidth);
      expect(canvasState.sunPathHeight).toBe(canvasState.mapClientHeight);
      expect(canvasState.sunPathCssWidth).toBeCloseTo(canvasState.mapClientWidth, 0);
      expect(canvasState.sunPathCssHeight).toBeCloseTo(canvasState.mapClientHeight, 0);
      expect(canvasState.mapWidth).toBeGreaterThan(0);
      expect(canvasState.mapHeight).toBeGreaterThan(0);
      expect(canvasState.opaqueSunPathPixels).toBeGreaterThan(100);
      expect(canvasState.timelineWidth).toBeCloseTo(canvasState.timelineCssWidth, 0);
      expect(canvasState.timelineHeight).toBeCloseTo(canvasState.timelineCssHeight, 0);
      expect(canvasState.timelineCssWidth).toBeGreaterThanOrEqual(44);
      expect(canvasState.timelineCssWidth).toBeLessThanOrEqual(canvasState.panelContentWidth);
      expect(canvasState.timelineCssHeight).toBeGreaterThanOrEqual(44);
      expect(canvasState.timelineColors).toEqual(expect.arrayContaining(['26,26,62', '135,206,235']));
    }

    expect(dimensions.map(state => state.sunPathWidth)).toEqual(mobileViewports.map(viewport => viewport.width));
    expect(new Set(dimensions.map(state => `${state.sunPathWidth}x${state.sunPathHeight}`)).size).toBe(mobileViewports.length);
  });
});

test.describe('Mobile timeline with a distant browser timezone', () => {
  test.use({ timezoneId: 'Pacific/Auckland' });

  test('renders daylight on both sides of browser midnight', async ({ page }) => {
    await loadApp(page);
    const state = await page.evaluate(() => {
      currentLat = 51.5074;
      currentLon = -0.1278;
      currentDate = new Date(2024, 5, 21, 12);
      updateAll();
      const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
      const daylight = getTimelineDaylight(times, currentDate, currentLat, currentLon);
      const context = timelineCanvas.getContext('2d');
      const pixelAt = x => Array.from(context.getImageData(x, 10, 1, 1).data);
      return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        daylight,
        early: pixelAt(1),
        middle: pixelAt(Math.floor(timelineCanvas.width / 2)),
        late: pixelAt(timelineCanvas.width - 2)
      };
    });

    expect(state.timezone).toBe('Pacific/Auckland');
    expect(state.daylight.wrapsMidnight).toBe(true);
    expect(state.daylight.sunrise).toBeGreaterThan(state.daylight.sunset);
    expect(state.early).toEqual([135, 206, 235, 255]);
    expect(state.middle).toEqual([26, 26, 62, 255]);
    expect(state.late).toEqual([135, 206, 235, 255]);
  });
});
