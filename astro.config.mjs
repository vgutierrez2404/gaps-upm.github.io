import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.gaps.ssr.upm.es',
  output: 'static',
  trailingSlash: 'always',
  publicDir: './public',
});
