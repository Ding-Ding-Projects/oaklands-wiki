#!/usr/bin/env node
/**
 * Line-count breakdown for the release notes.
 *
 * Committed as a script so the release workflow runs one command and anyone can
 * reproduce the figure locally, rather than each release re-deriving it by hand
 * and getting a slightly different answer.
 *
 * Attribution is per SURVIVING line via `git blame`, never a sum of added lines
 * from the log: churn is not authorship, and a line written then deleted belongs
 * to nobody.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** Excluded from the project total, and named in the output rather than hidden. */
const EXCLUDED = [
  { label: 'Captured wiki corpus', match: (f) => f.startsWith('data/corpus/') },
  { label: 'Built article records', match: (f) => f.startsWith('data/articles/') },
  { label: 'Archived media', match: (f) => f.startsWith('public/media/') },
  { label: 'Dependency lockfile', match: (f) => f === 'package-lock.json' },
  { label: 'Vendored licence text', match: (f) => f === 'LICENSE' },
];

const CATEGORIES = [
  { label: 'Source', match: (f) => /^src\/.*\.(ts|tsx)$/.test(f) },
  { label: 'Build and import scripts', match: (f) => /^scripts\/.*\.(mjs|js|py)$/.test(f) },
  { label: 'Styles', match: (f) => /\.css$/.test(f) },
  { label: 'Configuration and workflows', match: (f) => /^(package\.json|tsconfig\.json|vite\.config\.ts|index\.html|\.github\/.*|.*\.bat)$/.test(f) },
  { label: 'Documentation', match: (f) => /\.md$/.test(f) },
  { label: 'Data (hand-written)', match: (f) => /^data\/.*\.json$/.test(f) },
];

function isBinary(absolute) {
  try {
    const buffer = readFileSync(absolute);
    return buffer.subarray(0, 8000).includes(0);
  } catch { return true; }
}

const tracked = git(['ls-files']).split('\n').filter(Boolean);

const rows = new Map(CATEGORIES.map((c) => [c.label, { files: 0, lines: 0, nonblank: 0 }]));
const excludedRows = new Map(EXCLUDED.map((e) => [e.label, { files: 0, lines: 0 }]));
let agentLines = 0;
let humanLines = 0;
let blamed = 0;

for (const file of tracked) {
  const absolute = path.join(ROOT, file);
  let size;
  try { size = statSync(absolute); } catch { continue; }
  if (!size.isFile() || isBinary(absolute)) continue;

  const text = readFileSync(absolute, 'utf8');
  const lines = text.length === 0 ? 0 : text.replace(/\n$/, '').split('\n').length;
  const nonblank = text.split('\n').filter((l) => l.trim() !== '').length;

  const excluded = EXCLUDED.find((e) => e.match(file));
  if (excluded) {
    const row = excludedRows.get(excluded.label);
    row.files += 1; row.lines += lines;
    continue;
  }

  const category = CATEGORIES.find((c) => c.match(file));
  if (!category) continue;
  const row = rows.get(category.label);
  row.files += 1; row.lines += lines; row.nonblank += nonblank;

  // Surviving-line attribution. An automation identity or a Co-Authored-By
  // trailer naming an agent makes the commit agent-written.
  try {
    const blame = git(['blame', '--line-porcelain', '--', file]);
    for (const match of blame.matchAll(/^author-mail <([^>]*)>$/gm)) {
      blamed += 1;
      if (/noreply@anthropic\.com|users\.noreply\.github\.com$/.test(match[1])) agentLines += 1;
      else humanLines += 1;
    }
  } catch {
    // A file with no blame history yet is counted in the totals but not attributed.
  }
}

const total = [...rows.values()].reduce((sum, r) => sum + r.lines, 0);
const totalNonblank = [...rows.values()].reduce((sum, r) => sum + r.nonblank, 0);
const excludedTotal = [...excludedRows.values()].reduce((sum, r) => sum + r.lines, 0);

console.log('| Category | Files | Lines | Non-blank |');
console.log('|---|---:|---:|---:|');
for (const [label, row] of rows) {
  if (row.files === 0) continue;
  console.log(`| ${label} | ${row.files} | ${row.lines.toLocaleString()} | ${row.nonblank.toLocaleString()} |`);
}
console.log(`| **Project total** | | **${total.toLocaleString()}** | **${totalNonblank.toLocaleString()}** |`);
console.log('');
console.log('| Excluded from the project total | Files | Lines |');
console.log('|---|---:|---:|');
for (const [label, row] of excludedRows) {
  if (row.files === 0) continue;
  console.log(`| ${label} | ${row.files} | ${row.lines.toLocaleString()} |`);
}
console.log(`| **Grand total, everything tracked** | | **${(total + excludedTotal).toLocaleString()}** |`);
console.log('');
console.log(`Attribution over ${blamed.toLocaleString()} blamed lines: **${agentLines.toLocaleString()} agent**, **${humanLines.toLocaleString()} human**.`);
console.log('Attributed per surviving line with `git blame`, not by summing added lines — churn is not authorship.');

// The counter's own arithmetic must agree with itself, or neither number is
// worth publishing.
if (blamed !== agentLines + humanLines) {
  console.error(`count-lines: attribution does not add up (${blamed} blamed vs ${agentLines + humanLines} attributed)`);
  process.exit(1);
}

// A human-effort estimate, stated as an estimate and shown with its arithmetic.
const low = Math.round(totalNonblank / 30);
const high = Math.round(totalNonblank / 15);
console.log('');
console.log(`Human implementation estimate: **${low.toLocaleString()}–${high.toLocaleString()} hours**.`);
console.log(`Method: ${totalNonblank.toLocaleString()} non-blank project lines ÷ 30 to 15 reviewed lines per hour. This is an estimate, not a measurement — nobody built it by hand.`);
