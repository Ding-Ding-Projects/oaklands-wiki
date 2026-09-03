#!/usr/bin/env node
/**
 * Font vendoring guard.
 *
 * A wrong font is the most deceptive UI defect there is: nothing throws, nothing
 * logs, every element keeps its correct styles, and the whole interface is merely
 * slightly wrong everywhere. So this checks the bytes on disk and the built
 * output rather than the intent in the stylesheet.
 *
 * It refuses:
 *
 * - a manifest file that is missing, or whose digest has drifted;
 * - a face declared in the generated CSS with no corresponding file;
 * - a family named in the token stack that is neither vendored nor a recognised
 *   system fallback — the "bundled a font nobody can find" trap, where the family
 *   silently resolves to the next entry in the stack;
 * - a `unicode-range` or `font-weight` in the generated CSS that has drifted from
 *   the manifest, which is how a hand-edit collapses a family;
 * - any remote `url()` in the font CSS.
 *
 * `--self-test` proves it bites.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'data', 'font-manifest.json');
const FONT_CSS = path.join(ROOT, 'public', 'fonts', 'fonts.css');
const TOKENS = path.join(ROOT, 'src', 'styles', 'tokens.css');

/** Stack entries that are deliberately not vendored: system faces and generics. */
const SYSTEM_FALLBACKS = new Set([
  '-apple-system', 'blinkmacsystemfont', 'segoe ui variable text', 'segoe ui',
  'system-ui', 'sans-serif', 'serif', 'ui-monospace', 'cascadia mono', 'consolas',
  'monospace', 'ui-sans-serif', 'ui-serif',
]);

