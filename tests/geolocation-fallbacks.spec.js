import { expect, test } from '@playwright/test';

const nominatimPattern = 'https://nominatim.openstreetmap.org/**';
const fallbackName = 'Custom Location';

async function loadApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof updateAll === 'function' && typeof datePicker !== 'undefined');
}

async function installNominatimResponse(page, status, body) {
  await page.route(nominatimPattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

async function installNominatimRecorder(page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__nominatimFetches = [];
    window.fetch = (input, options) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.includes('nominatim.openstreetmap.org')) {
        return nativeFetch(input, options);
      }

      const record = {
        url,
        startedAt: performance.now(),
        aborted: false
      };
      window.__nominatimFetches.push(record);
      if (options && options.signal) {
        if (options.signal.aborted) record.aborted = true;
        options.signal.addEventListener('abort', () => {
          record.aborted = true;
        }, { once: true });
      }
      return nativeFetch(input, options);
    };
  });
}

async function installCoordinateNominatimResponse(page, delayedLat = null, delayMs = 0) {
  await page.route(nominatimPattern, async (route) => {
    const url = new URL(route.request().url());
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (delayedLat !== null && Number(lat).toFixed(1) === delayedLat && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ address: { city: `Place ${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}` } })
    }).catch(() => {});
  });
}

async function installGeolocationError(page, code) {
  await page.addInitScript((errorCode) => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success, error) {
          setTimeout(() => error({ code: errorCode }), 0);
        }
      }
    });
  }, code);
}

async function installGeolocationUnsupported(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined
    });
  });
}

async function installNominatimTimeout(page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('nominatim.openstreetmap.org')) {
        const error = new Error('mocked Nominatim timeout');
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      return nativeFetch(input, options);
    };
  });
}

async function expectUsable(page) {
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#btn-use-gps')).toBeEnabled();
  await expect(page.locator('#date-picker')).toBeEnabled();
  await expect(page.locator('.location-attribution')).toContainText('Nominatim');
  await expect(page.locator('.location-attribution')).toContainText('OpenStreetMap');

  const dateBefore = await page.inputValue('#date-picker');
  await page.locator('#btn-next-day').click();
  await expect(page.locator('#date-picker')).not.toHaveValue(dateBefore);
  await expect(page.locator('#info-azimuth')).toContainText('°');
}

test.describe('GPS failure behavior', () => {
  for (const scenario of [
    { name: 'permission denial', code: 1, message: 'permission denied' },
    { name: 'unavailable position', code: 2, message: 'Location unavailable' },
    { name: 'geolocation timeout', code: 3, message: 'request timed out' }
  ]) {
    test(`keeps the UI usable after ${scenario.name}`, async ({ page }) => {
      await installGeolocationError(page, scenario.code);
      await installNominatimResponse(page, 200, { address: { city: 'New York' } });
      let dialogMessage = null;
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await loadApp(page);
      await page.locator('#btn-use-gps').click();
      await expect(page.locator('#location-status')).toContainText(scenario.message);
      await expect(page.locator('#btn-use-gps')).toBeEnabled();
      expect(dialogMessage).toBeNull();
      await expectUsable(page);
    });
  }
});

test('keeps the UI usable when the browser has no geolocation API', async ({ page }) => {
  await installGeolocationUnsupported(page);
  await installNominatimResponse(page, 200, { address: { city: 'New York' } });
  await loadApp(page);
  await page.locator('#btn-use-gps').click();

  await expect(page.locator('#location-status')).toContainText('unavailable in this browser');
  await expect(page.locator('#btn-use-gps')).toBeEnabled();
  await expectUsable(page);
});

test.describe('Nominatim failure behavior', () => {
  const scenarios = [
    {
      name: 'timeout',
      message: 'timed out',
      setup: installNominatimTimeout
    },
    {
      name: 'rate limit',
      message: 'rate limited',
      setup: (page) => installNominatimResponse(page, 429, { error: 'Too many requests' })
    },
    {
      name: 'no-result response',
      message: 'No place name was found',
      setup: (page) => installNominatimResponse(page, 200, { error: 'Unable to geocode' })
    }
  ];

  for (const scenario of scenarios) {
    test(`keeps the UI usable after a Nominatim ${scenario.name}`, async ({ page }) => {
      await scenario.setup(page);
      await loadApp(page);
      await page.evaluate(() => {
        currentLat = 12.3456;
        currentLon = 78.9012;
        updateAll();
      });

      await expect(page.locator('#location-status')).toContainText(scenario.message);
      await expect(page.locator('#location-status')).toContainText('coordinates and controls remain available');
      await expect(page.locator('.location-name')).toHaveText(fallbackName);
      await expectUsable(page);
    });
  }
});

