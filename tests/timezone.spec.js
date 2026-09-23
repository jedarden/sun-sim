import { test, expect } from '@playwright/test';

async function loadApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof updateAll === 'function' && typeof datePicker !== 'undefined');
}

async function setInstant(page, instant, latitude, longitude) {
  return page.evaluate(({ instant, latitude, longitude }) => {
    currentLat = latitude;
    currentLon = longitude;
    currentDate = new Date(instant);
    updateAll();

    const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
    const localDate = currentDate;
    const solarNoon = times.solarNoon;

    return {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      instant: currentDate.toISOString(),
      local: {
        year: localDate.getFullYear(),
        month: localDate.getMonth() + 1,
        day: localDate.getDate(),
        hour: localDate.getHours(),
        minute: localDate.getMinutes(),
        offset: localDate.getTimezoneOffset()
      },
      displayedTime: formatTime(currentDate),
      header: document.querySelector('#current-time-display').textContent,
      picker: document.querySelector('#date-picker').value,
      sunrise: times.sunrise.toISOString(),
      solarNoon: solarNoon.toISOString(),
      sunset: times.sunset.toISOString(),
      sunriseDisplay: document.querySelector('#info-sunrise').textContent,
      solarNoonDisplay: document.querySelector('#info-noon').textContent,
      sunsetDisplay: document.querySelector('#info-sunset').textContent,
      dayLength: (times.sunset - times.sunrise) / 60000
    };
  }, { instant, latitude, longitude });
}

async function transitionSnapshots(page, instants) {
  return page.evaluate((values) => values.map((instant) => {
    currentDate = new Date(instant);
    updateAll();
    return {
      instant: currentDate.toISOString(),
      hour: currentDate.getHours(),
      minute: currentDate.getMinutes(),
      offset: currentDate.getTimezoneOffset(),
      displayedTime: formatTime(currentDate)
    };
  }), instants);
}

test.describe('Displayed time policy', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('uses the browser timezone rather than UTC or the selected location', async ({ page }) => {
    await loadApp(page);
    const state = await setInstant(page, '2024-06-21T03:00:00.000Z', -33.8688, 151.2093);

    expect(state.timeZone).toBe('America/New_York');
    expect(state.local).toMatchObject({ year: 2024, month: 6, day: 20, hour: 23, minute: 0 });
    expect(state.displayedTime).toBe('11:00 PM');
    expect(state.header).toContain('Jun 20, 2024');
    expect(state.picker).toBe('2024-06-20');
    expect(state.solarNoonDisplay).toBe('9:58 PM');
    expect(state.solarNoonDisplay).not.toBe('1:58 AM');
    expect(state.solarNoonDisplay).not.toBe('12:58 PM');
    expect(state.solarNoon).toBe('2024-06-21T01:58:10.735Z');
  });
});

