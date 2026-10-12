import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchPageFlip, pageFlipLifecycle } from '../scripts/page-flip-lifecycle.mjs';

test('the pinned PageFlip bundle accepts the lifecycle patch', async () => {
  const source = await readFile('node_modules/page-flip/dist/js/page-flip.module.js', 'utf8');
  const patched = patchPageFlip(source);
  assert.ok(patched.includes('stop(){cancelAnimationFrame(this.animationFrame)}'));
  assert.ok(
    patched.includes('destroy(){this.render.stop(),this.ui.destroy(),this.block.remove()}'),
  );
  assert.throws(() => patchPageFlip(patched), /no longer matches/);
  assert.throws(() => patchPageFlip(source + source), /no longer matches/);
  const plugin = pageFlipLifecycle();
  assert.equal(plugin.transform(source, '/some/other.js'), null);
  assert.equal(
    plugin.transform(source, '/node_modules/page-flip/dist/js/page-flip.module.js').code,
    patched,
  );
});
