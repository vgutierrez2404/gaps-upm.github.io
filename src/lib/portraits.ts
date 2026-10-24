import type { ImageMetadata } from 'astro';

const portraits = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/people/**/*.{png,jpg,jpeg,webp}',
);

export async function portraitSource(path: string): Promise<ImageMetadata> {
  const load = portraits[path];
  if (!load) throw new Error(`Portrait not found: ${path}`);
  return (await load()).default;
}