test.describe('Daylight-saving transitions', () => {
  test.describe('Northern Hemisphere', () => {
    test.use({ timezoneId: 'America/New_York' });

    test('renders the spring gap and repeated fall-back hour', async ({ page }) => {
      await loadApp(page);
      const snapshots = await transitionSnapshots(page, [
        '2024-03-10T06:59:00.000Z',
        '2024-03-10T07:00:00.000Z',
        '2024-11-03T05:30:00.000Z',
        '2024-11-03T06:30:00.000Z'
      ]);
      const civilTimes = await page.evaluate(() => {
        const gap = new Date(2024, 2, 10, 2, 30);
        const overlap = new Date(2024, 10, 3, 1, 30);
        return {
          gap: { hour: gap.getHours(), minute: gap.getMinutes(), offset: gap.getTimezoneOffset() },
          overlap: { hour: overlap.getHours(), minute: overlap.getMinutes(), offset: overlap.getTimezoneOffset() }
        };
      });

      expect(snapshots[0].displayedTime).toBe('1:59 AM');
      expect(snapshots[1].displayedTime).toBe('3:00 AM');
      expect(snapshots[0].offset - snapshots[1].offset).toBe(60);
      expect(snapshots[2].displayedTime).toBe('1:30 AM');
      expect(snapshots[3].displayedTime).toBe('1:30 AM');
      expect(snapshots[3].offset - snapshots[2].offset).toBe(60);
      expect(new Date(snapshots[3].instant) - new Date(snapshots[2].instant)).toBe(60 * 60 * 1000);
      expect(civilTimes.gap).toEqual({ hour: 3, minute: 30, offset: 240 });
      expect(civilTimes.overlap).toEqual({ hour: 1, minute: 30, offset: 240 });
    });

    test('preserves wall-clock time across 23-hour and 25-hour days', async ({ page }) => {
      await loadApp(page);
      const navigation = await page.evaluate(() => {
        currentDate = new Date('2024-03-09T17:00:00.000Z');
        changeDate(1, 'day');
        const spring = {
          instant: currentDate.toISOString(),
          hour: currentDate.getHours(),
          minute: currentDate.getMinutes()
        };
        currentDate = new Date('2024-11-02T16:00:00.000Z');
        changeDate(1, 'day');
        const fall = {
          instant: currentDate.toISOString(),
          hour: currentDate.getHours(),
          minute: currentDate.getMinutes()
        };
        return { spring, fall };
      });

      expect(navigation.spring).toEqual({ instant: '2024-03-10T16:00:00.000Z', hour: 12, minute: 0 });
      expect(navigation.fall).toEqual({ instant: '2024-11-03T17:00:00.000Z', hour: 12, minute: 0 });
    });
  });

  test.describe('Southern Hemisphere', () => {
    test.use({ timezoneId: 'Australia/Sydney' });

    test('renders the southern spring and fall transitions', async ({ page }) => {
      await loadApp(page);
      const snapshots = await transitionSnapshots(page, [
        '2024-04-06T15:59:00.000Z',
        '2024-04-06T16:00:00.000Z',
        '2024-10-05T15:59:00.000Z',
        '2024-10-05T16:00:00.000Z'
      ]);

      expect(snapshots[0].displayedTime).toBe('2:59 AM');
      expect(snapshots[1].displayedTime).toBe('2:00 AM');
      expect(snapshots[0].offset - snapshots[1].offset).toBe(-60);
      expect(snapshots[2].displayedTime).toBe('1:59 AM');
      expect(snapshots[3].displayedTime).toBe('3:00 AM');
      expect(snapshots[3].offset - snapshots[2].offset).toBe(-60);
    });
  });
});

test.describe('UTC date boundaries', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('uses the browser civil date at a UTC midnight boundary', async ({ page }) => {
    await loadApp(page);
    const states = await page.evaluate(() => {
      return ['2024-01-01T07:59:00.000Z', '2024-01-01T08:00:00.000Z'].map((instant) => {
        currentDate = new Date(instant);
        updateAll();
        return {
          instant: currentDate.toISOString(),
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
          day: currentDate.getDate(),
          displayedTime: formatTime(currentDate),
          picker: document.querySelector('#date-picker').value,
          header: document.querySelector('#current-time-display').textContent
        };
      });
    });

    expect(states[0]).toMatchObject({
      instant: '2024-01-01T07:59:00.000Z',
      year: 2023,
      month: 12,
      day: 31,
      displayedTime: '11:59 PM',
      picker: '2023-12-31'
    });
    expect(states[1]).toMatchObject({
      instant: '2024-01-01T08:00:00.000Z',
      year: 2024,
      month: 1,
      day: 1,
      displayedTime: '12:00 AM',
      picker: '2024-01-01'
    });
    expect(states[0].header).toContain('Dec 31, 2023');
    expect(states[1].header).toContain('Jan 1, 2024');
  });
});