test('shows a successful reverse-geocoded name and keeps attribution visible', async ({ page }) => {
  await installNominatimResponse(page, 200, { address: { town: 'Springfield' } });
  await loadApp(page);
  await page.evaluate(() => {
    currentLat = 39.7817;
    currentLon = -89.6501;
    updateAll();
  });

  await expect(page.locator('.location-name')).toHaveText('Springfield');
  await expect(page.locator('#location-status')).toBeHidden();
  await expect(page.locator('.location-attribution')).toContainText('Nominatim');
  await expect(page.locator('.location-attribution')).toContainText('OpenStreetMap');
  await expectUsable(page);
});

test.describe('Nominatim request scheduling', () => {
  test('coalesces rapid map movement and displays the latest location', async ({ page }) => {
    await installNominatimRecorder(page);
    await installCoordinateNominatimResponse(page);
    await loadApp(page);
    await expect.poll(() => page.locator('.location-name').textContent()).toContain('Place');
    await page.evaluate(() => {
      window.__nominatimFetches.length = 0;
    });

    await page.evaluate(() => {
      [
        [41.1, -74.1],
        [41.2, -74.2],
        [41.3, -74.3]
      ].forEach(([lat, lon]) => map.setView([lat, lon], 12, { animate: false }));
    });

    await expect(page.locator('.location-name')).toHaveText('Place 41.30,-74.30');
    const requests = await page.evaluate(() => window.__nominatimFetches);
    expect(requests).toHaveLength(1);
    expect(Number(new URL(requests[0].url).searchParams.get('lat')).toFixed(1)).toBe('41.3');
  });

  test('spaces map-movement requests by at least one second', async ({ page }) => {
    await installNominatimRecorder(page);
    await installCoordinateNominatimResponse(page);
    await loadApp(page);
    await expect.poll(() => page.locator('.location-name').textContent()).toContain('Place');
    await page.evaluate(() => {
      window.__nominatimFetches.length = 0;
    });

    for (const [lat, lon] of [[42.1, -73.1], [42.2, -73.2], [42.3, -73.3]]) {
      await page.evaluate(([nextLat, nextLon]) => {
        map.setView([nextLat, nextLon], 12, { animate: false });
      }, [lat, lon]);
      await page.waitForTimeout(650);
    }

    await expect(page.locator('.location-name')).toHaveText('Place 42.30,-73.30');
    const requests = await page.evaluate(() => window.__nominatimFetches);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests.length).toBeLessThanOrEqual(3);
    for (let index = 1; index < requests.length; index += 1) {
      expect(requests[index].startedAt - requests[index - 1].startedAt).toBeGreaterThanOrEqual(900);
    }
  });

  test('serializes direct lookups and reuses cached results', async ({ page }) => {
    await installNominatimRecorder(page);
    await installCoordinateNominatimResponse(page);
    await loadApp(page);
    await expect.poll(() => page.locator('.location-name').textContent()).toContain('Place');
    await page.evaluate(() => {
      window.__nominatimFetches.length = 0;
    });

    const names = await page.evaluate(async () => Promise.all([
      reverseGeocode(44.1, -71.1),
      reverseGeocode(45.1, -70.1)
    ]));
    expect(names).toEqual(['Place 44.10,-71.10', 'Place 45.10,-70.10']);

    const requests = await page.evaluate(() => window.__nominatimFetches);
    expect(requests).toHaveLength(2);
    expect(requests[1].startedAt - requests[0].startedAt).toBeGreaterThanOrEqual(900);

    const cachedName = await page.evaluate(() => reverseGeocode(44.101, -71.101));
    expect(cachedName).toBe('Place 44.10,-71.10');
    expect(await page.evaluate(() => window.__nominatimFetches)).toHaveLength(2);
  });

  test('aborts an obsolete lookup and keeps the latest location name', async ({ page }) => {
    await installNominatimRecorder(page);
    await installCoordinateNominatimResponse(page, '43.1', 1500);
    await loadApp(page);
    await expect.poll(() => page.locator('.location-name').textContent()).toContain('Place');
    await page.evaluate(() => {
      window.__nominatimFetches.length = 0;
    });

    await page.evaluate(() => {
      map.setView([43.1, -72.1], 12, { animate: false });
    });
    await expect.poll(() => page.evaluate(() => window.__nominatimFetches.length)).toBe(1);
    await page.evaluate(() => {
      map.setView([43.2, -72.2], 12, { animate: false });
    });

    await expect(page.locator('.location-name')).toHaveText('Place 43.20,-72.20');
    await page.waitForTimeout(1600);
    const requests = await page.evaluate(() => window.__nominatimFetches);
    expect(requests[0].aborted).toBe(true);
    await expect(page.locator('.location-name')).toHaveText('Place 43.20,-72.20');
  });
});
