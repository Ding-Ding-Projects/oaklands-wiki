#!/usr/bin/env node
/**
 * Bundle the documentation and generate the changelog.
 *
 * Both are built from real sources: the docs come from `docs/`, and the
 * changelog from `git log`. Every changelog entry carries the FULL commit SHA,
 * because an entry that says what changed but not where is unverifiable — a
 * reader who doubts it has no way from the sentence to the code.
 *
 * A wrong SHA is worse than none, so every referenced commit is checked to exist
 * before anything is written.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'data', 'generated');
const REPO = 'https://github.com/Ding-Ding-Projects/oaklands-wiki';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Walk docs/ and collect every article with its category. */
async function collectDocs(dir, category = null) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectDocs(full, entry.name)));
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    const body = await readFile(full, 'utf8');
    const title = /^#\s+(.+)$/m.exec(body)?.[1] ?? entry.name.replace(/\.md$/, '');
    out.push({
      slug: path.relative(DOCS, full).replace(/\\/g, '/').replace(/\.md$/, ''),
      category: category ?? 'Overview',
      title,
      body,
    });
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // ---- Documentation, bundled so it works with the network unplugged -----
  const docs = (await collectDocs(DOCS)).sort((a, b) => a.slug.localeCompare(b.slug));
  if (docs.length === 0) throw new Error('no documentation found — refusing to bundle an empty set');

  // Every article ends with suggested reading, so nobody hits a dead end.
  for (const doc of docs) {
    doc.suggested = docs
      .filter((other) => other.slug !== doc.slug)
      .filter((other) => other.category === doc.category)
      .slice(0, 3)
      .map((other) => ({ slug: other.slug, title: other.title }));
  }
  await writeFile(path.join(OUT, 'docs.json'), `${JSON.stringify(docs, null, 0)}\n`, 'utf8');

  // ---- Changelog, from real commits --------------------------------------
  const raw = git(['log', '--format=%H%x1f%aI%x1f%s%x1f%b%x1e', '--no-merges']);
  const entries = [];
  for (const record of raw.split('\x1e')) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const [sha, date, subject, body] = trimmed.split('\x1f');
    if (!/^[0-9a-f]{40}$/.test(sha ?? '')) continue;

    // Only the English half of the bilingual body: the changelog viewer renders
    // its own language modes, so shipping both halves would double every entry.
    const englishBody = (body ?? '')
      .split('\n')
      .filter((line) => !/[一-鿿]/.test(line))
      .join('\n')
      .replace(/^Co-Authored-By:.*$/gm, '')
      .trim();

    entries.push({ sha, shortSha: sha.slice(0, 7), date, subject, body: englishBody, url: `${REPO}/commit/${sha}` });
  }

  if (entries.length === 0) throw new Error('git log produced no entries — refusing to write an empty changelog');

  // A wrong SHA sends the reader somewhere confidently irrelevant, so prove each
  // one exists rather than trusting the format string that produced it.
  for (const entry of entries) {
    try {
      git(['cat-file', '-e', `${entry.sha}^{commit}`]);
    } catch {
      throw new Error(`changelog references ${entry.sha}, which is not a commit in this repository`);
    }
  }

  await writeFile(path.join(OUT, 'changelog.json'), `${JSON.stringify(entries, null, 0)}\n`, 'utf8');

  console.log(`docs: ${docs.length} article(s) across ${new Set(docs.map((d) => d.category)).size} categories`);
  console.log(`changelog: ${entries.length} entries, every SHA verified to exist`);
}

main().catch((error) => { console.error(`build-docs-and-changelog failed: ${error.message}`); process.exit(1); });
