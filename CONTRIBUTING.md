# Contributing to the GAPS website

The site is built with Astro. For a local preview, run `npm install` once, then `npm run dev`. Use `npm run build` to produce the static site in `dist/`.

## Common edits

- **Home page:** `src/pages/index.astro`; the news and featured publication data live in `src/data/news.yml` and `src/data/home_publications.yml`.
- **People:** add or edit a Markdown profile in `src/content/people/` and update the roster in `src/data/people.yml`.
- **Publications:** edit `src/data/publications.yml`, `src/data/publication_authors.yml`, and `src/data/home_publications.yml`.
- **Projects:** edit `src/data/projects.yml` and the rendering page at `src/pages/projects/index.astro`.
- **Teaching and research lines:** edit the Markdown files in `src/content/pages/`.
- **Open positions and reading group:** update `src/data/positions.yml` and `src/data/filling_the_gaps.yml`.
- **Images, PDFs, fonts, and browser assets:** put them under `public/` so their paths are preserved in the generated site.

Please make changes on a feature branch and open a pull request for review.
