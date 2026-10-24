# Contributing to the GAPS website

The site is built with Astro. For a local preview, run `npm install` once, then `npm run dev`. Use `npm run build` to produce the static site in `dist/`.

## Common edits

- **Home page:** `src/pages/index.astro`; the news and featured publication data live in `src/data/news.yml` and `src/data/home_publications.yml`.
- **People:** add or edit a Markdown profile in `src/content/people/` and update the roster in `src/data/people.yml`.
- **Publications:** edit `src/data/publications.yml`, `src/data/publication_authors.yml`, and `src/data/home_publications.yml`.
- **Posters:** add entries to `src/data/posters.yml`, including the matching `publication_id` from `publications.yml`. Place original images in `public/images/posters/` and run `node scripts/generate_poster_thumbnails.mjs` to generate small gallery previews. The viewer reads citations and resource links directly from the publication record.
- **Projects:** edit `src/data/projects.yml` and the rendering page at `src/pages/projects/index.astro`.
- **Teaching:** edit programmes and courses in `src/data/teaching.yml`. Use person profile slugs in each course’s `instructors` list to link confirmed GAPS faculty; an optional `url` links to the official course guide.
- **Research lines:** edit the Markdown files in `src/content/pages/`.
- **Open positions:** update `src/data/positions.yml`.
- **Reading group:** add sessions to `src/data/filling_the_gaps.yml` with ISO dates (`YYYY-MM-DD`). The page groups them automatically into academic years from September to August, newest first. Set `next_session` to a confirmed session, or leave it `null` while the programme is pending. Rebuild the static site when announcing or changing a session; dates are checked at build time.
- **Images, PDFs, fonts, and browser assets:** put them under `public/` so their paths are preserved in the generated site.

Please make changes on a feature branch and open a pull request for review.
