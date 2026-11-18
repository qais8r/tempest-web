import { test, expect } from '@playwright/test';

test('the desktop sidebar stays in view while the work scrolls', async ({ page }) => {
  await page.goto('works/anatomy-of-quiet/');

  const sidebar = page.locator('.work-margin');
  const start = await sidebar.evaluate((element) => element.getBoundingClientRect().top);
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start);
  const pinned = await sidebar.boundingBox();

  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start + 64);
  const scrolled = await sidebar.boundingBox();

  expect(pinned.y).toBeGreaterThan(0);
  expect(scrolled.y).toBeCloseTo(pinned.y, 0);
  await expect(sidebar).toBeInViewport({ ratio: 1 });
});

test('sidebar links remain reachable on short desktop screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await page.goto('works/shared-study/');

  const sidebar = page.locator('.work-margin');
  const lastLink = sidebar.getByRole('link').last();
  await lastLink.focus();

  await expect(lastLink).toBeInViewport({ ratio: 0.99 });
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('the mobile sidebar follows the work in the page flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('works/anatomy-of-quiet/');

  const sidebar = page.locator('.work-margin');
  const body = page.locator('.work-body');
  const sidebarBox = await sidebar.boundingBox();
  const bodyBox = await body.boundingBox();

  await expect(sidebar).toHaveCSS('position', 'static');
  expect(sidebarBox.y).toBeGreaterThan(bodyBox.y + bodyBox.height);
});

test('artwork comes before writing when a work includes both', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const contentOrder = await page
    .locator('.work-body > .work-art, .work-body > .prose')
    .evaluateAll((elements) =>
      elements.map((element) => (element.classList.contains('work-art') ? 'artwork' : 'writing')),
    );

  expect(contentOrder).toEqual(['artwork', 'writing']);
});

test('audio comes before writing when a work includes both', async ({ page }) => {
  await page.goto('works/anatomy-of-quiet/');

  const contentOrder = await page
    .locator('.work-body > .audio-section, .work-body > .poem')
    .evaluateAll((elements) =>
      elements.map((element) =>
        element.classList.contains('audio-section') ? 'audio' : 'writing',
      ),
    );

  expect(contentOrder).toEqual(['audio', 'writing']);
});

test('work author links fade to red on hover', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const author = page.locator('.work-author a').first();
  await expect(author).toHaveCSS('color', 'rgb(21, 21, 21)');

  await author.hover();

  await expect(author).toHaveCSS('color', 'rgb(123, 31, 37)');
  await expect(author).toHaveCSS('transition-duration', '0.2s');
});

test('back links use a left-facing arrow that moves left', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const link = page.locator('.breadcrumb');
  const arrow = link.locator('svg');
  await expect(arrow).toHaveCount(1);
  const restingTransform = await arrow.evaluate((element) => getComputedStyle(element).transform);

  await link.hover();

  await expect(arrow).not.toHaveCSS('transform', restingTransform);
  await expect(arrow).toHaveCSS('transition-duration', '0.2s');
});

test('work pages link to every other work by the author', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const section = page.locator('.more-by-author');
  await expect(section).toHaveCount(1);
  await expect(section.locator('h2')).toHaveText('More by Riley Chen');
  await expect(section.locator('li')).toHaveCount(4);
  await expect(section.locator('a[href$="/the-light-we-leave/"]')).toHaveCount(0);
});

test('long more-by titles truncate to one line', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const title = page.locator('.more-by-author a span').first();
  await expect(title).toHaveCSS('white-space', 'nowrap');
  await expect(title).toHaveCSS('overflow', 'hidden');
  await expect(title).toHaveCSS('text-overflow', 'ellipsis');
  const heights = await title.evaluate((element) => ({
    title: element.getBoundingClientRect().height,
    line: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(heights.title).toBeCloseTo(heights.line, 0);
});

test('more-by links use the animated red title underline', async ({ page }) => {
  await page.goto('works/the-light-we-leave/');

  const link = page.locator('.more-by-author a').first();
  const title = link.locator('span');
  await expect(title).toHaveCSS('text-decoration-color', 'rgba(0, 0, 0, 0)');

  await link.hover();

  await expect(title).toHaveCSS('text-decoration-color', 'rgb(123, 31, 37)');
  await expect(title).toHaveCSS('transition-duration', '0.2s');
});

test('coauthored work pages show more work by each contributor', async ({ page }) => {
  await page.goto('works/shared-study/');

  const sections = page.locator('.more-by-author');
  await expect(sections).toHaveCount(2);
  await expect(sections.locator('h2')).toHaveText(['More by Jordan Kim', 'More by Riley Chen']);
  await expect(sections.locator('li')).toHaveCount(7);
  await expect(sections.locator('a[href$="/shared-study/"]')).toHaveCount(0);
});
