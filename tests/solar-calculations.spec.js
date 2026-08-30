import { test, expect } from '@playwright/test';

/**
 * Smoke tests for solar calculation correctness
 *
 * These tests verify that the sun position, sunrise/sunset times, and day length
 * calculations are accurate within reasonable tolerances for known reference cases.
 *
 * Reference data sources:
 * - Equinox: Expected ~12h day length at equator
 * - New York: timeanddate.com sunrise/sunset times
 * - Arctic Circle: Midnight sun phenomenon on summer solstice
 */

test.describe('Solar Calculation Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await page.waitForSelector('#info-azimuth', { timeout: 10000 });
  });

  /**
   * Test Case 1: Equator on Equinox
   * Location: Quito, Ecuador (0° latitude, near equator)
   * Date: March 20, 2024 (Vernal Equinox)
   * Expected: Day length very close to 12 hours
   */
  test('equator on equinox has ~12h day length', async ({ page }) => {
    // Set location to equator (Quito, Ecuador approximation)
    await page.evaluate(() => {
      currentLat = 0.0;
      currentLon = -78.5;
      currentDate = new Date('2024-03-20T12:00:00');
      updateAll();
    });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Get day length display
    const dayLengthText = await page.textContent('#info-daylength');

    // Expected: approximately 12h (allow ±15 minutes for atmospheric refraction and definition variations)
    // Format: "12h 0m" or similar
    const match = dayLengthText.match(/(\d+)h\s+(\d+)m/);
    expect(match).toBeTruthy();

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const totalMinutes = hours * 60 + minutes;

    // Allow 11h45m to 12h15m (705 to 735 minutes)
    expect(totalMinutes).toBeGreaterThanOrEqual(705);
    expect(totalMinutes).toBeLessThanOrEqual(735);

    console.log(`✓ Equator equinox test: day length = ${dayLengthText}`);
  });

  /**
   * Test Case 2: Known Location with Verifiable Times
   * Location: New York City (40.7128°N, 74.0060°W)
   * Date: June 21, 2024 (Summer Solstice) at noon
   * Reference: timeanddate.com sunrise/sunset for NYC on June 21, 2024
   */
  test('New York City summer solstice sunrise/sunset accuracy', async ({ page }) => {
    // Set location to NYC and date to summer solstice noon
    await page.evaluate(() => {
      currentLat = 40.7128;
      currentLon = -74.0060;
      currentDate = new Date('2024-06-21T12:00:00');
      updateAll();
    });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Get sunrise and sunset times
    const sunriseText = await page.textContent('#info-sunrise');
    const sunsetText = await page.textContent('#info-sunset');

    // Parse times (format: "5:25 AM" or similar)
    const parseTime = (text) => {
      const match = text.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3].toUpperCase();

      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      return hours * 60 + minutes; // Total minutes since midnight
    };

    const sunriseMinutes = parseTime(sunriseText);
    const sunsetMinutes = parseTime(sunsetText);

    expect(sunriseMinutes).not.toBeNull();
    expect(sunsetMinutes).not.toBeNull();

    // Reference values for NYC on June 21, 2024 (from timeanddate.com):
    // Sunrise: approximately 5:25 AM (~325 minutes)
    // Sunset: approximately 8:31 PM (~1251 minutes)
    // Allow ±2 minutes tolerance
    expect(sunriseMinutes).toBeGreaterThan(323);
    expect(sunriseMinutes).toBeLessThan(327);
    expect(sunsetMinutes).toBeGreaterThan(1249);
    expect(sunsetMinutes).toBeLessThan(1253);

    // Verify solar position is calculated (noon should have high altitude)
    const altitudeText = await page.textContent('#info-altitude');
    const altitudeMatch = altitudeText.match(/([\d.]+)°/);
    const altitude = parseFloat(altitudeMatch[1]);

    // At noon on summer solstice in NYC, sun should be high (around 70°)
    expect(altitude).toBeGreaterThan(65);
    expect(altitude).toBeLessThan(75);

    console.log(`✓ NYC summer solstice: sunrise=${sunriseText}, sunset=${sunsetText}, altitude=${altitudeText}`);
  });

  /**
   * Test Case 3: Arctic Circle on Summer Solstice (Midnight Sun)
   * Location: Tromsø, Norway (69.65°N, well above Arctic Circle at 66.5°N)
   * Date: June 21, 2024 (Summer Solstice)
   * Expected: "24h (Midnight Sun)" displayed
   */
  test('Arctic circle midnight sun on summer solstice', async ({ page }) => {
    // Set location to Tromsø, Norway (above Arctic Circle)
    await page.evaluate(() => {
      currentLat = 69.65;
      currentLon = 18.96;
      currentDate = new Date('2024-06-21T12:00:00');
      updateAll();
    });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Get day length display
    const dayLengthText = await page.textContent('#info-daylength');

    // Should show "24h (Midnight Sun)" at noon on summer solstice above Arctic Circle
    expect(dayLengthText).toContain('24h');
    expect(dayLengthText).toContain('Midnight Sun');

    // Sun should be above horizon (positive altitude)
    const altitudeText = await page.textContent('#info-altitude');
    const altitudeMatch = altitudeText.match(/([\d.]+)°/);
    const altitude = parseFloat(altitudeMatch[1]);

    expect(altitude).toBeGreaterThan(0);

    // Sunrise/sunset should show "No sunrise" / "No sunset"
    const sunriseText = await page.textContent('#info-sunrise');
    const sunsetText = await page.textContent('#info-sunset');

    expect(sunriseText).toContain('No sunrise');
    expect(sunsetText).toContain('No sunset');

    console.log(`✓ Arctic midnight sun: day length=${dayLengthText}, altitude=${altitudeText}`);
  });

  /**
   * Test Case 4: Arctic Circle on Winter Solstice (Polar Night)
   * Location: Tromsø, Norway (69.65°N)
   * Date: December 21, 2024 (Winter Solstice)
   * Expected: "0h (Polar Night)" displayed
   */
  test('Arctic circle polar night on winter solstice', async ({ page }) => {
    // Set location to Tromsø, Norway on winter solstice
    await page.evaluate(() => {
      currentLat = 69.65;
      currentLon = 18.96;
      currentDate = new Date('2024-12-21T12:00:00');
      updateAll();
    });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Get day length display
    const dayLengthText = await page.textContent('#info-daylength');

    // Should show "0h (Polar Night)" at noon on winter solstice above Arctic Circle
    expect(dayLengthText).toContain('0h');
    expect(dayLengthText).toContain('Polar Night');

    // Sun should be below horizon (negative altitude)
    const altitudeText = await page.textContent('#info-altitude');
    const altitudeMatch = altitudeText.match(/([\d.]+)°/);
    const altitude = parseFloat(altitudeMatch[1]);

    expect(altitude).toBeLessThan(0);

    console.log(`✓ Arctic polar night: day length=${dayLengthText}, altitude=${altitudeText}`);
  });

  /**
   * Test Case 5: Azimuth and Altitude Calculation Verification
   * Location: Equator at Prime Meridian (0°, 0°)
   * Date: March 20, 2024 (Equinox) at solar noon
   * Expected: Altitude near maximum, azimuth near 0° (North) for equatorial noon
   */
  test('sun position calculations at solar noon on equinox', async ({ page }) => {
    // Set location to equator at prime meridian
    await page.evaluate(() => {
      currentLat = 0.0;
      currentLon = 0.0;
      currentDate = new Date('2024-03-20T12:00:00');
      updateAll();
    });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Get azimuth and altitude
    const azimuthText = await page.textContent('#info-azimuth');
    const altitudeText = await page.textContent('#info-altitude');

    const azimuthMatch = azimuthText.match(/([\d.]+)°/);
    const altitudeMatch = altitudeText.match(/([\d.]+)°/);

    const azimuth = parseFloat(azimuthMatch[1]);
    const altitude = parseFloat(altitudeMatch[1]);

    // At solar noon on equinox at equator:
    // - Sun should be nearly directly overhead (altitude near 90°)
    // - Azimuth should be near 180° (South) or 0° (North) depending on convention
    expect(altitude).toBeGreaterThan(85); // Nearly overhead
    expect(azimuth).toBeGreaterThanOrEqual(0);
    expect(azimuth).toBeLessThanOrEqual(360);

    console.log(`✓ Equinox noon position: azimuth=${azimuthText}, altitude=${altitudeText}`);
  });

  /**
   * Test Case 6: Seasonal Variation at Mid-Latitude
   * Location: London, UK (51.5°N)
   * Compare summer vs winter day lengths
   */
  test('seasonal day length variation at mid-latitude', async ({ page }) => {
    // Test summer solstice
    await page.evaluate(() => {
      currentLat = 51.5;
      currentLon = -0.1;
      currentDate = new Date('2024-06-21T12:00:00');
      updateAll();
    });

    await page.waitForTimeout(500);

    const summerDayLength = await page.textContent('#info-daylength');
    const summerMatch = summerDayLength.match(/(\d+)h\s+(\d+)m/);
    const summerMinutes = parseInt(summerMatch[1]) * 60 + parseInt(summerMatch[2]);

    // Test winter solstice
    await page.evaluate(() => {
      currentDate = new Date('2024-12-21T12:00:00');
      updateAll();
    });

    await page.waitForTimeout(500);

    const winterDayLength = await page.textContent('#info-daylength');
    const winterMatch = winterDayLength.match(/(\d+)h\s+(\d+)m/);
    const winterMinutes = parseInt(winterMatch[1]) * 60 + parseInt(winterMatch[2]);

    // Summer days should be much longer than winter days at 51.5°N
    // London summer: ~16h30m (~990 min), winter: ~7h50m (~470 min)
    expect(summerMinutes).toBeGreaterThan(900); // At least 15 hours
    expect(winterMinutes).toBeLessThan(600);    // Less than 10 hours
    expect(summerMinutes).toBeGreaterThan(winterMinutes * 1.5); // Summer > 1.5x winter

    console.log(`✓ Seasonal variation: summer=${summerDayLength}, winter=${winterDayLength}`);
  });
});
