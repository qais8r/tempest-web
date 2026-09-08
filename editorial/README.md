# The Tempest editorial workspace

This private repository holds issues, works, authors, and uploaded files. Open it in [Pages CMS](https://app.pagescms.org/qais8r/tempest-content/main) to edit using forms.

## Publish an issue

1. Open **Issues** and add the year and PDF. Upload a file such as `2027.pdf`. The first PDF page is used automatically as the cover at its original proportions. Add its image title and credit if needed.
2. Open **Authors** and add each contributor's name, biography, and optional portrait.
3. Open **Works**. Choose one issue and one author, enter the work, and add any artwork or MP3 recordings. Choose the Poetry category to preserve line breaks and indentation. Preview excerpts come from the written work automatically, and the first gallery artwork becomes the preview image. Works without artwork use the full card width for text. A PDF page number adds a link into the reader; count the cover as page 1.
4. Return to the issue and add reader contents if you want links to specific PDF pages. The site rotates three featured works each day and uses the same selection on the homepage and issue page. The newest published year becomes the homepage issue automatically. Use **Site settings → Homepage issue override** only to feature an older issue; clear it to return to automatic selection.
5. Set the issue, its authors, and the works you want to show to **Ready to publish**. Leave unfinished records as **Draft**. Test entries are ordinary drafts. Delete them when testing is complete, or leave them as Draft to keep them off the published site.
6. Use **Build private preview** to build a private downloadable preview. The current GitHub Pages setup cannot host private drafts in the browser; ask the maintainer to open this artifact locally. A protected hosted preview is a future hosting option.
7. Click **Publish website**. Only ready content appears on the public site. Drafts and their unused files stay private. The result link appears in the action's run summary.

Saving an edit does not change the public website. Publish when the complete set of changes is ready. A scheduled daily build updates the featured-work rotation without changing publication statuses. Authors can contribute to several issues. An issue can contain just a PDF with no companion works.

## About and occasional settings

Use **About** to edit the publication description and footer statement. Line breaks in the footer are preserved.

**Site settings** holds the school name, search-engine description, and optional homepage issue override. These rarely need changing.

Works follow their starting PDF page number. Works without a page follow in alphabetical title order.

## Files and corrections

PDFs, images, and audio live in GitHub. Keep individual files below 25 MiB. Upload PDFs named for their year. Image descriptions are required for gallery artwork. Recording titles are optional; the player uses Audio recording when no title is provided. Use the description for reader credits or other context.

Web addresses are generated automatically when you create a work or author. Editing a title or name later keeps the existing address and links. Entries with the same title or name receive distinct addresses automatically. To remove a published work, change it to Draft and publish again. Previously public material remains in the public site's Git history; do not publish confidential content as a test.

Every saved edit has Git history. The maintainer can restore earlier revisions. A publishing error leaves the last successful public build in place. Its action log explains missing authors, missing files, or invalid PDF page numbers.

## First connection and handoff

Sign in to Pages CMS with GitHub and install its GitHub App for **this repository only**. Select the `main` branch. Future editors can receive access through Pages CMS or be added as GitHub collaborators.

The maintainer sets repository variables `SOURCE_REPO`, `SOURCE_REF`, `PUBLIC_SITE_REPO`, `SITE_URL`, and `BASE_PATH`. A repository-specific write deploy key is stored as the `PAGES_DEPLOY_KEY` Actions secret. The publishing workflow writes generated files to `gh-pages`; it does not commit to the source branch. No personal GitHub token is stored.

Website code is maintained on the `main` branch of [qais8r/tempest-web](https://github.com/qais8r/tempest-web). The generated website files use its separate `gh-pages` branch. The public website currently lives at [qais8r.github.io/tempest-web](https://qais8r.github.io/tempest-web/). The maintainer pins `SOURCE_REPO` to `qais8r/tempest-web` and `SOURCE_REF` to a verified source commit. Changing hosting later requires a new destination and a deploy key for that repository.

## Shared works and poetry

Select every credited contributor in **Authors, in credit order**. Each author must be ready before a shared work can be published. Older single-author records remain readable; migrate their `author` value to a one-element `authors` array when upgrading the editorial forms. Keep filenames and publication statuses unchanged.

Poetry retains line breaks and indentation. Choose **Markdown** under Poetry emphasis to use `*italic*` and `**bold**`; choose center alignment only when the source poem is centered. Plain remains the default for existing poems.
