import { expect, test } from '@playwright/test';

const nominatimPattern = 'https://nominatim.openstreetmap.org/**';
const mapTilePattern = 'https://server.arcgisonline.com/**';

async function installNetworkMocks(page) {
  await page.route(nominatimPattern, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Test City' } })
  }));
  await page.route(mapTilePattern, route => route.fulfill({ status: 204 }));
}

async function loadApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof map !== 'undefined' && map !== null && typeof datePicker !== 'undefined');
  await expect(page.locator('#loading')).toBeHidden();
}

async function setAppDate(page, instant) {
  await page.evaluate((value) => {
    currentDate = new Date(value);
    updateAll();
  }, instant);
}

async function appDate(page) {
  return page.evaluate(() => ({
    value: document.querySelector('#date-picker').value,
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    day: currentDate.getDate(),
    hour: currentDate.getHours(),
    minute: currentDate.getMinutes(),
    instant: currentDate.toISOString(),
    isPlaying
  }));
}

async function expectAppTime(page, expectedMinutes, tolerance = 1) {
  await expect.poll(() => page.evaluate((expected) => {
    const actual = currentDate.getHours() * 60 + currentDate.getMinutes();
    return Math.abs(actual - expected);
  }, expectedMinutes)).toBeLessThanOrEqual(tolerance);
}

async function installAnimationClock(page) {
  await page.evaluate(() => {
    const callbacks = new Map();
    let nextId = 1;

    window.requestAnimationFrame = callback => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => {
      callbacks.delete(id);
    };
    window.__animationClock = {
      step(timestamp) {
        const entry = [...callbacks.entries()].find(([, callback]) => callback === animate);
        if (!entry) return false;
        const [id, callback] = entry;
        callbacks.delete(id);
        callback(timestamp);
        return true;
      },
      pending() {
        return [...callbacks.values()].filter(callback => callback === animate).length;
      }
    };
  });
}

async function stepAnimationFrame(page, timestamp) {
  const stepped = await page.evaluate(value => window.__animationClock.step(value), timestamp);
  expect(stepped).toBe(true);
}

async function pendingAnimationFrames(page) {
  return page.evaluate(() => window.__animationClock.pending());
}

async function expectSunDisplaySynchronized(page) {
  const state = await page.evaluate(() => {
    const position = SunCalc.getPosition(currentDate, currentLat, currentLon);
    const bearing = toCompassBearing(position);
    const altitude = position.altitude * 180 / Math.PI;
    const center = {
      x: sunPathCanvas.width / 2,
      y: sunPathCanvas.height / 2
    };
    const markerPoint = compassPoint(bearing, center, 150 * 0.95);
    const x = Math.round(markerPoint.x);
    const y = Math.round(markerPoint.y);
    const context = sunPathCanvas.getContext('2d');
    const pixel = context.getImageData(x, y, 1, 1).data;

    return {
      actualAzimuth: document.querySelector('#info-azimuth').textContent,
      expectedAzimuth: `${bearing.toFixed(1)}°`,
      actualAltitude: document.querySelector('#info-altitude').textContent,
      expectedAltitude: `${altitude.toFixed(1)}°`,
      header: document.querySelector('#current-time-display').textContent,
      expectedTime: formatTime(currentDate),
      markerVisible: isSunMarkerVisible(position),
      markerPixel: Array.from(pixel)
    };
  });

  expect(state.actualAzimuth).toBe(state.expectedAzimuth);
  expect(state.actualAltitude).toBe(state.expectedAltitude);
  expect(state.header).toContain(state.expectedTime);
  if (state.markerVisible) {
    expect(state.markerPixel[0]).toBeGreaterThan(220);
    expect(state.markerPixel[1]).toBeGreaterThan(170);
    expect(state.markerPixel[2]).toBeLessThan(120);
    expect(state.markerPixel[3]).toBeGreaterThan(0);
  }
}

