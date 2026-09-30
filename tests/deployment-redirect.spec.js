import { expect, test } from '@playwright/test';

const LEGACY_URL = 'https://sunsim.jedarden.com/';
const DESTINATION_URL = 'https://jedarden.com/sun-simulator/';
const LEGACY_REDIRECT_STATUS = 301;

test('redirects the legacy domain instead of serving the retired application', async ({ request }) => {
  const response = await request.get(LEGACY_URL, { maxRedirects: 0 });

  expect(response.status()).toBe(LEGACY_REDIRECT_STATUS);
  expect(response.headers().location).toBe(DESTINATION_URL);
  expect(response.url()).toBe(LEGACY_URL);

  const body = await response.text();
  expect(body).not.toMatch(/<html|Sun Path & Shadow Simulator|leaflet/i);
});
