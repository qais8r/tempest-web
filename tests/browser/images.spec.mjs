import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`cards load sized images with the Pages prefix at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('issues/2026/');
    const hero = page.locator('.hero-image');
    await expect
      .poll(() => hero.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    expect(await hero.evaluate((img) => img.currentSrc)).toMatch(
      /\/tempest-web\/media\/covers\/2026-640\.webp$/,
    );

    await page.goto('authors/riley-chen/');
    const thumb = page.locator('a[href$="/the-light-we-leave/"] .work-thumb');
    await thumb.scrollIntoViewIfNeeded();
    await expect
      .poll(() => thumb.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const selected = await thumb.evaluate((img) => ({
      src: img.currentSrc,
      width: img.naturalWidth,
      rendered: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
    }));
    expect(selected.src).toMatch(/\/tempest-web\/media\/thumbnails\/.+-128\.webp$/);
    expect(selected.width).toBeLessThanOrEqual(128);
    expect(selected.rendered).toBeCloseTo(selected.height, 1);
    expect((await request.get(selected.src)).ok()).toBe(true);

    await page.goto('issues/');
    const cover = page.locator('.archive-cover img').first();
    await cover.scrollIntoViewIfNeeded();
    await expect
      .poll(() => cover.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const coverSrc = await cover.evaluate((img) => img.currentSrc);
    expect(coverSrc).toMatch(/\/tempest-web\/media\/covers\/2026-320\.webp$/);
    expect((await request.get(coverSrc)).ok()).toBe(true);
  });
}

test('artwork reserves its proportions before the original image loads', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/media/images/sample-light.jpg', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('works/the-light-we-leave/', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.work-art img').first();
  await image.scrollIntoViewIfNeeded();
  const size = await image.evaluate((img) => ({
    width: Number(img.getAttribute('width')),
    height: Number(img.getAttribute('height')),
    renderedWidth: img.getBoundingClientRect().width,
    renderedHeight: img.getBoundingClientRect().height,
  }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
  expect(size.renderedHeight).toBeCloseTo((size.renderedWidth * size.height) / size.width, 0);
  release();
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await image.evaluate((img) => img.getBoundingClientRect().height)).toBeCloseTo(
    size.renderedHeight,
    0,
  );
});

test('the About cover keeps its proportions at wide viewports', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto('about/');
  const cover = page.locator('.about-layout figure img');
  await expect
    .poll(() => cover.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  const size = await cover.evaluate((img) => {
    const rect = img.getBoundingClientRect();
    return {
      width: Number(img.getAttribute('width')),
      height: Number(img.getAttribute('height')),
      renderedWidth: rect.width,
      renderedHeight: rect.height,
    };
  });
  expect(size.renderedWidth / size.renderedHeight).toBeCloseTo(size.width / size.height, 2);
  expect(size.renderedHeight).toBeLessThanOrEqual(46 * 16 + 1);
});
