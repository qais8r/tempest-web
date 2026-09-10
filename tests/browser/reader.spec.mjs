import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

// Use the real reader and PageFlip. A controllable PDF renderer exposes queue ordering
// without depending on machine speed or the complexity of a particular PDF page.
const mockPdf = `
export const GlobalWorkerOptions = {};
const state = window.pdfTest = { renders: [], hold: null, release: null };
export const getDocument = () => ({ promise: Promise.resolve({
  numPages: 40,
  async getPage(number) { return {
    getViewport({ scale }) { return { width: 560 * scale, height: 724 * scale, scale }; },
    render() {
      state.renders.push(number);
      return { promise: state.hold === number
        ? new Promise(resolve => { state.release = () => { state.hold = null; resolve(); }; })
        : Promise.resolve() };
    },
    async getTextContent() { return { number }; }
  }; }
}) });
export class TextLayer {
  constructor(options) { this.options = options; }
  async render() { this.options.container.textContent = 'Page ' + this.options.textContentSource.number; }
}
`;
const bundled = await build({
  stdin: {
    contents: await readFile(new URL('../../src/lib/reader.ts', import.meta.url), 'utf8'),
    resolveDir: new URL('../../src/lib', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  plugins: [
    {
      name: 'controlled-pdf',
      setup(builder) {
        builder.onResolve({ filter: /^pdfjs-dist/ }, ({ path }) => ({
          path,
          namespace: 'test-pdf',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'test-pdf' }, ({ path }) => ({
          contents: path.includes('worker') ? 'export default "";' : mockPdf,
        }));
      },
    },
  ],
});

async function controlledReader(page) {
  await page.route('**/_astro/reader.*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: bundled.outputFiles[0].text,
    }),
  );
  await page.goto('issues/2018/reader/');
  await expect(page.locator('#page-range')).toBeEnabled();
  await expect(page.locator('.pdf-page[data-page="4"] canvas')).toHaveCount(1);
  await page.evaluate(() => {
    window.pdfTest.renders = [];
    window.pdfTest.hold = 8;
  });
  await jump(page, [8]);
  await expect.poll(() => page.evaluate(() => window.pdfTest.renders)).toEqual([8]);
}

async function jump(page, pages) {
  await page.locator('#page-range').evaluate((range, pages) => {
    for (const number of pages) {
      range.value = String(number);
      range.dispatchEvent(new Event('change'));
    }
  }, pages);
}

test('rapid jumps skip obsolete queued pages and render the current spread first', async ({
  page,
}) => {
  await controlledReader(page);
  await jump(page, [10, 20, 30]);
  await page.evaluate(() => window.pdfTest.release());
  await expect(page.locator('.pdf-page[data-page="33"] canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.pdfTest.renders)).toEqual([8, 30, 31, 29, 32, 28, 33]);
  await expect(page.locator('#page-range')).toHaveValue('30');
  await expect(page.locator('.page-retry')).toHaveCount(0);
});

test('returning to an inflight page renders it after its obsolete request finishes', async ({
  page,
}) => {
  await controlledReader(page);
  await jump(page, [20, 8]);
  await page.evaluate(() => window.pdfTest.release());
  await expect(page.locator('.pdf-page[data-page="8"] .textLayer')).toHaveText('Page 8');
  await expect(page.locator('.pdf-page[data-page="11"] canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.pdfTest.renders)).toEqual([8, 8, 9, 7, 10, 6, 11]);
  await expect(page.locator('#page-range')).toHaveValue('8');
});

test('real PDF navigation, continuous view, and resizing keep the selected page readable', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('issues/2018/reader/?page=8');
  await expect(page.locator('#page-range')).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.pdf-page[data-page="8"] canvas')).toHaveCount(1);
  await jump(page, [20, 10]);
  await expect(page.locator('.pdf-page[data-page="10"] canvas')).toHaveCount(1);
  await expect(page.locator('#page-range')).toHaveValue('10');
  await page.locator('#view-toggle').click();
  await expect(page.locator('#view-toggle')).toBeEnabled();
  await expect(page.locator('#continuous-pages .pdf-page[data-page="10"] canvas')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('#continuous-pages .pdf-page[data-page="10"]')
        .evaluate((node) => node.getBoundingClientRect().width),
    )
    .toBeLessThanOrEqual(390);
  await expect(page.locator('#continuous-pages .pdf-page[data-page="10"] canvas')).toHaveCount(1);
  await jump(page, [16]);
  await expect(page.locator('#continuous-pages .pdf-page[data-page="16"] canvas')).toHaveCount(1);
  await expect(page.locator('#reader-error')).toBeHidden();
  await expect(page.locator('.page-retry')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('work bookmarks link visible PDF pages to their companion works', async ({ page }) => {
  await page.goto('issues/2026/reader/?page=8');
  await expect(page.locator('#page-range')).toBeEnabled({ timeout: 30000 });

  const leftPage = page.locator('.reader-work-markers .reader-work-marker--left');
  await expect(leftPage.locator('.reader-work-tab')).toHaveCount(2);
  await expect(leftPage.locator('a[href$="/night-rounds/"]')).toHaveAttribute(
    'aria-label',
    'Read Night rounds by Alex Morgan',
  );
  await expect(leftPage.locator('a[href$="/pulse/"]')).toHaveAttribute(
    'aria-label',
    'Read Pulse by Riley Chen',
  );
  await expect(leftPage.locator('.reader-work-tab-title')).toHaveText(['Night rounds', 'Pulse']);
  const tabLayout = await leftPage
    .locator('.reader-work-tab')
    .first()
    .evaluate((tab) => {
      const style = getComputedStyle(tab);
      const title = tab.querySelector('.reader-work-tab-title').getBoundingClientRect();
      const bounds = tab.getBoundingClientRect();
      const marker = tab.closest('.reader-work-marker').getBoundingClientRect();
      const frame = document.querySelector('#book-frame').getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        topRatio: (marker.top - frame.top) / frame.height,
        titleInside: title.left >= bounds.left && title.right <= bounds.right,
        shadow: style.boxShadow,
        outerRadius: Number.parseFloat(style.borderTopLeftRadius),
        innerRadius: Number.parseFloat(style.borderTopRightRadius),
      };
    });
  expect(tabLayout.width).toBeLessThan(60);
  expect(tabLayout.height).toBeGreaterThan(26);
  expect(tabLayout.topRatio).toBeCloseTo(0.15, 2);
  expect(tabLayout.titleInside).toBe(true);
  expect(tabLayout.shadow).toBe('none');
  expect(tabLayout.outerRadius).toBeGreaterThan(0);
  expect(tabLayout.innerRadius).toBe(0);
  const cardTheme = await leftPage
    .locator('.reader-work-tab-copy')
    .first()
    .evaluate((card) => {
      const style = getComputedStyle(card);
      return {
        background: style.backgroundColor,
        color: style.color,
        leftBorder: `${style.borderLeftWidth} ${style.borderLeftColor}`,
        rightBorder: `${style.borderRightWidth} ${style.borderRightColor}`,
        shadow: style.boxShadow,
      };
    });
  expect(cardTheme.background).toBe('rgb(36, 37, 34)');
  expect(cardTheme.color).toBe('rgb(233, 228, 216)');
  expect(cardTheme.leftBorder).toBe(cardTheme.rightBorder);
  expect(cardTheme.shadow).toContain('rgba(0, 0, 0, 0.2)');
  const firstTab = leftPage.locator('.reader-work-tab').first();
  const hoverCard = firstTab.locator('.reader-work-tab-copy');
  const cardType = await hoverCard.evaluate((card) => ({
    title: Number.parseFloat(getComputedStyle(card.querySelector('strong')).fontSize),
    details: Number.parseFloat(getComputedStyle(card.querySelector('small')).fontSize),
  }));
  expect(cardType.title).toBeGreaterThan(17);
  expect(cardType.details).toBeGreaterThan(8.5);
  const arrow = hoverCard.locator('.reader-work-tab-arrow');
  await expect(arrow).toHaveCount(1);
  const arrowBefore = await arrow.evaluate((icon) => icon.getBoundingClientRect().x);
  await firstTab.hover();
  await expect(hoverCard).toBeVisible();
  await expect
    .poll(() =>
      arrow.evaluate((icon, initialX) => icon.getBoundingClientRect().x - initialX, arrowBefore),
    )
    .toBeCloseTo(0, 0);
  const safeZone = await firstTab.evaluate((tab) => {
    const tabBounds = tab.getBoundingClientRect();
    const cardBounds = tab.querySelector('.reader-work-tab-copy').getBoundingClientRect();
    return {
      x: (tabBounds.right + cardBounds.left) / 2,
      y: tabBounds.top + tabBounds.height / 2,
    };
  });
  await page.mouse.move(safeZone.x, safeZone.y, { steps: 8 });
  await page.waitForTimeout(250);
  await expect(hoverCard).toBeVisible();
  await expect
    .poll(() =>
      arrow.evaluate((icon, initialX) => icon.getBoundingClientRect().x - initialX, arrowBefore),
    )
    .toBeCloseTo(0, 0);
  await hoverCard.hover();
  await expect
    .poll(() =>
      arrow.evaluate((icon, initialX) => icon.getBoundingClientRect().x - initialX, arrowBefore),
    )
    .toBeCloseTo(3, 0);
  await page.evaluate(() => {
    window.readerMarkerMoveCount = 0;
    window.addEventListener('mousemove', () => window.readerMarkerMoveCount++);
  });
  await firstTab.hover();
  await page.evaluate(() => (window.readerMarkerMoveCount = 0));
  await hoverCard.hover();
  expect(await page.evaluate(() => window.readerMarkerMoveCount)).toBe(0);

  await page.setViewportSize({ width: 1800, height: 1200 });
  await expect
    .poll(() =>
      leftPage
        .locator('.reader-work-tab')
        .first()
        .evaluate((tab) => tab.clientWidth),
    )
    .toBeGreaterThan(tabLayout.width);
  const wideTabWidth = await leftPage
    .locator('.reader-work-tab')
    .first()
    .evaluate((tab) => tab.getBoundingClientRect().width);
  expect(wideTabWidth).toBeLessThanOrEqual(64);

  const single = page.locator('.reader-work-markers .reader-work-marker--right');
  await expect(single.locator('a[href$="/between-shifts/"]')).toHaveAttribute(
    'aria-label',
    'Read Between shifts by Jordan Kim',
  );

  await page.locator('#view-toggle').click();
  const zoomMarker = page.locator(
    '#continuous-pages .pdf-page[data-page="8"] .reader-work-marker--inside',
  );
  await expect(zoomMarker).toBeVisible();
  await expect(zoomMarker.locator('.reader-work-tab')).toHaveCount(2);
  const insetLayout = await zoomMarker
    .locator('.reader-work-tab')
    .first()
    .evaluate((tab) => {
      const pageBounds = tab.closest('.pdf-page').getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      const style = getComputedStyle(tab);
      return {
        rightGap: pageBounds.right - tabBounds.right,
        height: tabBounds.height,
        leftRadius: Number.parseFloat(style.borderTopLeftRadius),
        rightRadius: Number.parseFloat(style.borderTopRightRadius),
      };
    });
  expect(insetLayout.rightGap).toBeCloseTo(0, 0);
  expect(insetLayout.height).toBeGreaterThanOrEqual(32);
  expect(insetLayout.height).toBeLessThanOrEqual(36);
  expect(insetLayout.leftRadius).toBeGreaterThan(0);
  expect(insetLayout.rightRadius).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMarker = page.locator(
    '#continuous-pages .pdf-page[data-page="8"] .reader-work-marker--inside',
  );
  await expect(mobileMarker).toBeVisible();
  await expect(mobileMarker.locator('.reader-work-tab')).toHaveCount(2);
  const mobileInset = await mobileMarker
    .locator('.reader-work-tab')
    .first()
    .evaluate((tab) => {
      const pageBounds = tab.closest('.pdf-page').getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      return {
        rightGap: pageBounds.right - tabBounds.right,
        topGap: tabBounds.top - pageBounds.top,
      };
    });
  expect(mobileInset.rightGap).toBeCloseTo(0, 0);
  expect(mobileInset.topGap).toBeGreaterThanOrEqual(32);

  await jump(page, [20]);
  await expect(page.locator('#continuous-pages .pdf-page[data-page="20"] canvas')).toHaveCount(1);
  await expect(mobileMarker.locator('.reader-work-tab')).toHaveCount(2);
  await jump(page, [8]);
  await expect(page.locator('#continuous-pages .pdf-page[data-page="8"] canvas')).toHaveCount(1);
  await expect(mobileMarker).toBeVisible();
  await expect(mobileMarker.locator('.reader-work-tab')).toHaveCount(2);
});
