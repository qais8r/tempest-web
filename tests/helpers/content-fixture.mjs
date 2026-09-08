import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function contentFixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'tempest-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = {
    site: {
      title: 'Test',
      school: 'School',
      description: '',
      currentIssue: '2026',
      tagline: '',
      about: '',
      editorialRepo: 'owner/editorial',
    },
    issues: [
      {
        year: '2026',
        title: '2026',
        status: 'published',
        pdf: '/media/pdfs/2026.pdf',
      },
      { year: '2027', title: 'Secret issue', status: 'draft', pdf: '/media/pdfs/secret.pdf' },
    ],
    authors: [
      { slug: 'writer', name: 'Writer', status: 'published' },
      {
        slug: 'secret-writer',
        name: 'Private name',
        status: 'draft',
        portrait: '/media/images/secret.jpg',
      },
    ],
    works: [
      {
        slug: 'a-poem',
        title: 'A poem',
        issue: '2026',
        author: 'writer',
        category: 'Poetry',
        status: 'published',
        recordings: [{ file: '/media/audio/public.mp3', title: 'Reading' }],
      },
      {
        slug: 'secret-poem',
        title: 'Secret words',
        issue: '2026',
        author: 'secret-writer',
        category: 'Poetry',
        status: 'draft',
        artworks: [{ image: '/media/images/unpublished.jpg', alt: 'Private artwork' }],
      },
      {
        slug: 'sample-poem',
        title: 'Sample words',
        issue: '2026',
        author: 'writer',
        category: 'Poetry',
        status: 'draft',
        artworks: [{ image: '/media/images/sample.jpg', alt: 'Sample artwork' }],
      },
      {
        slug: 'next-issue',
        title: 'Next issue',
        issue: '2027',
        author: 'writer',
        category: 'Prose',
        status: 'published',
        artworks: [{ image: '/media/images/future.jpg', alt: 'Future artwork' }],
      },
    ],
    ...overrides,
  };
  await writeFile(path.join(root, 'site.json'), JSON.stringify(records.site));
  for (const name of ['issues', 'works', 'authors']) {
    await mkdir(path.join(root, name));
    for (const entry of records[name])
      await writeFile(
        path.join(root, name, `${entry.slug || entry.year}.json`),
        JSON.stringify(entry),
      );
  }
  return root;
}
