#!/usr/bin/env node
/**
 * Vendor every font file the design asks for, from the canonical upstream.
 *
 * The site may not fetch a font at run time, so the families have to be on disk.
 * The trap this script exists to avoid is vendoring a *fragment* of a family and
 * calling it bundled: one `family=` request answers with dozens of `@font-face`
 * blocks — one per weight, per style, and per `unicode-range` subset — and taking
 * only the file your own browser happened to fetch collapses every weight into
 * one and drops every non-latin range.
 *
 * So:
 *
 * - Send a modern browser User-Agent, or the upstream serves an older format and
 *   a much larger file.
 * - Download **every** file the request returns, not the first.
 * - Preserve `font-weight` and `unicode-range` exactly as the source declared
 *   them, rewriting only `src`. Those two are the whole mechanism: drop the
 *   ranges and one accented character pulls the entire family down; collapse the
 *   weights and the type hierarchy silently flattens.
 * - Never author a weight range ourselves. The range is copied from the source
 *   declaration, so we cannot declare an axis the binary does not have — a lie
 *   the browser answers with synthesised faux-bold and no error anywhere.
 * - Record a SHA-256 per file and fail loudly rather than shipping a partial set.
 */
import { createHash } from 'node:crypto';
import https from 'node:https';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'fonts');
const MANIFEST = path.join(ROOT, 'data', 'font-manifest.json');
const CSS_OUT = path.join(ROOT, 'public', 'fonts', 'fonts.css');

/**
 * A modern browser UA. Without it the upstream serves an older format, so the
 * vendored files are both larger and not what the stylesheet asks for.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Exactly the families and axes the token file names. */
const REQUESTS = [
  { label: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap' },
  { label: 'JetBrains Mono', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&display=swap' },
];

function get(url, { binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'user-agent': UA, accept: binary ? '*/*' : 'text/css,*/*' },
      timeout: 30_000,
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        resolve(get(new URL(response.headers.location, url).toString(), { binary }));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${url} -> HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 12 * 1024 * 1024) { request.destroy(); reject(new Error(`${url}: exceeded the size bound`)); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(binary ? buffer : buffer.toString('utf8'));
      });
    });
    request.on('timeout', () => { request.destroy(); reject(new Error(`${url}: timed out`)); });
    request.on('error', reject);
  });
}

/** Every @font-face block, with its declarations kept verbatim. */
function parseFaces(css) {
  const faces = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  for (const block of blocks) {
    const value = (property) => {
      const match = new RegExp(`(?:^|;|\\{)\\s*${property}\\s*:\\s*([^;}]+)`, 'i').exec(block);
      return match ? match[1].trim() : null;
    };
    const src = value('src');
    const url = src ? /url\((https:\/\/[^)]+)\)/.exec(src) : null;
    if (!url) continue;
    faces.push({
      family: (value('font-family') ?? '').replace(/^['"]|['"]$/g, ''),
      style: value('font-style') ?? 'normal',
      weight: value('font-weight') ?? '400',
      stretch: value('font-stretch'),
      display: value('font-display') ?? 'swap',
      unicodeRange: value('unicode-range'),
      url: url[1],
      format: /format\((['"]?)([a-z0-9-]+)\1\)/i.exec(src)?.[2] ?? 'woff2',
    });
  }
  return faces;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const entries = [];
  const rules = [];

  for (const request of REQUESTS) {
    const css = await get(request.url);
    const faces = parseFaces(css);
    if (faces.length === 0) throw new Error(`${request.label}: the upstream returned no @font-face blocks`);
    console.log(`${request.label}: ${faces.length} face(s) declared`);

    for (const face of faces) {
      if (face.format !== 'woff2') {
        throw new Error(`${request.label}: upstream served ${face.format}, not woff2 — the User-Agent is wrong`);
      }
      const buffer = await get(face.url, { binary: true });
      // woff2 files begin with the signature 'wOF2'. A redirect to an HTML error
      // page is the same length-and-status shape as a font, so check the bytes.
      if (buffer.subarray(0, 4).toString('latin1') !== 'wOF2') {
        throw new Error(`${face.url}: not a woff2 file (signature ${buffer.subarray(0, 4).toString('hex')})`);
      }
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const slug = `${face.family.replace(/\s+/g, '-')}-${face.style}-${String(face.weight).replace(/\s+/g, '_')}-${sha256.slice(0, 8)}.woff2`;
      await writeFile(path.join(OUT, slug), buffer);

      entries.push({
        family: face.family,
        style: face.style,
        weight: face.weight,
        unicodeRange: face.unicodeRange,
        file: `fonts/${slug}`,
        bytes: buffer.length,
        sha256,
        source: face.url,
      });

      // Rewrite src only. Everything else is copied verbatim from the source
      // declaration, so we never assert a weight range the binary lacks.
      rules.push([
        '@font-face {',
        `  font-family: '${face.family}';`,
        `  font-style: ${face.style};`,
        `  font-weight: ${face.weight};`,
        face.stretch ? `  font-stretch: ${face.stretch};` : null,
        `  font-display: ${face.display};`,
        `  src: url('./${slug}') format('woff2');`,
        face.unicodeRange ? `  unicode-range: ${face.unicodeRange};` : null,
        '}',
      ].filter(Boolean).join('\n'));
    }
  }

  const header = [
    '/*',
    ' * Vendored fonts. Generated by scripts/download-fonts.mjs — do not edit.',
    ' *',
    ' * font-weight and unicode-range are copied verbatim from the upstream',
    ' * declarations; only src is rewritten. Regenerate rather than hand-editing:',
    ' * a hand-adjusted weight range is a claim about the binary that nothing checks.',
    ' */',
    '',
  ].join('\n');
  await writeFile(CSS_OUT, `${header}${rules.join('\n\n')}\n`, 'utf8');

  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  await writeFile(MANIFEST, `${JSON.stringify({
    recordType: 'oaklands-wiki-font-manifest',
    schemaVersion: 1,
    note: 'Every file the upstream family requests returned, with a digest each. A partial set is a font that renders as a silently wrong fallback, so the guard compares this list against public/fonts.',
    generatedAt: new Date().toISOString(),
    userAgent: UA,
    requests: REQUESTS,
    files: entries,
  }, null, 2)}\n`, 'utf8');

  console.log(`vendored ${entries.length} file(s), ${(totalBytes / 1024).toFixed(0)}KB total`);
  console.log(`  css      -> ${path.relative(ROOT, CSS_OUT)}`);
  console.log(`  manifest -> ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((error) => { console.error(`download-fonts: ${error.message}`); process.exit(1); });
