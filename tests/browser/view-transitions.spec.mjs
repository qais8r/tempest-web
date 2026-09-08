import { test, expect } from './transitions.fixture.mjs';

const work = 'works/anatomy-of-quiet/';
const author = 'authors/alex-morgan/';
const names = (event) =>
  event.named
    .map((element) => element.name)
    .filter((name) => /^(work|author)-/.test(name))
    .sort();
const paired = (result, expected) => {
  expect(names(result.outgoing)).toEqual([...expected].sort());
  expect(names(result.incoming)).toEqual([...expected].sort());
};

test('page transitions cover About, directory, archive, issues, reader, home and 404', async ({
  page,
  transitions,
}) => {
  await transitions.visit('');
  for (const [selector, path] of [
    ['.masthead a[href$="/about/"]', 'about/'],
    ['.masthead a[href$="/authors/"]', 'authors/'],
    ['.masthead a[href$="/issues/"]', 'issues/'],
    ['a[href$="/issues/2018/"]', 'issues/2018/'],
    ['.button-primary', 'issues/2018/reader/'],
    ['.exit-reader', 'issues/2018/'],
    ['.wordmark', ''],
  ]) {
    await transitions.navigate(() => page.locator(selector).first().click(), path);
  }
  await transitions.visit('404.html');
  await transitions.navigate(() => page.locator('main a').click(), 'issues/');
});

test('directory portraits and names pair with author profiles in both directions', async ({
  page,
  transitions,
}) => {
  await transitions.visit('authors/');
  paired(await transitions.navigate(() => page.locator(`a[href$="/${author}"]`).click(), author), [
    'author-name',
    'author-portrait',
  ]);
  paired(await transitions.navigate(() => page.goBack(), 'authors/'), [
    'author-name',
    'author-portrait',
  ]);
});

test('author work cards use work names on both pages and on Back', async ({
  page,
  transitions,
}) => {
  await transitions.visit(author);
  paired(await transitions.navigate(() => page.locator(`a[href$="/${work}"]`).click(), work), [
    'work-title',
    'work-author',
  ]);
  paired(await transitions.navigate(() => page.goBack(), author), ['work-title', 'work-author']);
});

for (const [selector, parts, context] of [
  ['.work-author a', ['author-name'], 'byline'],
  ['.author-teaser', ['author-name', 'author-portrait'], 'teaser'],
]) {
  test(`author ${context} returns to the same source on Back`, async ({ page, transitions }) => {
    await transitions.visit(work);
    paired(await transitions.navigate(() => page.locator(selector).click(), author), parts);
    const back = await transitions.navigate(() => page.goBack(), work);
    paired(back, parts);
    expect(back.incoming.named.every((element) => element.context === context)).toBe(true);
  });
}

test('duplicate work cards preserve the Companion works occurrence through Back and Forward', async ({
  page,
  transitions,
}) => {
  await transitions.visit('issues/2026/');
  const card = page.locator(`.issue-works a[href$="/${work}"]`);
  paired(await transitions.navigate(() => card.click(), work), ['work-title', 'work-author']);
  for (let i = 0; i < 2; i++) {
    const back = await transitions.navigate(() => page.goBack(), 'issues/2026/');
    expect(
      back.incoming.named
        .filter((element) => element.name.startsWith('work-'))
        .map((element) => element.section),
    ).toEqual(['companion', 'companion']);
    const forward = await transitions.navigate(() => page.goForward(), work);
    expect(
      forward.outgoing.named
        .filter((element) => element.name.startsWith('work-'))
        .map((element) => element.section),
    ).toEqual(['companion', 'companion']);
  }
});

test('stored work plans work without the Navigation API or pageswap activation', async ({
  page,
  transitions,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'navigation', { value: undefined });
    Object.defineProperty(PageSwapEvent.prototype, 'activation', { get: () => null });
  });
  await transitions.visit(author);
  paired(await transitions.navigate(() => page.locator(`a[href$="/${work}"]`).click(), work), [
    'work-title',
    'work-author',
  ]);
});

test('blocked storage falls back to a complete page transition', async ({ page, transitions }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Storage.prototype[method] = () => {
        throw new DOMException('Storage blocked', 'SecurityError');
      };
    }
  });
  await transitions.visit(author);
  const result = await transitions.navigate(
    () => page.locator(`a[href$="/${work}"]`).click(),
    work,
  );
  paired(result, []);
  expect(result.outgoing.root).not.toBe('none');
  expect(result.incoming.root).not.toBe('none');
});

test('reduced motion disables transitions and keeps navigation working', async ({
  page,
  transitions,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await transitions.visit(author);
  await transitions.navigate(() => page.locator(`a[href$="/${work}"]`).click(), work, {
    animated: false,
  });
});
