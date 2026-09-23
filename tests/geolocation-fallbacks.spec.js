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