test.describe('Documented user workflows', () => {
  test.use({ timezoneId: 'UTC' });

  test.beforeEach(async ({ page }) => {
    await installNetworkMocks(page);
    await loadApp(page);
  });

  test('renders the complete Esri World Imagery attribution', async ({ page }) => {
    await expect(page.locator('.leaflet-control-attribution')).toContainText(
      'Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community'
    );
  });

  test('selects a location by dragging the map', async ({ page }) => {
    const before = await appDate(page);
    const map = page.locator('#map');
    const box = await map.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator('.location-coords')).not.toHaveText('40.7128°N, 74.0060°W');
    await expect.poll(() => page.evaluate(() => [currentLat, currentLon])).not.toEqual([
      40.7128,
      -74.006
    ]);
    expect(before.value).toBe(await page.inputValue('#date-picker'));
  });

  test('navigates dates with every date button', async ({ page }) => {
    const cases = [
      ['#btn-prev-day', '2024-03-15T12:00:00.000Z', '2024-03-14'],
      ['#btn-next-day', '2024-03-15T12:00:00.000Z', '2024-03-16'],
      ['#btn-prev-week', '2024-03-15T12:00:00.000Z', '2024-03-08'],
      ['#btn-next-week', '2024-03-15T12:00:00.000Z', '2024-03-22'],
      ['#btn-prev-month', '2024-03-31T12:00:00.000Z', '2024-02-29'],
      ['#btn-next-month', '2024-01-31T12:00:00.000Z', '2024-02-29']
    ];

    for (const [selector, start, expected] of cases) {
      await setAppDate(page, start);
      await page.locator(selector).click();
      await expect(page.locator('#date-picker')).toHaveValue(expected);
    }

    await setAppDate(page, '2000-01-01T12:00:00.000Z');
    const today = await page.evaluate(() => {
      const date = new Date();
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');
    });
    await page.locator('#btn-today').click();
    await expect(page.locator('#date-picker')).toHaveValue(today);
  });

  test('supports the documented keyboard navigation shortcuts', async ({ page }) => {
    const cases = [
      ['ArrowUp', '2024-01-16'],
      ['ArrowDown', '2024-01-14'],
      ['ArrowRight', '2024-02-15'],
      ['ArrowLeft', '2023-12-15'],
      ['Shift+ArrowRight', '2024-01-22'],
      ['Shift+ArrowLeft', '2024-01-08']
    ];

    await page.evaluate(() => document.activeElement?.blur());
    for (const [key, expected] of cases) {
      await setAppDate(page, '2024-01-15T12:00:00.000Z');
      await page.keyboard.press(key);
      await expect(page.locator('#date-picker')).toHaveValue(expected);
    }

    const today = await page.evaluate(() => {
      const date = new Date();
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');
    });
    await setAppDate(page, '2000-01-01T12:00:00.000Z');
    await page.keyboard.press('t');
    await expect(page.locator('#date-picker')).toHaveValue(today);
  });

  test('applies every seasonal date preset', async ({ page }) => {
    const presets = [
      ['summer-solstice', '2024-06-21'],
      ['winter-solstice', '2024-12-21'],
      ['spring-equinox', '2024-03-20'],
      ['fall-equinox', '2024-09-22']
    ];
    const dayLengths = [];

    for (const [preset, expected] of presets) {
      await setAppDate(page, '2024-01-01T08:00:00.000Z');
      await page.locator(`[data-date="${preset}"]`).click();
      await expect(page.locator('#date-picker')).toHaveValue(expected);
      const state = await appDate(page);
      expect(state.hour).toBe(12);
      expect(state.minute).toBe(0);
      dayLengths.push(await page.locator('#info-daylength').textContent());
    }

    expect(dayLengths[0]).not.toBe(dayLengths[1]);
    expect(dayLengths[2]).toBe(dayLengths[3]);
  });

  test('scrubs time by clicking and dragging the timeline', async ({ page }) => {
    await installAnimationClock(page);
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const timeline = page.locator('#timeline-canvas');
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();

    await page.locator('#btn-play-pause').click();
    await stepAnimationFrame(page, 1000);
    await stepAnimationFrame(page, 1100);
    expect((await appDate(page)).isPlaying).toBe(true);

    await timeline.click({ position: { x: box.width * 0.25, y: box.height / 2 } });
    await expectAppTime(page, 6 * 60);
    expect((await appDate(page)).isPlaying).toBe(false);
    await expect(page.locator('.play-label')).toHaveText('Play');
    await expectSunDisplaySynchronized(page);

    await timeline.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
    await expectAppTime(page, 18 * 60);
    await expectSunDisplaySynchronized(page);

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await expectAppTime(page, 19 * 60 + 12, 2);
    const released = await appDate(page);
    expect(released.isPlaying).toBe(false);
    await expectSunDisplaySynchronized(page);

    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
    await page.waitForTimeout(50);
    expect((await appDate(page)).instant).toBe(released.instant);
  });

  test('scrubs the timeline with touch events', async ({ page }) => {
    await installAnimationClock(page);
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const timeline = page.locator('#timeline-canvas');
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();

    await page.locator('#btn-play-pause').click();
    await stepAnimationFrame(page, 1000);
    await stepAnimationFrame(page, 1100);
    expect((await appDate(page)).isPlaying).toBe(true);

    const client = await page.context().newCDPSession(page);
    const start = { x: box.x + box.width * 0.25, y: box.y + box.height / 2 };
    const end = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: start.x, y: start.y }]
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: end.x, y: end.y }]
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
    } finally {
      await client.detach();
    }

    await expectAppTime(page, 18 * 60);
    const released = await appDate(page);
    expect(released.value).toBe('2024-06-21');
    expect(released.isPlaying).toBe(false);
    await expect(page.locator('.play-label')).toHaveText('Play');
    await expectSunDisplaySynchronized(page);

    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
    await page.waitForTimeout(50);
    expect((await appDate(page)).instant).toBe(released.instant);
  });

  test('applies every documented animation speed preset', async ({ page }) => {
    await installAnimationClock(page);
    const cases = [
      ['1x', 100],
      ['30x', 180000],
      ['60x', 360000],
      ['2min', 720000]
    ];
    const playButton = page.locator('#btn-play-pause');

    for (const [speed, expectedDelta] of cases) {
      await setAppDate(page, '2024-06-21T12:00:00.000Z');
      const speedButton = page.locator(`.speed-btn[data-speed="${speed}"]`);
      await speedButton.click();
      await expect(speedButton).toHaveClass(/active/);
      await expect(page.locator('.speed-btn.active')).toHaveCount(1);
      expect(await page.evaluate(() => currentSpeedId)).toBe(speed);

      const start = await page.evaluate(() => currentDate.getTime());
      await playButton.click();
      expect(await pendingAnimationFrames(page)).toBe(1);
      await stepAnimationFrame(page, 1000);
      expect(await page.evaluate(() => currentDate.getTime())).toBe(start);
      await stepAnimationFrame(page, 1100);
      expect(await page.evaluate(() => currentDate.getTime())).toBe(start + expectedDelta);

      await playButton.click();
      expect(await pendingAnimationFrames(page)).toBe(0);
      expect((await appDate(page)).isPlaying).toBe(false);
    }
  });

  test('pauses and resumes without losing the current instant', async ({ page }) => {
    await installAnimationClock(page);
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    await page.locator('.speed-btn[data-speed="60x"]').click();
    const button = page.locator('#btn-play-pause');

    await button.click();
    await expect(button).toHaveClass(/playing/);
    await expect(page.locator('.play-label')).toHaveText('Pause');
    await stepAnimationFrame(page, 1000);
    await stepAnimationFrame(page, 1100);
    const advanced = await page.evaluate(() => currentDate.getTime());

    await button.click();
    const paused = await appDate(page);
    expect(paused.isPlaying).toBe(false);
    expect(paused.instant).toBe(new Date(advanced).toISOString());
    expect(await pendingAnimationFrames(page)).toBe(0);
    await page.waitForTimeout(50);
    expect((await appDate(page)).instant).toBe(paused.instant);

    await button.click();
    expect((await appDate(page)).instant).toBe(paused.instant);
    expect(await pendingAnimationFrames(page)).toBe(1);
    await stepAnimationFrame(page, 2000);
    expect((await appDate(page)).instant).toBe(paused.instant);
    await stepAnimationFrame(page, 2100);
    expect(await page.evaluate(() => currentDate.getTime())).toBe(advanced + 360000);
    await expectSunDisplaySynchronized(page);

    await button.click();
    await expect(button).not.toHaveClass(/playing/);
    await expect(page.locator('.play-label')).toHaveText('Play');
    expect(await pendingAnimationFrames(page)).toBe(0);
  });

  test('keeps the displayed sun position synchronized during playback and scrubbing', async ({ page }) => {
    await installAnimationClock(page);
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    await expectSunDisplaySynchronized(page);

    await page.locator('#btn-play-pause').click();
    await stepAnimationFrame(page, 1000);
    await stepAnimationFrame(page, 1100);
    await expectSunDisplaySynchronized(page);

    await page.locator('#btn-play-pause').click();
    const timeline = page.locator('#timeline-canvas');
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();
    await timeline.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
    await expectAppTime(page, 18 * 60);
    await expectSunDisplaySynchronized(page);
  });

  test('rolls animation playback across midnight into the next day', async ({ page }) => {
    await installAnimationClock(page);
    await setAppDate(page, '2024-06-21T23:59:30.000Z');
    await page.locator('.speed-btn[data-speed="60x"]').click();
    const button = page.locator('#btn-play-pause');

    await button.click();
    await stepAnimationFrame(page, 0);
    await stepAnimationFrame(page, 100);
    const rollover = await appDate(page);
    expect(rollover.instant).toBe('2024-06-22T00:05:30.000Z');
    expect(rollover.value).toBe('2024-06-22');
    expect(rollover.hour).toBe(0);
    expect(rollover.minute).toBe(5);
    expect(rollover.isPlaying).toBe(true);
    await expect(page.locator('#current-time-display')).toContainText('Jun 22, 2024');
    await expectSunDisplaySynchronized(page);

    await button.click();
    await expect(page.locator('.play-label')).toHaveText('Play');
    expect(await pendingAnimationFrames(page)).toBe(0);
  });
});