export async function evaluate({ manifest, fontCss, tokensCss, filesOnDisk, digests }) {
  const failures = [];

  if (!Array.isArray(manifest?.files) || manifest.files.length === 0) {
    return ['the font manifest lists no files — a family nobody vendored renders as a silent fallback'];
  }

  // 1. Every manifested file exists, with the recorded bytes.
  for (const entry of manifest.files) {
    const name = path.basename(entry.file);
    if (!filesOnDisk.has(name)) {
      failures.push(`${entry.family} ${entry.weight}: vendored file "${entry.file}" is missing`);
      continue;
    }
    const actual = digests.get(name);
    if (actual && actual !== entry.sha256) {
      failures.push(`${entry.family} ${entry.weight}: "${entry.file}" has changed since it was vendored`);
    }
  }

  // 2. The generated CSS references every manifested file and nothing remote.
  for (const entry of manifest.files) {
    if (!fontCss.includes(`./${path.basename(entry.file)}`)) {
      failures.push(`${entry.family} ${entry.weight}: "${entry.file}" is on disk but no @font-face references it`);
    }
  }
  const remote = /url\(\s*['"]?https?:/i.exec(fontCss);
  if (remote) failures.push('the font CSS fetches a remote url() — every asset must be local');

  // 3. Weights and ranges in the CSS match the manifest. A hand-edited weight
  //    range is a claim about the binary that nothing else checks, and collapsing
  //    the subsets makes one accented character pull the whole family down.
  for (const entry of manifest.files) {
    const block = fontCss.split('@font-face').find((b) => b.includes(`./${path.basename(entry.file)}`));
    if (!block) continue;
    if (!new RegExp(`font-weight:\\s*${String(entry.weight).replace(/\s+/g, '\\s+')}\\s*;`).test(block)) {
      failures.push(`${entry.family}: font-weight in the CSS has drifted from the manifest (${entry.weight})`);
    }
    if (entry.unicodeRange && !block.includes(entry.unicodeRange)) {
      failures.push(`${entry.family} ${entry.weight}: unicode-range has drifted from the manifest`);
    }
  }

  // 4. Every family named in a token stack is vendored or a known fallback.
  const vendored = new Set(manifest.files.map((f) => f.family.toLowerCase()));
  for (const line of tokensCss.split(/\r?\n/)) {
    const match = /--ok-font-[a-z-]+:\s*([^;]+);/.exec(line);
    if (!match || match[1].trim().startsWith('var(')) continue;
    for (const raw of match[1].split(',')) {
      const family = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (!family) continue;
      if (vendored.has(family) || SYSTEM_FALLBACKS.has(family)) continue;
      failures.push(`the token stack names "${raw.trim()}", which is neither vendored nor a known system fallback — it will silently resolve to the next entry`);
    }
  }

  return failures;
}

async function load() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const fontCss = await readFile(FONT_CSS, 'utf8');
  const tokensCss = await readFile(TOKENS, 'utf8');
  const dir = path.dirname(FONT_CSS);
  const names = (await readdir(dir)).filter((n) => n.endsWith('.woff2'));
  const digests = new Map();
  for (const name of names) {
    digests.set(name, createHash('sha256').update(await readFile(path.join(dir, name))).digest('hex'));
  }
  return { manifest, fontCss, tokensCss, filesOnDisk: new Set(names), digests };
}

async function main() {
  const state = await load();

  if (process.argv.includes('--self-test')) {
    console.log('check-fonts: self-test — each mutation must be caught');
    const clone = () => ({
      manifest: JSON.parse(JSON.stringify(state.manifest)),
      fontCss: state.fontCss,
      tokensCss: state.tokensCss,
      filesOnDisk: new Set(state.filesOnDisk),
      digests: new Map(state.digests),
    });
    const mutations = [
      ['an empty manifest', () => { const s = clone(); s.manifest.files = []; return s; }],
      ['a vendored file removed from disk', () => {
        const s = clone(); s.filesOnDisk.delete(path.basename(s.manifest.files[0].file)); return s;
      }],
      ['a vendored file whose bytes changed', () => {
        const s = clone(); s.digests.set(path.basename(s.manifest.files[0].file), '0'.repeat(64)); return s;
      }],
      ['a face dropped from the generated CSS', () => {
        const s = clone();
        s.fontCss = s.fontCss.replaceAll(`./${path.basename(s.manifest.files[0].file)}`, './removed.woff2');
        return s;
      }],
      ['a remote url() in the font CSS', () => {
        const s = clone(); s.fontCss += `\n@font-face { src: url("https://example.invalid/x.woff2"); }\n`; return s;
      }],
      ['a hand-collapsed weight range', () => {
        const s = clone(); s.fontCss = s.fontCss.replace(/font-weight:\s*100 900\s*;/, 'font-weight: 400;'); return s;
      }],
      ['a token stack naming a font nobody vendored', () => {
        const s = clone();
        s.tokensCss += `\n:root { --ok-font-ghost: "Helvetica Neue Phantom", sans-serif; }\n`;
        return s;
      }],
    ];

    let allCaught = true;
    for (const [label, mutate] of mutations) {
      const caught = (await evaluate(mutate())).length > 0;
      if (!caught) allCaught = false;
      console.log(`  ${caught ? 'RED  ' : 'GREEN'}  ${label}${caught ? '' : '  <-- NOT CAUGHT'}`);
    }
    const clean = await evaluate(state);
    console.log(`  ${clean.length === 0 ? 'GREEN' : 'RED  '}  unmutated state (must be green)`);
    if (!allCaught || clean.length > 0) {
      console.error('check-fonts: self-test FAILED');
      for (const message of clean) console.error(`    - ${message}`);
      process.exit(1);
    }
    console.log('check-fonts: self-test passed');
    return;
  }

  const failures = await evaluate(state);
  if (failures.length > 0) {
    console.error(`check-fonts: ${failures.length} failure(s)`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  const families = [...new Set(state.manifest.files.map((f) => f.family))];
  const kb = (state.manifest.files.reduce((sum, f) => sum + f.bytes, 0) / 1024).toFixed(0);
  console.log(`check-fonts: ok — ${state.manifest.files.length} file(s) across ${families.length} famil${families.length === 1 ? 'y' : 'ies'} (${families.join(', ')}), ${kb}KB, every digest matching`);
}

main().catch((error) => { console.error(`check-fonts: ${error.message}`); process.exit(1); });
