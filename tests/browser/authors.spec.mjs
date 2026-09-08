import { test, expect } from '@playwright/test';

test('author cards omit redundant metadata and align their bottom rules', async ({ page }) => {
  await page.goto('authors/');

  const cards = page.locator('.author-directory-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('Author profile', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1 work', { exact: true })).toHaveCount(1);
  await expect(page.getByText('2 works', { exact: true })).toHaveCount(2);
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
