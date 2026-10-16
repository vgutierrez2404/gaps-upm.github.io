import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { parse } from 'yaml';

const root = process.cwd();

export async function readYaml<T>(name: string): Promise<T> {
  return parse(await readFile(path.join(root, 'src', 'data', name), 'utf8')) as T;
}

export async function readCollection(folder: string) {
  const dir = path.join(root, 'src', 'content', folder);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.md')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return Promise.all(files.map(async (file) => {
    const raw = await readFile(path.join(dir, file), 'utf8');
    const parsed = matter(raw);
    const slug = String(parsed.data.person_slug || file.replace(/\.md$/, ''));
    return { slug, data: parsed.data as Record<string, any>, content: parsed.content };
  }));
}

export async function readPage(file: string) {
  const raw = await readFile(path.join(root, 'src', 'content', 'pages', file), 'utf8');
  const parsed = matter(raw);
  const content = parsed.content.replace(/^\s*\{%[- ]*include[\s\S]*?%\}\s*$/gm, '').trim();
  return { data: parsed.data as Record<string, any>, content };
}
