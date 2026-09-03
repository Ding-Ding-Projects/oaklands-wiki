#!/usr/bin/env node
/**
 * Assert properties of the BUILT OUTPUT, never of the config that produced it.
 *
 * A green build proves a file was written; it never proves the file is correct.
 * Every check below reads dist/ and fails closed.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.SITE_BASE ?? '/oaklands-wiki/').replace(/\/+$/, '/');

const failures = [];
const fail = (message) => failures.push(message);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Normalise line endings before scanning source: a CRLF checkout otherwise
 *  silently empties every derived list and the guard reports clean. */
const norm = (text) => text.replace(/\r\n/g, '\n');

async function main() {
  const files = await walk(DIST);
  const html = files.filter((f) => f.endsWith('.html'));
  if (html.length === 0) fail('dist contains no HTML at all');

  for (const file of html) {
    const rel = path.relative(ROOT, file);
    const source = norm(await readFile(file, 'utf8'));

    // 1. Base path actually present. A root base deploys green and 404s everything.
    for (const ref of source.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
      const url = ref[1];
      if (url.startsWith('//')) continue;
      if (!url.startsWith(BASE)) fail(`${rel}: absolute path "${url}" does not carry base "${BASE}"`);
    }

    // 2. No remote assets, no CDN, no analytics.
    for (const ref of source.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      const url = ref[1];
      const isOwnOrigin = url.startsWith('https://ding-ding-projects.github.io/');
      const isDocumentLink = /rel="[^"]*(?:noopener|license|canonical)/.test(
        source.slice(Math.max(0, ref.index - 200), ref.index + 200),
      );
      if (!isOwnOrigin && !isDocumentLink) fail(`${rel}: remote asset reference ${url}`);
    }

    // 3. No injected CSS: GitHub-style sanitizers and CSP both punish it, and it
    //    hides styling outside the single token source.
    if (/<style[\s>]/.test(source)) fail(`${rel}: contains a <style> element`);

    // 4. Open Graph, in the served markup, because the crawler runs no JavaScript.
    const required = {
      'og:title': /<meta property="og:title" content="[^"]+"/,
      'og:description': /<meta property="og:description" content="[^"]+"/,
      'og:url': /<meta property="og:url" content="https:\/\/[^"]+"/,
      'og:image': /<meta property="og:image" content="https:\/\/[^"]+"/,
      'og:image:width': /<meta property="og:image:width" content="\d+"/,
      'og:image:height': /<meta property="og:image:height" content="\d+"/,
      'og:image:alt': /<meta property="og:image:alt" content="[^"]+"/,
      'twitter:card': /<meta name="twitter:card" content="summary_large_image"/,
    };
    for (const [name, pattern] of Object.entries(required)) {
      if (!pattern.test(source)) fail(`${rel}: missing or malformed ${name}`);
    }

    // 5. Exactly one description, and it is route-specific.
    const descriptions = source.match(/<meta name="description"/g) ?? [];
    if (descriptions.length !== 1) fail(`${rel}: expected 1 description meta, found ${descriptions.length}`);

    // 6. Real prerendered content, not an empty shell the crawler cannot read.
    const body = source.slice(source.indexOf('<div id="root">'));
    if (body.length < 500) fail(`${rel}: prerendered body is empty or near-empty`);
  }

  // 7. The embed graphic exists, is served, and matches the root master byte for byte.
  const master = path.join(ROOT, 'social-preview.png');
  const served = path.join(DIST, 'social-preview.png');
  try {
    const [a, b] = await Promise.all([readFile(master), readFile(served)]);
    const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
    if (digest(a) !== digest(b)) fail('social-preview.png: served copy differs from the root master');
    if ((await stat(served)).size < 5000) fail('social-preview.png: served copy is implausibly small');
  } catch {
    fail('social-preview.png: missing at the repository root or in the built output');
  }

  // 8. Tokens are declared in exactly one file. A token declared twice is
  //    decided by import order, and editing the losing copy changes nothing.
  const styleFiles = (await walk(path.join(ROOT, 'src'))).filter((f) => f.endsWith('.css'));
  const tokenSource = path.join(ROOT, 'src', 'styles', 'tokens.css');
  for (const file of styleFiles) {
    if (file === tokenSource) continue;
    if (/--ok-[a-z0-9-]+\s*:/.test(norm(await readFile(file, 'utf8')))) {
      fail(`${path.relative(ROOT, file)}: declares --ok-* tokens; only src/styles/tokens.css may`);
    }
  }
  const tokenText = norm(await readFile(tokenSource, 'utf8'));
  for (const block of tokenText.split('}')) {
    const seen = new Set();
    for (const declaration of block.matchAll(/(--ok-[a-z0-9-]+)\s*:/g)) {
      if (seen.has(declaration[1])) fail(`tokens.css: ${declaration[1]} declared twice in one block`);
      seen.add(declaration[1]);
    }
  }

  if (failures.length > 0) {
    console.error(`check-static-bundle: ${failures.length} failure(s)`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(`check-static-bundle: ok (${html.length} page(s) checked)`);
}

main().catch((error) => {
  console.error(`check-static-bundle: ${error.message}`);
  process.exit(1);
});
