import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { workExcerpt } from './text.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const year = z.string().regex(/^\d{4}$/);
// CMS references use the saved filename, so changing a title never changes a URL.
// Accept legacy IDs as well while older editorial revisions remain in Git history.
const reference = (collection) =>
  z.preprocess((value) => {
    const prefix = `content/${collection}/`;
    return typeof value === 'string' && value.startsWith(prefix) && value.endsWith('.json')
      ? value.slice(prefix.length, -5)
      : value;
  }, slug);
const optionalNumber = (schema) =>
  z.preprocess((value) => (value === '' || value == null ? null : value), schema.nullable());
const media = z
  .string()
  .refine(
    (v) =>
      !v ||
      (v.startsWith('/media/') &&
        !v.includes('..') &&
        !v.includes('\\') &&
        !v.includes('?') &&
        !v.includes('#')),
    'Choose a file in the media library',
  );
const common = {
  status: z.enum(['draft', 'published']).default('draft'),
};
export const issueSchema = z.object({
  ...common,
  year,
  description: z.string().default(''),
  pdf: media.refine((v) => v.endsWith('.pdf')),
  heroCredit: z.string().default(''),
  sections: z
    .array(z.object({ title: z.string().min(1), page: z.number().int().positive() }))
    .default([]),
});
export const authorSchema = z.object({
  ...common,
  slug,
  name: z.string().min(1),
  bio: z.string().default(''),
  portrait: media.default(''),
});
export const workSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { author, ...work } = value;
      // Legacy records keep their URLs and continue to load. New CMS records use authors.
      return { ...work, authors: work.authors ?? (author ? [author] : undefined) };
    }
    return value;
  },
  z.object({
    ...common,
    slug,
    title: z.string().min(1),
    authors: z
      .array(reference('authors'))
      .min(1)
      .refine((values) => new Set(values).size === values.length, 'Choose each author only once'),
    issue: year,
    category: z.string().min(1),
    body: z.string().default(''),
    bodyFormat: z.enum(['plain', 'markdown']).default('plain'),
    poetryAlignment: z.enum(['left', 'center']).default('left'),
    pdfPage: optionalNumber(z.number().int().positive()),
    about: z.string().default(''),
    artworks: z
      .array(
        z.object({
          image: media.refine(Boolean),
          alt: z.string().min(1),
          caption: z.string().default(''),
        }),
      )
      .default([]),
    recordings: z
      .array(
        z.object({
          file: media.refine((v) => v.endsWith('.mp3')),
          title: z
            .string()
            .nullish()
            .transform((value) => value?.trim() || ''),
          description: z.string().default(''),
        }),
      )
      .default([]),
  }),
);
const siteSchema = z.object({
  school: z.string(),
  description: z.string(),
  currentIssue: z.preprocess(
    (value) => (value === '' || value == null ? null : value),
    year.nullable(),
  ),
  tagline: z.string(),
  about: z.string(),
  editorialRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
});

async function collection(root, name, schema, optional = false) {
  let entries;
  try {
    entries = await readdir(path.join(root, name));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return [];
    throw error;
  }
  const files = entries.filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => {
      const entry = JSON.parse(await readFile(path.join(root, name, f), 'utf8'));
      // The filename is created once by Pages CMS, including a suffix for duplicate names.
      if (name !== 'issues') entry.slug = f.slice(0, -5);
      const result = schema.safeParse(entry);
      if (!result.success) throw new Error(`${name}/${f}: ${result.error.message}`);
      const id = result.data.slug || result.data.year;
      if (f !== `${id}.json`) throw new Error(`${name}/${f}: filename must match ${id}.json`);
      return result.data;
    }),
  );
}

export async function loadContent(root, preview = false) {
  const [issues, works, authors, rawSite, rawAbout] = await Promise.all([
    collection(root, 'issues', issueSchema),
    collection(root, 'works', workSchema, true),
    collection(root, 'authors', authorSchema, true),
    readFile(path.join(root, 'site.json'), 'utf8'),
    readFile(path.join(root, 'about.json'), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '{}';
      throw error;
    }),
  ]);
  const visible = (item) => preview || item.status === 'published';
  const publishedIssues = issues.filter(visible).sort((a, b) => b.year.localeCompare(a.year));
  const publishedAuthors = authors.filter(visible);
  const publishedWorks = works
    .filter(visible)
    .filter((w) => publishedIssues.some((i) => i.year === w.issue));
  for (const w of works) {
    if (!issues.some((i) => i.year === w.issue))
      throw new Error(`${w.slug}: issue ${w.issue} does not exist`);
    for (const author of w.authors) {
      if (!authors.some((a) => a.slug === author))
        throw new Error(`${w.slug}: author ${author} does not exist`);
    }
  }
  for (const w of publishedWorks) {
    if (w.authors.some((author) => !publishedAuthors.some((a) => a.slug === author)))
      throw new Error(`${w.slug}: publish the author before publishing their work`);
  }
  const site = siteSchema.parse({ ...JSON.parse(rawSite), ...JSON.parse(rawAbout) });
  if (!publishedIssues.length) throw new Error('At least one issue must be published');
  if (!publishedIssues.some((i) => i.year === site.currentIssue))
    site.currentIssue = publishedIssues[0].year;
  return {
    preview,
    site,
    issues: publishedIssues,
    works: publishedWorks
      .sort(
        (a, b) =>
          (a.pdfPage ?? Infinity) - (b.pdfPage ?? Infinity) ||
          a.title.localeCompare(b.title, 'en') ||
          a.slug.localeCompare(b.slug, 'en'),
      )
      .map((work) => ({
        ...work,
        excerpt: workExcerpt(work.body, work.bodyFormat === 'markdown' ? 'Prose' : work.category),
        recordings: work.recordings.map((recording, index) => ({
          ...recording,
          title:
            recording.title ||
            (work.recordings.length > 1 ? `Audio recording ${index + 1}` : 'Audio recording'),
        })),
      })),
    authors: publishedAuthors,
  };
}

export function referencedMedia(data) {
  return new Set(
    [
      ...data.issues.map((i) => i.pdf),
      ...data.authors.map((a) => a.portrait),
      ...data.works.flatMap((w) => [
        ...w.artworks.map((a) => a.image),
        ...w.recordings.map((a) => a.file),
      ]),
    ].filter(Boolean),
  );
}

export function mediaPath(root, url) {
  if (!url.startsWith('/media/') || url.includes('..') || url.includes('\\'))
    throw new Error('Invalid media path');
  const resolved = path.resolve(root, url.slice(1));
  if (!resolved.startsWith(path.resolve(root, 'media') + path.sep))
    throw new Error('Media must stay in the media library');
  return resolved;
}
