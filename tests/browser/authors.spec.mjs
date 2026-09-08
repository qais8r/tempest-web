import { test, expect } from '@playwright/test';

test('author cards omit redundant metadata and align their bottom rules', async ({ page }) => {
  await page.goto('authors/');

  const cards = page.locator('.author-directory-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('Author profile', { exact: true })).toHaveCount(0);
  await expect(page.getByText('4 works', { exact: true })).toHaveCount(2);
  await expect(page.getByText('5 works', { exact: true })).toHaveCount(1);
  await expect
    .poll(() =>
      cards
        .first()
        .locator('h3')
        .evaluate((heading) => getComputedStyle(heading).textWrap),
    )
    .toBe('balance');

  await cards
    .first()
    .locator('h3')
    .evaluate((heading) => {
      heading.textContent = 'Alexandria Catherine Morgan';
    });

  const ruleBottoms = await cards
    .locator('.directory-name')
    .evaluateAll((names) => names.map((name) => name.getBoundingClientRect().bottom));
  expect(new Set(ruleBottoms.map(Math.round)).size).toBe(1);
});

test('author work previews fill the copy column beside artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('authors/riley-chen/');

  const widths = await page
    .locator('a[href$="/the-light-we-leave/"] .work-card-copy')
    .evaluate((copy) => ({
      copy: copy.getBoundingClientRect().width,
      excerpt: copy.querySelector('.work-excerpt').getBoundingClientRect().width,
    }));

  expect(widths.excerpt).toBeCloseTo(widths.copy, 1);
});
