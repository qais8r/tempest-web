import { test, expect } from '@playwright/test';

const scrollTo = (page, top) =>
  page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), top);

for (const [width, compactHeight, useFallback] of [
  [1280, 64],
  [320, 56],
  [390, 56],
  [390, 56, true],
]) {
  const mode = useFallback ? ' with the scroll timeline fallback' : '';
  test(`the masthead compacts without shifting the page at ${width}px${mode}`, async ({ page }) => {
    if (useFallback) {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'ScrollTimeline', { value: undefined });
      });
    }
    await page.setViewportSize({ width, height: 850 });
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);

    const masthead = page.getByRole('banner');
    const wordmark = masthead.getByRole('link', { name: 'The Tempest home' });
    const nav = masthead.getByRole('navigation', { name: 'Main navigation' });
    const visibleHeight = async () => {
      const { y, height } = await masthead.boundingBox();
      return Math.round(height + Math.min(0, y));
    };
    const expanded = await visibleHeight();
    const mainTop = (await page.getByRole('main').boundingBox()).y;

    await scrollTo(page, 100);
    await expect.poll(visibleHeight).toBe(expanded - 100);
    const movingLogo = await wordmark.boundingBox();
    for (const link of await nav.getByRole('link').all()) {
      const movingLink = await link.boundingBox();
      expect(
        movingLogo.x + movingLogo.width <= movingLink.x ||
          movingLogo.y + movingLogo.height <= movingLink.y,
      ).toBe(true);
    }

    await scrollTo(page, 400);
    await expect.poll(visibleHeight).toBe(compactHeight);
    expect((await masthead.boundingBox()).y).toBeLessThanOrEqual(0);
    expect((await page.getByRole('main').boundingBox()).y).toBeCloseTo(mainTop - 400, 0);
    expect(await nav.getByRole('link').allTextContents()).toEqual(['Issues', 'Authors', 'About']);
    for (const link of await nav.getByRole('link').all()) {
      await expect(link).toBeInViewport({ ratio: 1 });
      expect((await link.boundingBox()).height).toBeCloseTo(44, 0);
      expect(
        await link.evaluate((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(x + width / 2, y + height / 2));
        }),
      ).toBe(true);
    }

    const compactLogo = await wordmark.boundingBox();
    await page.mouse.click(
      compactLogo.x + compactLogo.width / 2,
      compactLogo.y + compactLogo.height / 2,
    );
    await expect(page).toHaveURL(/#top$/);
    await expect.poll(visibleHeight).toBe(expanded);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

for (const [width, compactHeight] of [
  [1280, '64px'],
  [390, '56px'],
]) {
  test(`reduced motion switches sizes without interpolating at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const masthead = page.getByRole('banner');
    const expanded = await masthead.boundingBox();
    await scrollTo(page, 75);
    expect((await masthead.boundingBox()).height).toBe(expanded.height);
    await scrollTo(page, 400);
    await expect(masthead).toHaveCSS('height', compactHeight);
  });
}
