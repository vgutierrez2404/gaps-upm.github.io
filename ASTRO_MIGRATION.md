# Astro site

The website now uses Astro for its pages and build. Site data, Markdown content, and public assets live in Astro-owned directories; there is no Jekyll build step.

## Local development

```sh
npm install
npm run dev
```

Build the static site with `npm run build`; the output is written to `dist/`. Preview that build with `npm run preview`.

## Migrated routes

- Homepage, news feed, and featured publications with poster zoom
- People directory and all 21 person profile pages
- Projects, publications with researcher filters, teaching, and talks
- Open positions, reading group, and the three research-line pages
- `/about/`, `/terms/`, talk map, and a 404 page

Theme archive demo pages from the former site were removed. Deployment configuration remains separate from local Astro development.
