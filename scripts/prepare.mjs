import { mkdir, readFile, writeFile, copyFile, rm, cp, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createCanvas, DOMMatrix, ImageData, Path2D, loadImage } from '@napi-rs/canvas';
import { loadContent, referencedMedia, mediaPath } from './content.mjs';
import {
  imageVariants,
  coverWidths,
  thumbnailWidths,
  portraitWidths,
  artworkWidths,
  isAnimatedPng,
} from './images.mjs';

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const root = path.resolve(process.env.CONTENT_DIR || 'content');
const data = await loadContent(root, process.argv.includes('--preview'));
const resizableImage = /\.(jpe?g|png)$/i;
const portraitMedia = new Set(
  data.authors.map((author) => author.portrait).filter((url) => resizableImage.test(url)),
);
const originalMedia = new Set(
  data.works.flatMap((work) => [
    ...work.artworks.map((art) => art.image),
    ...work.recordings.map((recording) => recording.file),
  ]),
);
const publicSources = (variants) =>
  variants.map(({ file, width }) => ({ src: `/${file.slice('public/'.length)}`, width }));
const coverVersion = createHash('sha256');
for (const file of [
  import.meta.url,
  new URL('./images.mjs', import.meta.url),
  new URL('../package-lock.json', import.meta.url),
])
  coverVersion.update(await readFile(new URL(file)));
const coverSettings = coverVersion.digest('hex');
await mkdir('.cache/covers', { recursive: true });
await rm('public/media', { recursive: true, force: true });
await rm('public/issues', { recursive: true, force: true });
await mkdir('public/media/covers', { recursive: true });
for (const url of referencedMedia(data)) {
  if (portraitMedia.has(url) && !originalMedia.has(url)) continue;
  const source = mediaPath(root, url);
  const size = (await stat(source)).size;
  if (size > 100 * 1024 * 1024) throw new Error(`${url} exceeds GitHub's 100 MiB file limit`);
  if (size > 25 * 1024 * 1024)
    throw new Error(
      `${url} exceeds the 25 MiB deployment limit. Optimize the file before uploading.`,
    );
  const target = path.join('public', url);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

const portraits = new Map();
for (const author of data.authors) {
  if (!resizableImage.test(author.portrait)) continue;
  if (!portraits.has(author.portrait)) {
    const image = await loadImage(mediaPath(root, author.portrait));
    const id = createHash('sha256').update(author.portrait).digest('hex').slice(0, 16);
    await mkdir('public/media/portraits', { recursive: true });
    const variants = await imageVariants(image, `public/media/portraits/${id}`, portraitWidths);
    portraits.set(author.portrait, publicSources(variants));
  }
  author.portraitSources = portraits.get(author.portrait);
}

for (const issue of data.issues) {
  const bytes = await readFile(mediaPath(root, issue.pdf));
  const hash = createHash('sha256').update(coverSettings).update(bytes).digest('hex');
  const cached = `.cache/covers/${hash}`;
  let meta;
  try {
    meta = JSON.parse(await readFile(`${cached}.json`, 'utf8'));
    await stat(`${cached}.jpg`);
    for (const image of meta.sources) await stat(`${cached}-${image.width}.webp`);
  } catch {
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      wasmUrl: path.resolve('node_modules/pdfjs-dist/wasm') + '/',
      isEvalSupported: false,
      standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
    });
    const doc = await task.promise;
    const first = await doc.getPage(1);
    const viewport = first.getViewport({ scale: 1050 / first.getViewport({ scale: 1 }).width });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await first.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    await writeFile(`${cached}.jpg`, canvas.toBuffer('image/jpeg', 88));
    const variants = await imageVariants(canvas, cached, coverWidths);
    meta = {
      pages: doc.numPages,
      width: viewport.width,
      height: viewport.height,
      sources: variants.map(({ width, height }) => ({ width, height })),
    };
    await writeFile(`${cached}.json`, JSON.stringify(meta));
    await task.destroy();
  }
  issue.cover = `/media/covers/${issue.year}.jpg`;
  issue.pageCount = meta.pages;
  issue.fileSize = `${(bytes.length / (1024 * 1024)).toFixed(1)} MB`;
  issue.pageRatio = meta.width / meta.height;
  issue.coverWidth = Math.ceil(meta.width);
  issue.coverHeight = Math.ceil(meta.height);
  await copyFile(`${cached}.jpg`, `public${issue.cover}`);
  issue.coverSources = [];
  for (const image of meta.sources) {
    const src = `/media/covers/${issue.year}-${image.width}.webp`;
    await copyFile(`${cached}-${image.width}.webp`, `public${src}`);
    issue.coverSources.push({ src, width: image.width });
  }
  for (const section of issue.sections)
    if (section.page > meta.pages)
      throw new Error(`${issue.year}: ${section.title} points past the last PDF page`);
}
// Only included works reach this step, so drafts cannot leave display copies behind.
const thumbnails = new Map();
const artworks = new Map();
for (const work of data.works) {
  for (const [index, art] of work.artworks.entries()) {
    // Preserve vector and animated formats without flattening or rasterizing them.
    if (!resizableImage.test(art.image)) continue;
    const image = await loadImage(mediaPath(root, art.image));
    art.width = image.width;
    art.height = image.height;
    const id = createHash('sha256').update(art.image).digest('hex').slice(0, 16);
    const animated =
      /\.png$/i.test(art.image) && isAnimatedPng(await readFile(mediaPath(root, art.image)));
    if (!animated && !artworks.has(art.image)) {
      await mkdir('public/media/artworks', { recursive: true });
      const variants = await imageVariants(image, `public/media/artworks/${id}`, artworkWidths);
      artworks.set(art.image, publicSources(variants));
    }
    if (!animated) art.sources = artworks.get(art.image);
    if (index !== 0) continue;
    if (!thumbnails.has(art.image)) {
      await mkdir('public/media/thumbnails', { recursive: true });
      const variants = await imageVariants(
        image,
        `public/media/thumbnails/${id}`,
        thumbnailWidths,
        true,
      );
      thumbnails.set(art.image, publicSources(variants));
    }
    art.thumbnailSources = thumbnails.get(art.image);
  }
}
for (const work of data.works) {
  const issue = data.issues.find((i) => i.year === work.issue);
  if (work.pdfPage && work.pdfPage > issue.pageCount)
    throw new Error(`${work.slug}: PDF page exceeds ${issue.pageCount}`);
}
// Preserve the original 2026 PDF URL without exposing an unpublished issue.
const legacyIssue = data.issues.find((i) => i.year === '2026');
if (legacyIssue) {
  await mkdir('public/issues/2026', { recursive: true });
  await copyFile(mediaPath(root, legacyIssue.pdf), 'public/issues/2026/tempest-2026.pdf');
}
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/content.json', JSON.stringify(data, null, 2));
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`node_modules/pdfjs-dist/${dir}`, `public/pdf-assets/${dir}`, { recursive: true });
}
await writeFile('public/.nojekyll', '');
console.log(
  `Prepared ${data.issues.length} issues, ${data.works.length} works, ${data.authors.length} authors (${data.preview ? 'preview, includes drafts' : 'published only'}).`,
);
