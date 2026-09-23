import { existsSync, readdirSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const testPort = Number(process.env.SUN_SIM_TEST_PORT || 3010);
const chromiumExecutable = process.env.SUN_SIM_CHROMIUM_PATH || process.env.CHROME_PATH || findNixChromium();

function findNixChromium() {
  if (!existsSync('/nix/store')) return undefined;
  try {
    return readdirSync('/nix/store')
      .filter(entry => /-chromium-\d/.test(entry))
      .map(entry => `/nix/store/${entry}/bin/chromium`)
      .find(candidate => existsSync(candidate));
  } catch {
    return undefined;
  }
}

/**
 * Playwright configuration for sun-sim smoke tests
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',

  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {})
      },
    },
  ],

  // Start the dev server before running tests
  webServer: {
    command: `python3 serve.py ${testPort}`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
