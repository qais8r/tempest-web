import { test, expect } from '@playwright/test';

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
