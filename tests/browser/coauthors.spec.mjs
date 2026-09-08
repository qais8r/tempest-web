import { test, expect } from './transitions.fixture.mjs';

test('coauthors retain credit order, profile contributions, and navigation in both directions', async ({
  page,
  transitions,
}) => {
  await transitions.visit('works/shared-study/');
  await expect(page.locator('.work-author')).toHaveText('by Jordan Kim and Riley Chen');
  await expect(page.locator('.author-teaser')).toHaveCount(2);
  await expect(page.locator('.poem em')).toHaveText('shared');
  await expect(page.locator('.poem strong')).toHaveText('second');
  await expect(page.locator('.poem')).toHaveCSS('text-align', 'center');
  await expect(page.locator('.poem')).toHaveCSS('white-space', 'pre-wrap');
  for (const slug of ['jordan-kim', 'riley-chen']) {
    const result = await transitions.navigate(
      () => page.locator(`.work-author a[href$="/${slug}/"]`).click(),
      `authors/${slug}/`,
    );
    expect(result.outgoing.named.filter((node) => node.name === 'author-name')).toHaveLength(1);
    expect(result.incoming.named.filter((node) => node.name === 'author-name')).toHaveLength(1);
    await expect(page.locator('a[href$="/works/shared-study/"]')).toContainText(
      'by Jordan Kim and Riley Chen',
    );
    await transitions.navigate(() => page.goBack(), 'works/shared-study/');
  }
});
