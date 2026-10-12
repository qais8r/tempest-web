import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { contentFixture } from './helpers/content-fixture.mjs';

const run = promisify(execFile);

test('production generates uncropped artwork copies, preserves originals, and excludes drafts', async (t) => {
  const content = await contentFixture(t, {
    authors: [{ slug: 'writer', name: 'Writer', status: 'published' }],
    works: [
      {
        slug: 'art',
        title: 'Art',
        issue: '2026',
        author: 'writer',
        category: 'Art',
        status: 'published',
        artworks: [
          { image: '/media/images/art.png', alt: 'Artwork' },
          { image: '/media/images/art.png', alt: 'Repeated artwork' },
          { image: '/media/images/vector.svg', alt: 'Vector artwork' },
        ],
      },
      {
        slug: 'draft',
        title: 'Draft',
        issue: '2026',
        author: 'writer',
        category: 'Art',
        status: 'draft',
        artworks: [{ image: '/media/images/draft.png', alt: 'Draft artwork' }],
      },
    ],
  });
  const output = await mkdtemp(path.join(tmpdir(), 'tempest-artwork-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(content, 'media/images'), { recursive: true });
  await mkdir(path.join(content, 'media/pdfs'), { recursive: true });
  const image = createCanvas(1200, 800);
  image.getContext('2d').fillRect(0, 0, 1200, 800);
  const original = image.toBuffer('image/png');
  await writeFile(path.join(content, 'media/images/art.png'), original);
  await writeFile(path.join(content, 'media/images/draft.png'), original);
  await writeFile(
    path.join(content, 'media/images/vector.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  );
  await copyFile('content/media/pdfs/2026.pdf', path.join(content, 'media/pdfs/2026.pdf'));
  await symlink(path.resolve('node_modules'), path.join(output, 'node_modules'), 'dir');
  await run(process.execPath, [path.resolve('scripts/prepare.mjs')], {
    cwd: output,
    env: { ...process.env, CONTENT_DIR: content },
  });
  const generated = JSON.parse(
    await readFile(path.join(output, 'src/generated/content.json'), 'utf8'),
  );
  const [first, second, vector] = generated.works[0].artworks;
  assert.deepEqual(
    first.sources.map(({ width }) => width),
    [480, 768, 1024, 1200],
  );
  assert.deepEqual(first.sources, second.sources);
  for (const source of first.sources) {
    const decoded = await loadImage(path.join(output, 'public', source.src));
    assert.deepEqual(
      [decoded.width, decoded.height],
      [source.width, Math.round((source.width * 2) / 3)],
    );
  }
  assert.equal(
    (await readdir(path.join(output, 'public/media/artworks'))).length,
    first.sources.length,
  );
  assert.deepEqual(await readFile(path.join(output, 'public/media/images/art.png')), original);
  assert.equal(vector.sources, undefined);
  await access(path.join(output, 'public/media/images/vector.svg'));
  await assert.rejects(access(path.join(output, 'public/media/images/draft.png')), {
    code: 'ENOENT',
  });
  assert.equal(generated.works.length, 1);
});
