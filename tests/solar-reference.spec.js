import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/solar-references.json'), 'utf8')
);
const { positionDegrees, timingMinutes } = fixture.tolerances;

function parseDegrees(text) {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : Number.NaN;
}

function parseClock(text) {
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function angularDistance(actual, expected) {
  const difference = Math.abs(actual - expected) % 360;
  return Math.min(difference, 360 - difference);
}

function utcMinutes(isoTime) {
  const date = new Date(isoTime);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function timeDifferenceMinutes(actualText, expectedIso) {
  const actual = parseClock(actualText);
  const expected = utcMinutes(expectedIso);
  const difference = Math.abs(actual - expected);
  return Math.min(difference, 1440 - difference);
}

function instantDifferenceMinutes(actualIso, expectedIso) {
  return Math.abs(new Date(actualIso).getTime() - new Date(expectedIso).getTime()) / 60000;
}

function parseDayLength(text) {
  const match = text.match(/^(\d+)h\s+(\d+)m$/);
  return match ? Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10) : null;
}

test.use({ timezoneId: 'UTC' });

test.describe('Authoritative USNO solar references', () => {
  for (const testCase of fixture.cases) {
    test(`${testCase.id} matches the reference position and events`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof updateAll === 'function' && window.SunCalc);

      const actual = await page.evaluate((referenceCase) => {
        currentLat = referenceCase.latitude;
        currentLon = referenceCase.longitude;
        currentDate = new Date(referenceCase.timeUtc);
        updateAll();

        const position = SunCalc.getPosition(currentDate, currentLat, currentLon);
        const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
        const validDate = (value) => value && !Number.isNaN(value.getTime());

        return {
          displayedAzimuth: document.querySelector('#info-azimuth').textContent,
          displayedAltitude: document.querySelector('#info-altitude').textContent,
          sunrise: document.querySelector('#info-sunrise').textContent,
          solarNoon: document.querySelector('#info-noon').textContent,
          sunset: document.querySelector('#info-sunset').textContent,
          dayLength: document.querySelector('#info-daylength').textContent,
          rawAzimuth: (position.azimuth * 180 / Math.PI + 180) % 360,
          rawAltitude: position.altitude * 180 / Math.PI,
          sunriseInstant: validDate(times.sunrise) ? times.sunrise.toISOString() : null,
          solarNoonInstant: validDate(times.solarNoon) ? times.solarNoon.toISOString() : null,
          sunsetInstant: validDate(times.sunset) ? times.sunset.toISOString() : null
        };
      }, testCase);

      const reference = testCase.reference;
      expect(angularDistance(actual.rawAzimuth, reference.azimuthDegrees)).toBeLessThanOrEqual(
        positionDegrees
      );
      expect(Math.abs(actual.rawAltitude - reference.altitudeDegrees)).toBeLessThanOrEqual(
        positionDegrees
      );
      expect(Math.abs(parseDegrees(actual.displayedAzimuth) - actual.rawAzimuth)).toBeLessThanOrEqual(
        0.051
      );
      expect(Math.abs(parseDegrees(actual.displayedAltitude) - actual.rawAltitude)).toBeLessThanOrEqual(
        0.051
      );

      if (reference.sunriseUtc === null) {
        expect(actual.sunrise).toBe('No sunrise');
        expect(actual.sunriseInstant).toBeNull();
      } else {
        expect(instantDifferenceMinutes(actual.sunriseInstant, reference.sunriseUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
        expect(timeDifferenceMinutes(actual.sunrise, reference.sunriseUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
      }

      if (reference.sunsetUtc === null) {
        expect(actual.sunset).toBe('No sunset');
        expect(actual.sunsetInstant).toBeNull();
      } else {
        expect(instantDifferenceMinutes(actual.sunsetInstant, reference.sunsetUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
        expect(timeDifferenceMinutes(actual.sunset, reference.sunsetUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
      }

      if (reference.solarNoonUtc !== undefined) {
        expect(instantDifferenceMinutes(actual.solarNoonInstant, reference.solarNoonUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
        expect(timeDifferenceMinutes(actual.solarNoon, reference.solarNoonUtc)).toBeLessThanOrEqual(
          timingMinutes
        );
      }

      if (reference.dayLengthMinutes === null) {
        if (testCase.condition === 'midnight sun') {
          expect(actual.dayLength).toBe('24h (Midnight Sun)');
        } else {
          expect(actual.dayLength).toBe('0h (Polar Night)');
        }
      } else {
        const displayedDayLength = parseDayLength(actual.dayLength);
        expect(displayedDayLength).not.toBeNull();
        expect(Math.abs(displayedDayLength - reference.dayLengthMinutes)).toBeLessThanOrEqual(
          timingMinutes
        );
      }
    });
  }
});
