import { test, expect } from '@playwright/test';

const scrollTo = (page, top) =>
  page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), top);

for (const [width, compactHeight] of [
  [1280, 64],
  [320, 56],
]) {
  test(`the masthead compacts without shifting the page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);

    const masthead = page.getByRole('banner');
    const wordmark = masthead.getByRole('link', { name: 'The Tempest home' });
    const nav = masthead.getByRole('navigation', { name: 'Main navigation' });
    const measure = () => masthead.boundingBox();
    const expanded = await measure();
    const mainTop = (await page.getByRole('main').boundingBox()).y;

    await scrollTo(page, 100);
    await expect
      .poll(async () => Math.round((await measure()).height))
      .toBe(Math.round(expanded.height) - 100);
    const movingLogo = await wordmark.boundingBox();
    const movingNav = await nav.boundingBox();
    expect(
      movingLogo.x + movingLogo.width <= movingNav.x ||
        movingLogo.y + movingLogo.height <= movingNav.y,
    ).toBe(true);

    await scrollTo(page, 400);
    await expect.poll(async () => (await measure()).height).toBe(compactHeight);
    expect((await measure()).y).toBe(0);
    expect((await page.getByRole('main').boundingBox()).y).toBeCloseTo(mainTop - 400, 0);
    expect(await nav.getByRole('link').allTextContents()).toEqual(['Issues', 'Authors', 'About']);
    await expect(nav).toBeInViewport({ ratio: 1 });

    await wordmark.click();
    await expect.poll(async () => (await measure()).height).toBe(expanded.height);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('reduced motion switches sizes without interpolating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const masthead = page.getByRole('banner');
  const expanded = await masthead.boundingBox();
  await scrollTo(page, 75);
  expect((await masthead.boundingBox()).height).toBe(expanded.height);
  await scrollTo(page, 400);
  await expect(masthead).toHaveCSS('height', '64px');
});
