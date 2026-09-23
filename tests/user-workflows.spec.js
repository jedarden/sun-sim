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

test.describe('Documented user workflows', () => {
  test.use({ timezoneId: 'UTC' });

  test.beforeEach(async ({ page }) => {
    await installNetworkMocks(page);
    await loadApp(page);
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
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const timeline = page.locator('#timeline-canvas');
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();

    await timeline.click({ position: { x: box.width * 0.25, y: box.height / 2 } });
    await expectAppTime(page, 6 * 60);

    await timeline.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
    await expectAppTime(page, 18 * 60);

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await expectAppTime(page, 19 * 60 + 12, 2);
  });

  test('scrubs the timeline with touch events', async ({ page }) => {
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const timeline = page.locator('#timeline-canvas');
    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();

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
    expect((await appDate(page)).value).toBe('2024-06-21');
  });

  test('selects every animation speed preset', async ({ page }) => {
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const initial = (await appDate(page)).instant;

    for (const speed of ['1x', '30x', '60x', '2min']) {
      const button = page.locator(`.speed-btn[data-speed="${speed}"]`);
      await button.click();
      await expect(button).toHaveClass(/active/);
      await expect(page.locator('.speed-btn.active')).toHaveCount(1);
      expect(await page.evaluate(() => currentSpeedId)).toBe(speed);
    }

    expect((await appDate(page)).instant).toBe(initial);
  });

  test('plays and pauses while preserving the current time', async ({ page }) => {
    await setAppDate(page, '2024-06-21T12:00:00.000Z');
    const start = (await appDate(page)).instant;
    const button = page.locator('#btn-play-pause');

    await button.click();
    await expect(button).toHaveClass(/playing/);
    await expect(page.locator('.play-label')).toHaveText('Pause');
    await page.waitForFunction((initial) => currentDate.toISOString() !== initial, start);

    await button.click();
    await expect(button).not.toHaveClass(/playing/);
    await expect(page.locator('.play-label')).toHaveText('Play');
    const paused = (await appDate(page)).instant;
    await page.waitForTimeout(150);
    expect((await appDate(page)).instant).toBe(paused);
  });

  test('rolls animation playback across midnight into the next day', async ({ page }) => {
    await setAppDate(page, '2024-06-21T23:59:00.000Z');
    await page.locator('.speed-btn[data-speed="2min"]').click();
    const button = page.locator('#btn-play-pause');

    await button.click();
    await page.waitForFunction(() => currentDate.getDate() === 22);
    const rollover = await appDate(page);
    expect(rollover.value).toBe('2024-06-22');
    expect(rollover.hour).toBeLessThan(12);

    await button.click();
    await expect(page.locator('.play-label')).toHaveText('Play');
  });
});
