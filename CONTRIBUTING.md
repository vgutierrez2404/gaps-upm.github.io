# Contributing to the GAPS website

The site is built with Astro. For a local preview, run `npm install` once, then `npm run dev`. Use `npm run build` to produce the static site in `dist/`.

## Common edits

- **Home page:** `src/pages/index.astro`; the news and featured publication data live in `src/data/news.yml` and `src/data/home_publications.yml`.
- **People:** add or edit a Markdown profile in `src/content/people/` and update the roster in `src/data/people.yml`.
- **Publications:** edit `src/data/publications.yml`, `src/data/publication_authors.yml`, and `src/data/home_publications.yml`.
- **Posters:** add entries to `src/data/posters.yml`, including the matching `publication_id` from `publications.yml`. Place original images in `public/images/posters/` and run `node scripts/generate_poster_thumbnails.mjs` to generate small gallery previews. The viewer reads citations and resource links directly from the publication record. Optionally add `pdf` to a poster entry (for example `/files/posters/example.pdf`) to provide the original printable PDF.
- **Projects:** edit `src/data/projects.yml` and the rendering page at `src/pages/projects/index.astro`.
- **Teaching:** edit programmes and courses in `src/data/teaching.yml`. Use person profile slugs in each course’s `instructors` list to link confirmed GAPS faculty; an optional `url` links to the official course guide.
- **Research lines:** edit the Markdown files in `src/content/pages/`.
- **Open positions:** update `src/data/positions.yml`.
- **Reading group:** add sessions to `src/data/filling_the_gaps.yml` with ISO dates (`YYYY-MM-DD`). The page groups them automatically into academic years from September to August, newest first. Set `next_session` to a confirmed session, or leave it `null` while the programme is pending. Rebuild the static site when announcing or changing a session; dates are checked at build time.
- **Images, PDFs, fonts, and browser assets:** put them under `public/` so their paths are preserved in the generated site.

Please make changes on a feature branch and open a pull request for review.

## Reviewing new Scholar publications

The Scholar importer collects proposals separately from the reviewed website catalogue:

```sh
python3 scripts/update_publications_from_scholar.py --year 2026
```

Read `reviews/scholar-2026.md`, organised by researcher, and edit the matching entries in `reviews/scholar-2026.json`:

- Leave `status: "pending"` if uncertain.
- Set `status: "rejected"` for a namesake, an unwanted record, or an existing work under a different title. Rejections persist on later collections.
- Set `status: "approved"` after checking the article. This also accepts its `candidate_author_tags`; no separate confirmation is needed. Optionally fill `confirmed_author_tags` to override or complete them, using keys from `src/data/publication_authors.yml`, for example `["camara", "blanco"]`.
- Correct title, authors, venue or URL in the candidate if needed. Scholar can truncate author lists; follow the source link before approving.

Then preview and import only your approvals:

```sh
python3 scripts/update_publications_from_scholar.py --year 2026 --apply --dry-run
python3 scripts/update_publications_from_scholar.py --year 2026 --apply
```

Collection never edits `src/data/publications.yml`. Import only adds approved entries from the exact requested year, preserves existing records, validates YAML, makes a `.bak`, and marks approvals `imported`. Repeating import does not add them again. Review files are outside the website's content directories.

Use `--author "Mateo"` to collect only one researcher; earlier decisions for other researchers remain saved. The report lists collection failures separately: a failed request does not mean there are no new publications. Very similar titles are flagged for review, not automatically discarded. This workflow does not yet resolve DOI identifiers or validate authorship automatically.

## Publication research map

`src/data/research_topics.yml` defines topic labels, colours and title-matching patterns. These are initial suggestions, not a reviewed classification or a citation network. Papers connect to topic nodes; dot size does not represent citations or impact.

To override suggestions for a paper in `src/data/publications.yml`, add an explicit list. The first topic determines its map cluster, and the other topics add connections and search filters:

```yaml
topics: [vision, ml]
```

Use only topic IDs defined in `research_topics.yml`. Unknown or empty explicit lists fail the build. The topic/year filters and text search are shared by the map and the list by year. Existing publication links automatically open the list and expand the relevant year.

The 2026 papers now have individually assigned `topics` plus `research` metadata. See `reviews/publication-topics-2026.md` for the classification criteria, sources and outstanding questions. `research.area` is a broad topic ID; `tasks` and `methods` are readable English labels (reuse existing spellings). `basis` records whether the classification used an `abstract`, only the `title`, or `needs-source`. `source` and `note` preserve the editorial reasoning. Unverified methods stay empty. Area, tasks and methods appear in the selected paper panel and are searchable. Older papers still use the initial title rules.
