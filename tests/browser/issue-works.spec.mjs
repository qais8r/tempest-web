import { test, expect } from '@playwright/test';

test('the homepage and issue use the same daily featured works', async ({ page }) => {
  const featuredLinks = () =>
    page
      .locator('.featured-works .work-card-link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

  await page.goto('');
  const homepage = await featuredLinks();
  await page.goto('issues/2026/');
  const issue = await featuredLinks();

  expect(homepage).toHaveLength(3);
  expect(issue).toEqual(homepage);
});

test('work excerpts fill and clamp to three lines', async ({ page }) => {
  await page.setViewportSize({ width: 481, height: 900 });
  await page.goto('issues/2026/');
  const excerpt = page.locator('.issue-works a[href$="/between-shifts/"] .work-excerpt');
  const metrics = await excerpt.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      characters: element.textContent.length,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      clamp: style.webkitLineClamp,
    };
  });

  expect(metrics.characters).toBeGreaterThan(120);
  expect(metrics.clamp).toBe('3');
  expect(metrics.clientHeight).toBeCloseTo(metrics.lineHeight * 3, 0);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});

test('medium companion-work columns flow independently without row gaps', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('issues/2026/');

  const layout = await page.locator('.issue-works .work-grid').evaluate((grid) => ({
    columnCount: getComputedStyle(grid).columnCount,
    groupDisplay: getComputedStyle(grid.querySelector('.work-column')).display,
  }));
  expect(layout).toEqual({ columnCount: '2', groupDisplay: 'contents' });

  const gaps = await page.locator('.issue-works .work-card-column').evaluateAll((cards) => {
    const columns = new Map();
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const left = Math.round(rect.left);
      const column = columns.get(left) || [];
      column.push(rect);
      columns.set(left, column);
    }
    return [...columns.values()].flatMap((column) => {
      column.sort((a, b) => a.top - b.top);
      return column.slice(1).map((card, index) => card.top - column[index].bottom);
    });
  });
  expect(Math.max(...gaps)).toBeLessThan(40);
});

test('medium one-column thumbnails match compact cards without changing desktop crops', async ({
  page,
}) => {
  const image = '.issue-works a[href$="/the-light-we-leave/"] .work-thumb';

  await page.setViewportSize({ width: 561, height: 900 });
  await page.goto('issues/2026/');
  const medium = await page.locator(image).evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  });
  expect(medium.width / medium.height).toBeCloseTo(1, 2);

  await page.goto('authors/riley-chen/');
  const compact = await page
    .locator('a[href$="/the-light-we-leave/"] .work-thumb')
    .evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
  expect(medium.width).toBeCloseTo(compact.width, 1);
  expect(medium.height).toBeCloseTo(compact.height, 1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('issues/2026/');
  const wideRatio = await page.locator(image).evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return width / height;
  });
  expect(wideRatio).toBeCloseTo(1.6, 2);
});
