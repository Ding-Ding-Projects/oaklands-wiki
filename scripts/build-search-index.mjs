#!/usr/bin/env node
/**
 * Build the index the master search reads.
 *
 * Every page on this site is in it — articles, alternate names, files,
 * categories and the standing pages — because a search that only covers some of
 * a site teaches people not to trust it. A miss has to mean "not here", not
 * "not in the part we indexed".
 *
 * The index is fetched once and searched in the browser, so it has to stay
 * small. That means storing what distinguishes a result and nothing else: a
 * title, its kind, a short summary and the terms worth matching. Article bodies
 * are deliberately excluded — full text would be several megabytes for a search
 * most people use to find a page by name.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = path.join(ROOT, 'data', 'articles');
const OUT = path.join(ROOT, 'public');

/** Plain text from the sanitised body, for a one-line summary. */
function summarise(html, limit = 160) {
  const text = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

async function main() {
  const index = JSON.parse(await readFile(path.join(ARTICLES, 'index.json'), 'utf8'));
  const categories = JSON.parse(await readFile(path.join(ARTICLES, 'categories.json'), 'utf8'));
  const files = JSON.parse(await readFile(path.join(ARTICLES, 'files.json'), 'utf8'));
  const routes = JSON.parse(await readFile(path.join(ROOT, 'data', 'routes.json'), 'utf8'));

  const entries = [];

  for (const entry of index) {
    const record = JSON.parse(await readFile(path.join(ARTICLES, `${entry.pageid}.json`), 'utf8'));
    // The infobox is what people actually search an item for — an island, a
    // price, a status — so its values are searchable even though the body is not.
    const facts = (record.infobox?.fields ?? []).map((f) => `${f.label} ${f.value}`).join(' ');
    entries.push({
      t: entry.title,
      u: `/wiki/${entry.slug}/`,
      k: entry.alias ? 'alias' : 'article',
      s: record.alias
        ? `Another name for ${record.alias.of}.`
        : summarise(record.body),
      c: entry.categories ?? [],
      x: [entry.infoboxType ?? '', facts].filter(Boolean).join(' ').slice(0, 300),
      h: entry.hero?.file ?? null,
    });
  }

  for (const category of categories) {
    entries.push({
      t: category.name.replace(/_/g, ' '),
      u: `/category/${category.slug}/`,
      k: 'category',
      s: `${category.count} article${category.count === 1 ? '' : 's'} in this category.`,
      c: [], x: 'category', h: category.hero?.file ?? null,
    });
  }

  for (const file of files) {
    entries.push({
      t: file.name,
      u: `/file/${file.slug}/`,
      k: 'file',
      s: file.media
        ? `Archived image, used by ${file.usedBy.length} article${file.usedBy.length === 1 ? '' : 's'}.`
        : 'Referenced by the wiki; this image is not archived here.',
      c: [], x: 'file image media', h: file.media?.file ?? null,
    });
  }

  for (const route of routes) {
    entries.push({
      t: route.title.replace(/\s+—\s+Oaklands Wiki$/, ''),
      u: route.path,
      k: 'page',
      s: route.description,
      c: [], x: 'site page', h: null,
    });
  }

  entries.sort((a, b) => a.t.localeCompare(b.t));

  // A duplicate URL means two entries compete for one destination, which shows
  // up as a repeated result rather than as an error.
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.u)) throw new Error(`two search entries share the URL ${entry.u}`);
    seen.add(entry.u);
  }
  if (entries.length === 0) throw new Error('built an empty search index — refusing to report success');

  await mkdir(OUT, { recursive: true });
  const payload = { built: entries.length, entries };
  await writeFile(path.join(OUT, 'search-index.json'), `${JSON.stringify(payload)}\n`, 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(payload));
  const byKind = entries.reduce((acc, e) => { acc[e.k] = (acc[e.k] ?? 0) + 1; return acc; }, {});
  console.log(`build-search-index: ${entries.length} entries, ${(bytes / 1024).toFixed(0)}KB`);
  console.log(`  ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`);
}

main().catch((error) => { console.error(`build-search-index failed: ${error.message}`); process.exit(1); });
