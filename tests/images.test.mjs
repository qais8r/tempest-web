import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { imageVariants, portraitWidths, isAnimatedPng } from '../scripts/images.mjs';

test('animation detection reads PNG chunks rather than incidental compressed bytes', () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type, data) => {
    const bytes = Buffer.alloc(12 + data.length);
    bytes.writeUInt32BE(data.length);
    bytes.write(type, 4, 4, 'ascii');
    data.copy(bytes, 8);
    return bytes;
  };
  assert.equal(isAnimatedPng(Buffer.concat([signature, chunk('acTL', Buffer.alloc(8))])), true);
  assert.equal(
    isAnimatedPng(Buffer.concat([signature, chunk('IDAT', Buffer.from('acTL'))])),
    false,
  );
  assert.equal(isAnimatedPng(Buffer.concat([signature, chunk('IDAT', Buffer.alloc(0))])), false);
  assert.equal(isAnimatedPng(Buffer.from('not a PNG')), false);
  assert.equal(
    isAnimatedPng(Buffer.concat([signature, Buffer.from([255, 255, 255, 255]), Buffer.alloc(8)])),
    false,
  );
});

test('display copies preserve proportions, avoid upscaling, and crop thumbnails centrally', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tempest-images-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = createCanvas(300, 100);
  const context = source.getContext('2d');
  context.fillStyle = 'red';
  context.fillRect(0, 0, 300, 100);
  context.fillStyle = 'blue';
  context.fillRect(100, 0, 100, 100);

  const covers = await imageVariants(source, path.join(dir, 'cover'), [150, 300, 600]);
  assert.deepEqual(
    covers.map(({ width, height }) => [width, height]),
    [
      [150, 50],
      [300, 100],
    ],
  );
  for (const variant of covers) {
    const decoded = await loadImage(variant.file);
    assert.deepEqual([decoded.width, decoded.height], [variant.width, variant.height]);
  }

  const thumbs = await imageVariants(source, path.join(dir, 'thumb'), [50, 100, 200], true);
  assert.deepEqual(
    thumbs.map(({ width, height }) => [width, height]),
    [
      [50, 50],
      [100, 100],
    ],
  );
  const decoded = await loadImage(thumbs[0].file);
  const sample = createCanvas(50, 50).getContext('2d');
  sample.drawImage(decoded, 0, 0);
  const [red, green, blue] = sample.getImageData(5, 25, 1, 1).data;
  assert.ok(blue > 240 && red < 10 && green < 10, 'thumbnail uses the original center crop');
  assert.deepEqual([source.width, source.height], [300, 100]);
});

test('portrait copies cover small avatars through large profile displays', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tempest-portraits-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = createCanvas(1600, 2000);
  const variants = await imageVariants(source, path.join(dir, 'portrait'), portraitWidths);

  assert.deepEqual(
    variants.map(({ width, height }) => [width, height]),
    portraitWidths.map((width) => [width, width * 1.25]),
  );
  assert.ok(variants.every(({ file }) => file.endsWith('.webp')));
});
