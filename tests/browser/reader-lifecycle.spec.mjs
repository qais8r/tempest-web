import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`reader releases animation frames and resize listeners after remounts (${reducedMotion})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      const active = new Set();
      window.requestAnimationFrame = (callback) => {
        const id = request((time) => {
          active.delete(id);
          callback(time);
        });
        active.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        active.delete(id);
        cancel(id);
      };
      const resizeListeners = new Set();
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = (type, listener, options) => {
        if (type === 'resize') resizeListeners.add(listener);
        add(type, listener, options);
      };
      window.removeEventListener = (type, listener, options) => {
        if (type === 'resize') resizeListeners.delete(listener);
        remove(type, listener, options);
      };
      window.readerLifecycle = { active, resizeListeners };
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('issues/2018/reader/?page=8');
    await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 30000 });
    await expect.poll(() => page.evaluate(() => window.readerLifecycle.active.size)).toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.readerLifecycle.resizeListeners.size))
      .toBe(2);
    for (let i = 0; i < 3; i++) {
      await page.locator('#view-toggle').click();
      await expect(page.locator('#view-toggle')).toBeEnabled();
      await expect.poll(() => page.evaluate(() => window.readerLifecycle.active.size)).toBe(0);
      await expect
        .poll(() => page.evaluate(() => window.readerLifecycle.resizeListeners.size))
        .toBe(1);
      await expect(page.locator('#continuous-pages .pdf-page[data-page="8"] canvas')).toHaveCount(
        1,
      );
      await page.locator('#view-toggle').click();
      await expect(page.locator('#view-toggle')).toBeEnabled();
      await expect.poll(() => page.evaluate(() => window.readerLifecycle.active.size)).toBe(1);
      await expect
        .poll(() => page.evaluate(() => window.readerLifecycle.resizeListeners.size))
        .toBe(2);
      await expect(page.locator('#page-range')).toHaveValue('8');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#continuous-pages')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.readerLifecycle.active.size)).toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.readerLifecycle.resizeListeners.size))
      .toBe(1);
    await expect(page.locator('#continuous-pages .pdf-page[data-page="8"] canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
