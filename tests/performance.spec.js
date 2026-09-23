import { expect, test } from '@playwright/test';

const mapTilePattern = 'https://server.arcgisonline.com/**';
const nominatimPattern = 'https://nominatim.openstreetmap.org/**';
const FRAME_BUDGET_MS = 20;
const MAX_LONG_FRAME_RATIO = 0.05;
const SAMPLE_FRAMES = 60;
const WARMUP_FRAMES = 12;
const FIXED_DATE = '2024-06-21T16:00:00.000Z';

const profiles = [
  {
    name: 'desktop',
    viewport: { width: 1280, height: 720 },
    isMobile: false,
    hasTouch: false,
    input: 'mouse'
  },
  {
    name: 'mobile',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    input: 'touch'
  }
];

const scenarios = [
  { name: 'map overlays', operation: 'map' },
  { name: 'sun-path rendering', operation: 'sun-path' },
  { name: 'timeline dragging', operation: 'timeline' },
  { name: 'animation', operation: 'animation' }
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
  await page.waitForTimeout(600);
  await page.evaluate((instant) => {
    pauseAnimation();
    currentDate = new Date(instant);
    currentLat = 40.7128;
    currentLon = -74.006;
    updateAll();
  }, FIXED_DATE);
  await page.evaluate((frames) => new Promise(resolve => {
    let count = 0;
    const tick = () => {
      count += 1;
      if (count < frames) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  }), WARMUP_FRAMES);
}

async function measureFrames(page, operation, input) {
  return page.evaluate(({ operation, input, frames }) => new Promise((resolve, reject) => {
    const intervals = [];
    const work = [];
    let previous = null;
    let index = 0;
    const originLatitude = currentLat;
    const originLongitude = currentLon;
    const startingTime = currentDate.getTime();

    const createDragEvent = (type, clientX, clientY) => {
      if (input === 'touch') {
        const event = new Event(type, { bubbles: true });
        const touch = { clientX, clientY };
        Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch] });
        Object.defineProperty(event, 'changedTouches', { value: [touch] });
        return event;
      }
      return new MouseEvent(type, { bubbles: true, clientX, clientY });
    };

    const finish = () => {
      if (operation === 'timeline') {
        const rect = timelineCanvas.getBoundingClientRect();
        document.dispatchEvent(createDragEvent(input === 'touch' ? 'touchend' : 'mouseup', rect.right, rect.top));
      }
      if (operation === 'animation') pauseAnimation();
      resolve({
        intervals,
        work,
        animationAdvanced: operation !== 'animation' || currentDate.getTime() !== startingTime
      });
    };

    const tick = timestamp => {
      try {
        const before = performance.now();
        if (operation === 'map') {
          map.setView([originLatitude + index * 0.00005, originLongitude], 12, { animate: false });
        } else if (operation === 'sun-path') {
          drawSunPath();
        } else if (operation === 'timeline') {
          const rect = timelineCanvas.getBoundingClientRect();
          const fraction = 0.1 + (0.8 * index / Math.max(1, frames - 1));
          const type = index === 0
            ? (input === 'touch' ? 'touchstart' : 'mousedown')
            : (input === 'touch' ? 'touchmove' : 'mousemove');
          const event = createDragEvent(type, rect.left + rect.width * fraction, rect.top + rect.height / 2);
          if (index === 0) timelineCanvas.dispatchEvent(event);
          else document.dispatchEvent(event);
        } else if (operation === 'animation' && index === 0) {
          startAnimation();
        }
        const after = performance.now();
        if (previous !== null) intervals.push(timestamp - previous);
        work.push(after - before);
        previous = timestamp;
        index += 1;
        if (index < frames) requestAnimationFrame(tick);
        else finish();
      } catch (error) {
        reject(error);
      }
    };

    requestAnimationFrame(tick);
  }), { operation, input, frames: SAMPLE_FRAMES });
}

function summarize({ intervals, work }) {
  const sortedIntervals = [...intervals].sort((left, right) => left - right);
  const sortedWork = [...work].sort((left, right) => left - right);
  const percentile = (values, ratio) => values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageInterval = mean(sortedIntervals);

  return {
    frames: intervals.length,
    averageFps: averageInterval === 0 ? 0 : 1000 / averageInterval,
    averageIntervalMs: averageInterval,
    p95FrameMs: percentile(sortedIntervals, 0.95),
    longFrameRatio: intervals.filter(interval => interval > FRAME_BUDGET_MS).length / intervals.length,
    p95WorkMs: percentile(sortedWork, 0.95)
  };
}

for (const profile of profiles) {
  test.describe(`${profile.name} viewport rendering performance`, () => {
    test.use({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      deviceScaleFactor: 1,
      timezoneId: 'UTC'
    });

    test.beforeEach(async ({ page }) => {
      await loadApp(page);
    });

    for (const scenario of scenarios) {
      test(`${scenario.name} stays within the frame-time budget`, async ({ page }, testInfo) => {
        const raw = await measureFrames(page, scenario.operation, profile.input);
        const summary = summarize(raw);

        await testInfo.attach(`${profile.name}-${scenario.operation}.json`, {
          body: JSON.stringify(summary, null, 2),
          contentType: 'application/json'
        });
        console.log(`[performance] ${profile.name} ${scenario.name}: ${summary.averageFps.toFixed(1)} FPS, p95 ${summary.p95FrameMs.toFixed(1)} ms`);

        expect(summary.frames).toBeGreaterThanOrEqual(SAMPLE_FRAMES - 2);
        expect(summary.p95FrameMs).toBeLessThanOrEqual(FRAME_BUDGET_MS);
        expect(summary.longFrameRatio).toBeLessThanOrEqual(MAX_LONG_FRAME_RATIO);
        if (scenario.operation === 'animation') expect(raw.animationAdvanced).toBe(true);
      });
    }
  });
}
