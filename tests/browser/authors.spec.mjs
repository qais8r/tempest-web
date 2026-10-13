import { test, expect } from '@playwright/test';

test('author search filters names as you type and clears without leaving the page', async ({
  page,
}) => {
  await page.goto('authors/');

  const search = page.getByRole('searchbox', { name: 'Search authors' });
  const cards = page.locator('.author-directory-card:visible');
  const count = page.getByRole('status');
  const clear = page.getByRole('button', { name: 'Clear search' });
  await expect(search).toBeVisible();
  await expect(count).toHaveText('3 authors');
  await expect(clear).toBeHidden();

  await search.fill('  CHEN   ríl  ');
  await expect(cards).toHaveCount(1);
  await expect(cards.locator('h3')).toHaveText('Riley Chen');
  await expect(count).toHaveText('1 of 3 authors');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/authors\/$/);

  await clear.click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(cards).toHaveCount(3);
  await expect(count).toHaveText('3 authors');
  await expect(clear).toBeHidden();

  await search.fill('Morgan');
  await expect(cards).toHaveCount(1);
  await expect(cards.locator('h3')).toHaveText('Alex Morgan');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(cards).toHaveCount(3);
});

test('author search offers an empty state and recovers when the query changes', async ({
  page,
}) => {
  await page.goto('authors/');

  const search = page.getByRole('searchbox', { name: 'Search authors' });
  const empty = page.getByText('No authors found. Try another name.');
  await expect(empty).toBeHidden();
  await search.fill('nonexistent contributor');
  await expect(page.getByRole('status')).toHaveText('0 of 3 authors');
  await expect(empty).toBeVisible();
  await expect(page.locator('.author-directory-grid')).toBeHidden();

  await search.fill('Kim');
  await expect(page.locator('.author-directory-card:visible h3')).toHaveText('Jordan Kim');
  await expect(empty).toBeHidden();
  await search.fill('   ');
  await expect(page.locator('.author-directory-card:visible')).toHaveCount(3);
  await expect(page.getByRole('status')).toHaveText('3 authors');
});

test('author search stays consistent after returning from an author profile', async ({ page }) => {
  await page.goto('authors/');
  const search = page.getByRole('searchbox', { name: 'Search authors' });
  await search.fill('Morgan');
  await page.locator('.author-directory-card:visible').click();
  await expect(page).toHaveURL(/\/authors\/alex-morgan\/$/);
  await page.goBack();
  await expect(search).toBeVisible();

  const restored = await search.inputValue();
  await expect(page.locator('.author-directory-card:visible')).toHaveCount(restored ? 1 : 3);
  await expect(page.getByRole('status')).toHaveText(restored ? '1 of 3 authors' : '3 authors');
  await search.fill('Chen');
  await expect(page.locator('.author-directory-card:visible h3')).toHaveText('Riley Chen');
});

test('author search sits beside the desktop title and below it on mobile', async ({ page }) => {
  for (const width of [1280, 768, 720, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('authors/');
    await expect(page.getByRole('searchbox', { name: 'Search authors' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => {
      const title = document.querySelector('#authors-title').getBoundingClientRect();
      const field = document.querySelector('.author-search-field').getBoundingClientRect();
      const count = document.querySelector('.archive-count').getBoundingClientRect();
      const heading = document.querySelector('.author-directory-heading').getBoundingClientRect();
      return {
        title: { right: title.right, bottom: title.bottom },
        field: { left: field.left, right: field.right, top: field.top, bottom: field.bottom },
        count: { top: count.top, bottom: count.bottom },
        heading: { left: heading.left, right: heading.right },
        columns: getComputedStyle(
          document.querySelector('.author-directory-grid'),
        ).gridTemplateColumns.split(' ').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.overflow).toBe(false);
    if (width > 720) {
      expect(layout.field.left).toBeGreaterThan(layout.title.right);
      expect(layout.count.bottom).toBeLessThan(layout.field.top);
    } else {
      expect(layout.field.top).toBeGreaterThan(layout.title.bottom);
      expect(layout.field.left).toBeCloseTo(layout.heading.left, 0);
      expect(layout.field.right).toBeCloseTo(layout.heading.right, 0);
      expect(layout.count.top).toBeGreaterThan(layout.field.bottom);
      expect(layout.columns).toBe(2);
    }
  }
});

test.describe('author directory without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps all author links available', async ({ page }) => {
    await page.goto('authors/');
    await expect(page.locator('.author-directory-card:visible')).toHaveCount(3);
    await expect(page.getByRole('status')).toHaveText('3 authors');
    await expect(page.getByRole('searchbox', { name: 'Search authors' })).toBeHidden();
    await expect(page.getByText('No authors found. Try another name.')).toBeHidden();
  });
});

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

test('work-card hover underlines the title and gently zooms the clipped image', async ({
  page,
}) => {
  await page.goto('authors/riley-chen/');

  const card = page.locator('a[href$="/the-light-we-leave/"]');
  const title = card.locator('h3');
  const frame = card.locator('.work-thumb-frame');
  const image = card.locator('.work-thumb');
  await expect(title).toHaveCSS('text-decoration-color', 'rgba(0, 0, 0, 0)');
  await expect(frame).toHaveCSS('overflow', 'hidden');
  await expect(image).toHaveCSS('transform', 'none');
  const frameBefore = await frame.evaluate(({ offsetWidth, offsetHeight }) => ({
    width: offsetWidth,
    height: offsetHeight,
  }));

  await card.hover();

  await expect(title).toHaveCSS('text-decoration-color', 'rgb(123, 31, 37)');
  await expect(image).toHaveCSS('transform', 'matrix(1.015, 0, 0, 1.015, 0, 0)');
  expect(
    await frame.evaluate(({ offsetWidth, offsetHeight }) => ({
      width: offsetWidth,
      height: offsetHeight,
    })),
  ).toEqual(frameBefore);
});
