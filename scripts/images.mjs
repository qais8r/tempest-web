import { writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';

export const coverWidths = [320, 640, 800, 1050];
export const thumbnailWidths = [128, 256, 384];
export const artworkWidths = [480, 768, 1024, 1536, 2048];
export const portraitWidths = [128, 256, 384, 512, 768, 1024, 1280];

// APNG uses the .png extension too. Do not replace animated artwork with a still.
export function isAnimatedPng(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (offset + length + 12 > bytes.length) return false;
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += length + 12;
  }
  return false;
}

// Keep originals intact. Only generated display copies are resized or cropped.
export async function imageVariants(image, prefix, widths, square = false) {
  const sourceWidth = square ? Math.min(image.width, image.height) : image.width;
  const sourceHeight = square ? sourceWidth : image.height;
  const variants = [];
  for (const width of [...new Set(widths.map((w) => Math.min(w, sourceWidth)))]) {
    const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (image.width - sourceWidth) / 2,
      (image.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
    const file = `${prefix}-${width}.webp`;
    await writeFile(file, await canvas.encode('webp', 85));
    variants.push({ file, width, height });
  }
  return variants;
}
