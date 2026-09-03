#!/usr/bin/env node
/**
 * The wiki mirror must cover every article and contain no broken internal link.
 *
 * Both halves matter. Coverage catches an article that never made it across;
 * link integrity catches a link that looks well-formed and resolves to nothing —
 * which is how a page name containing parentheses breaks, since Markdown ends a
 * link target at the first unescaped `)`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { findReserved, reservedCount } from './lib/reserved-terms.mjs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = path.join(ROOT, 'build', 'wiki');
const ARTICLES = path.join(ROOT, 'data', 'articles');

const failures = [];

const index = JSON.parse(await readFile(path.join(ARTICLES, 'index.json'), 'utf8'));
let files;
try {
  files = await readdir(WIKI);
} catch {
  console.error('check-wiki: build/wiki does not exist — run `npm run generate:wiki` first');
  process.exit(1);
}
const pages = new Set(files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));

if (pages.size === 0) failures.push('the mirror contains no pages at all');

for (const entry of index) {
  const expected = entry.slug.replace(/\//g, '-');
  if (!pages.has(expected)) failures.push(`article "${entry.title}" has no wiki page (${expected}.md)`);
}
for (const required of ['Home', 'About', '_Sidebar', '_Footer']) {
  if (!pages.has(required)) failures.push(`the mirror is missing ${required}.md`);
}

let links = 0;
for (const file of files) {
  const text = await readFile(path.join(WIKI, file), 'utf8');
  for (const match of text.matchAll(/\]\(([^)\s]*)\)/g)) {
    const target = match[1];
    if (/^https?:/.test(target) || target.startsWith('#') || target === '') continue;
    links += 1;
    // Compare the target as written. Page names are themselves percent-encoded
    // (a title may contain ? or /), so decoding here compares an encoded filename
    // against a decoded target and reports every one of them as broken.
    const bare = target.replace(/#.*$/, '');
    const alsoTry = bare.replace(/%28/g, '(').replace(/%29/g, ')');
    if (!pages.has(bare) && !pages.has(alsoTry)) failures.push(`${file}: link to "${target}" resolves to no page`);
  }
}

// A public record carries no working shorthand, ever — and a guard that enforced
// that by listing the phrases here would publish them itself, which is exactly
// the failure it exists to prevent. The list is one-way instead; see
// scripts/lib/reserved-terms.mjs. A hit is reported by digest, never by phrase.
if (reservedCount === 0) failures.push('the reserved-phrase set is empty — this check is not checking anything');
for (const file of files) {
  const text = await readFile(path.join(WIKI, file), 'utf8');
  for (const hit of findReserved(text)) {
    failures.push(`${file}: contains a reserved phrase (${hit.words}-word, digest ${hit.digest}) that must never reach a public record`);
  }
}

if (links === 0) failures.push('found no internal links to check — the link scan is not working');

if (failures.length > 0) {
  console.error(`check-wiki: ${failures.length} failure(s)`);
  for (const message of failures.slice(0, 15)) console.error(`  - ${message}`);
  if (failures.length > 15) console.error(`  … and ${failures.length - 15} more`);
  process.exit(1);
}
console.log(`check-wiki: ok — ${pages.size} pages, ${index.length} articles covered, ${links} internal links all resolve`);
