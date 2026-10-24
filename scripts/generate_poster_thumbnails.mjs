// Run after adding or replacing a poster: node scripts/generate_poster_thumbnails.mjs
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
const root = fileURLToPath(new URL('../', import.meta.url));
const posters = parse(await readFile(path.join(root, 'src/data/posters.yml'), 'utf8'));
for (const poster of posters) {
  const output = path.join(root, 'public', poster.thumbnail);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(path.join(root, 'public', poster.image)).resize({ width: 640, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(output);
}
console.log(`Generated ${posters.length} poster thumbnails.`);
