# GAPS website

Website for the Signal Processing Applications Group (GAPS) at Universidad Politécnica de Madrid. Built with astro.

## Local development

Requires Node.js 22.22 or later.

```sh
npm install
npm run dev
```

Create the production site with `npm run build` (output: `dist/`) and preview it with `npm run preview`.

## Project structure

- Pages and layouts: `src/pages/` and `src/layouts/`
- People profiles and long-form page content: `src/content/`
- Site data: `src/data/`
- Public images, documents, styles, scripts, and talk map: `public/`

The Astro site includes the homepage, people directory and profiles, projects, publications, teaching, talks, posters, open positions, Filling the Gaps, research-line pages, About, Terms, the talk map, and a 404 page.

## Editing site content

- **Home page:** `src/pages/index.astro`; news and featured publication data: `src/data/news.yml` and `src/data/home_publications.yml`.
- **People:** add or edit a Markdown profile in `src/content/people/` and update the roster in `src/data/people.yml`.
- **Publications:** edit `src/data/publications.yml`, `src/data/publication_authors.yml`, and `src/data/home_publications.yml`.
- **Posters:** add entries to `src/data/posters.yml`, including the matching `publication_id` from `publications.yml`. Put original images and PDFs in `public/assets/posters/`; generate gallery previews with `node scripts/generate_poster_thumbnails.mjs`. The viewer gets citations and resource links from the publication record. Set `pdf` to a path such as `/assets/posters/example.pdf` for the printable PDF.
- **Projects:** edit `src/data/projects.yml` and `src/pages/projects/index.astro`.
- **Teaching:** edit programmes and courses in `src/data/teaching.yml`. Use person profile slugs in each course's `instructors` list to link confirmed GAPS faculty; an optional `url` links to the official course guide.
- **Research lines:** edit the Markdown files in `src/content/pages/`.
- **Open positions:** update `src/data/positions.yml`.
- **Reading group:** add sessions to `src/data/filling_the_gaps.yml` with ISO dates (`YYYY-MM-DD`). Sessions are grouped into academic years from September to August, newest first. Set `next_session` to a confirmed session or leave it `null` while the programme is pending. Dates are checked at build time, so rebuild when announcing or changing a session.
- **Images, PDFs, fonts, and browser assets:** put them under `public/` so their paths are preserved in the generated site.

## Reviewing new Scholar publications

The Scholar importer collects proposals separately from the reviewed website catalogue:

```sh
python3 scripts/update_publications_from_scholar.py --year 2026
```

Review `reviews/scholar-2026.md`, organised by researcher, and update the matching records in `reviews/scholar-2026.json`:

- Keep `status: "pending"` if uncertain.
- Set `status: "rejected"` for a namesake, unwanted record, or existing work under a different title. Rejections persist across later collections.
- Set `status: "approved"` after checking the article. This also accepts `candidate_author_tags`. Optionally set `confirmed_author_tags` to override or complete them with keys from `src/data/publication_authors.yml`, for example `["camara", "blanco"]`.
- Correct a candidate's title, authors, venue, or URL if needed. Scholar can truncate author lists, so check the source before approving.

Preview and then import approved records:

```sh
python3 scripts/update_publications_from_scholar.py --year 2026 --apply --dry-run
python3 scripts/update_publications_from_scholar.py --year 2026 --apply
```

Collection does not edit `src/data/publications.yml`. Import adds approved entries from the requested year, preserves existing records, validates YAML, creates a `.bak`, and marks approvals as `imported`; repeating the import does not add them again. Review files are outside the website's content directories.

Use `--author "Mateo"` to collect only one researcher; decisions for other researchers remain saved. Collection failures are listed separately from results, and similar titles are flagged for review rather than discarded automatically. The importer does not yet resolve DOI identifiers or verify authorship automatically.

## Publication research map

`src/data/research_topics.yml` defines topic labels, colours, and title-matching patterns. These are initial suggestions, not a reviewed classification or citation network. Papers connect to topic nodes; dot size does not represent citations or impact.

To override suggestions for a paper in `src/data/publications.yml`, add an explicit topic list. The first topic determines its map cluster; other topics add connections and search filters:

```yaml
topics: [vision, ml]
```

Use only topic IDs defined in `research_topics.yml`. Unknown or empty explicit lists fail the build. Topic and year filters and text search are shared by the map and the publication list; existing publication links open the list and expand the relevant year.

The 2026 papers have individually assigned `topics` and `research` metadata. See `reviews/publication-topics-2026.md` for classification criteria, sources, and open questions. `research.area` is a broad topic ID; `tasks` and `methods` are readable English labels (reuse existing spellings). `basis` records whether the classification used an abstract, only a title, or needs a source. `source` and `note` preserve editorial reasoning. Unverified methods stay empty. Area, tasks, and methods appear in the selected-paper panel and are searchable; older papers still use the initial title rules.

## Contributions

Make changes on a feature branch and open a pull request for review.