test.describe('Calendar boundaries', () => {
  test.use({ timezoneId: 'UTC' });

  test('keeps month-end navigation and picker selection on the intended date', async ({ page }) => {
    await loadApp(page);
    const state = await page.evaluate(() => {
      currentDate = new Date(2024, 0, 31, 12, 0);
      updateAll();
      changeDate(1, 'month');
      const navigation = {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate()
      };

      currentDate = new Date(2024, 0, 31, 12, 0);
      updateAll();
      datePicker.setDate(new Date(2024, 1, 28, 12, 0), true);
      const picker = {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate(),
        value: document.querySelector('#date-picker').value
      };
      return { navigation, picker };
    });

    expect(state.navigation).toEqual({ year: 2024, month: 2, day: 29 });
    expect(state.picker).toEqual({ year: 2024, month: 2, day: 28, value: '2024-02-28' });
  });
});

test.describe('Date-line and hemisphere coverage', () => {
  test.use({ timezoneId: 'UTC' });

  test('keeps the instant stable for locations on either side of the date line', async ({ page }) => {
    await loadApp(page);
    const locations = await page.evaluate(() => {
      return [
        { name: 'Fiji', latitude: -17.7134, longitude: 178.065 },
        { name: 'Samoa', latitude: -13.8507, longitude: -171.7516 }
      ].map((location) => {
        currentLat = location.latitude;
        currentLon = location.longitude;
        currentDate = new Date('2024-01-01T00:30:00.000Z');
        updateAll();
        const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
        return {
          name: location.name,
          instant: currentDate.toISOString(),
          sunrise: times.sunrise.toISOString(),
          solarNoon: times.solarNoon.toISOString(),
          sunset: times.sunset.toISOString(),
          dayLength: (times.sunset - times.sunrise) / 60000
        };
      });
    });

    expect(locations.map(({ instant }) => instant)).toEqual([
      '2024-01-01T00:30:00.000Z',
      '2024-01-01T00:30:00.000Z'
    ]);
    expect(locations[0].sunrise.slice(0, 10)).toBe('2023-12-31');
    expect(locations[1].sunrise.slice(0, 10)).toBe('2023-12-31');
    expect(locations[0].solarNoon.slice(0, 10)).toBe('2024-01-01');
    expect(locations[1].solarNoon.slice(0, 10)).toBe('2023-12-31');
    expect(locations[0].sunset.slice(0, 10)).toBe('2024-01-01');
    expect(locations[1].sunset.slice(0, 10)).toBe('2024-01-01');
    for (const location of locations) {
      expect(location.dayLength).toBeGreaterThan(720);
      expect(location.dayLength).toBeLessThan(840);
    }
  });

  test('shows opposite seasonal day lengths across the hemispheres', async ({ page }) => {
    await loadApp(page);
    const seasons = await page.evaluate(() => {
      const cases = [
        { name: 'north-june', latitude: 40.7128, longitude: -74.006, instant: '2024-06-21T12:00:00.000Z' },
        { name: 'south-june', latitude: -33.8688, longitude: 151.2093, instant: '2024-06-21T12:00:00.000Z' },
        { name: 'north-december', latitude: 40.7128, longitude: -74.006, instant: '2024-12-21T12:00:00.000Z' },
        { name: 'south-december', latitude: -33.8688, longitude: 151.2093, instant: '2024-12-21T12:00:00.000Z' }
      ];
      return cases.map((item) => {
        currentLat = item.latitude;
        currentLon = item.longitude;
        currentDate = new Date(item.instant);
        updateAll();
        const times = SunCalc.getTimes(currentDate, currentLat, currentLon);
        return { name: item.name, dayLength: (times.sunset - times.sunrise) / 60000 };
      });
    });
    const byName = Object.fromEntries(seasons.map((season) => [season.name, season.dayLength]));

    expect(byName['north-june']).toBeGreaterThan(840);
    expect(byName['south-june']).toBeLessThan(660);
    expect(byName['north-december']).toBeLessThan(660);
    expect(byName['south-december']).toBeGreaterThan(840);
  });
});
