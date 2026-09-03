#!/usr/bin/env node
/**
 * Reduce the published capture to the small facts the site renders, so no page
 * quotes a number the corpus cannot back.
 *
 * The source wiki's own `articles` statistic (1,066) counts differently from
 * `allpages` non-redirects (1,063). Both are real; they are not the same number,
 * and the site says which one it means rather than blurring them.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus');

const pointer = JSON.parse(await readFile(path.join(CORPUS, 'current.json'), 'utf8'));
const snapshot = path.join(CORPUS, pointer.snapshotId);
const capture = JSON.parse(await readFile(path.join(snapshot, 'capture.json'), 'utf8'));
const articles = JSON.parse(await readFile(path.join(snapshot, 'articles.json'), 'utf8'));
const categories = JSON.parse(await readFile(path.join(snapshot, 'categories.json'), 'utf8'));

if (articles.length === 0) {
  console.error('summarise-corpus: capture holds no articles');
  process.exit(1);
}

const byName = new Map(categories.map((c) => [c.name, c.pages]));
const ORDER = ['Ores', 'Trees', 'Tools', 'Items', 'Locations', 'Structures',
  'Logic', 'Vinyls', 'Vehicles', 'Events', 'NPCs'];

const summary = {
  snapshotId: pointer.snapshotId,
  capturedAt: capture.completedAt,
  source: capture.source.origin,
  licence: capture.site.rights,
  // What we actually hold, and what the source reports about itself. Different
  // numbers, both true, never conflated.
  captured: { articles: articles.length, redirects: capture.counts.redirects, categories: categories.length },
  sourceReports: { articles: capture.site.statistics.articles, pages: capture.site.statistics.pages, images: capture.site.statistics.images },
  editors: new Set(articles.map((a) => a.user)).size,
  categories: ORDER
    .map((name) => ({ name, slug: name.toLowerCase(), count: byName.get(name) ?? 0 }))
    .filter((c) => c.count > 0),
};

const out = path.join(ROOT, 'data', 'corpus-summary.json');
await writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`summarise-corpus: ${summary.captured.articles} articles, ${summary.categories.length} categories, ${summary.editors} editors`);
