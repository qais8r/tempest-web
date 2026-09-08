# The Tempest

The annual creative arts publication of Mayo Clinic Alix School of Medicine. This Astro redesign puts the current issue first, with companion works, author profiles, and an archive. The PDF reader displays the original pages in a desktop flipbook and a continuous mobile view.

## Development

Use Node 24 LTS.

```sh
npm ci
npm run dev
```

Open `http://localhost:4321`. Development includes sample works saved as drafts so the full design can be reviewed. Their text and names are placeholders; they are not extracted from the magazine. The sample recording comes from the previous demo site and is labeled accordingly.

```sh
npx playwright install chromium webkit # Once, for browser tests
npm test                  # Content rules and browser navigation regressions
npm run test:unit         # Fast content and text tests
npm run test:browser      # Built-site tests in Chromium and WebKit
npm run build             # Published content only; excludes drafts
npm run check             # Astro and TypeScript diagnostics
npm run build:preview     # Includes drafts; keep private for real content
npm run preview           # Serve the most recent build locally
```

Browser tests build the public `content/` fixtures in preview mode with `/tempest-web` as the base path, then serve them on port 4537. They cover shared elements, Back and Forward, reloads, mobile layouts, interrupted transitions, storage failures, missing navigation APIs, and reduced motion. Playwright stops its server after the run.

The prepare script validates JSON, copies only media referenced by included records, generates PDF covers, and checks reader page numbers. It also generates WebP cover sizes and square thumbnails for JPEG and PNG artwork, keeping the originals. Run it again or restart the dev server after editing content. Cover images are cached by PDF hash and renderer configuration; CI restores the public fixture cache between runs. Generated files are ignored by Git.

## Editing and publishing

Use the separate [private content workspace](https://github.com/qais8r/tempest-content). Its [Pages CMS dashboard](https://app.pagescms.org/qais8r/tempest-content/main) provides forms for Issues, Works, Authors, About, and occasional Site settings. See [the editor guide](editorial/README.md) and [setup notes](docs/editorial-workspace.md).

Saving a CMS record commits it privately. **Build private preview** builds a private downloadable artifact. **Publish website** builds only records marked Ready to publish and pushes static files to the public repository's `gh-pages` branch through a repository-specific deploy key. GitHub Pages preview URLs are public; unpublished material must not be deployed there. A protected browser preview can be added later with another host.

The `content/` folder here is a public development fixture. It includes the supplied 2018, 2019, 2020, 2021, 2022, 2023, and 2026 PDFs. It is not the live editorial database. All future drafts and uploads belong in the private workspace. To build against it locally:

```sh
CONTENT_DIR=/absolute/path/to/tempest-content/content npm run dev
```

## Content model

| Record | Fields                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------- |
| Issue  | Year, introduction, PDF, cover credit, ordered featured works, PDF contents links                  |
| Work   | Title, ordered authors, issue, category, text, artwork, MP3 recordings, optional PDF page and sort override |
| Author | Name, biography, optional portrait                                                                 |
| About  | About copy and footer statement                                                                    |
| Site   | School, description, optional homepage issue override, hidden editorial repository                 |

Every issue, work, and author has Draft/Ready status. Test content is an ordinary draft and can be deleted after testing. A ready work requires every credited author to be ready and its issue to be published. The newest published year is the homepage issue unless an override is selected.

Pages CMS creates work and author filenames from the initial title or name, appending a number on collisions. Filenames remain unchanged after edits and supply the permanent URL IDs. Work authors are an ordered list of references; each contributor receives a byline link and the work appears on each profile. Legacy single-author records continue to load. References store the saved repository path. The loader accepts legacy IDs as well. Editors never type a slug or filename. Works sort by optional override, otherwise PDF page, then alphabetically by title. Recording titles fall back to Audio recording when blank.

The first PDF page supplies the cover and its proportions. Work excerpts are generated from the opening text, up to 120 characters with `...` for longer text. The first gallery image supplies the thumbnail; works without artwork use the full card width for text. The Poetry category preserves line breaks and indentation. Poetry emphasis can opt into sanitized inline Markdown, and poems can be left-aligned or centered. Prose and biographies support sanitized Markdown. Missing portraits use initials. Past PDFs can be published without entering individual works.

## Hosting

Static output is in `dist/`. No application server or database is required. Set `SITE_URL` to the origin and `BASE_PATH` to the repository path for GitHub Pages, for example:

```sh
SITE_URL=https://qais8r.github.io BASE_PATH=/tempest-web npm run build
```

The maintained source is [qais8r/tempest-web](https://github.com/qais8r/tempest-web), on `main`. The website currently lives at [qais8r.github.io/tempest-web](https://qais8r.github.io/tempest-web/), served from the `gh-pages` branch of `qais8r/tempest-web`. Private content stays in `qais8r/tempest-content`. The public repository holds source on `main` and generated website files on `gh-pages`. Both repositories are independent of Brett's original site. Keep the content `SOURCE_REF` pinned to a verified source commit when upgrading the code.

PDFs, images, and MP3s are committed directly to GitHub. A 25 MiB per-file build limit keeps the workflow compatible with browser uploads and a possible later Cloudflare Pages move. Larger future files need optimization or a separate media store. The original `/issues/2026/tempest-2026.pdf` path remains available, and the old flipbook and demo-work URLs redirect.

## Implementation

Every HTML page opts into native cross-document View Transitions. Most navigation uses a page crossfade; work cards, author links, and issue covers share elements between pages. A single navigation record keeps the outgoing and incoming elements consistent. History records preserve the selected card or author teaser for Back and Forward. Reduced motion disables transitions, and blocked storage falls back to the page crossfade. External destinations and PDF files follow the browser's normal navigation behavior.

Astro generates the pages. PDF.js renders and supplies selectable text for the PDF reader; StPageFlip handles desktop page turns. The reader loads nearby pages, releases distant canvases, supports keyboard navigation, contents links, zoom, downloads, and reduced motion. It switches to scrolling below 760px. Typography is self-hosted Cormorant Garamond and Manrope.

`editorial/` contains the private workspace's CMS configuration and workflow templates. Run `node scripts/make-cms-config.mjs` after changing its field generator, then copy the updated configuration into the private workspace. Code changes should go through a pull request. Publication errors stop before deployment and preserve the last successful site.
