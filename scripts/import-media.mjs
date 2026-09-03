#!/usr/bin/env node
/**
 * Fetch a display-sized copy of every image the articles actually reference.
 *
 * Sizing is the whole point. The originals total roughly 1.6 GB — one is 8.4 MB
 * for a single map screenshot — and shipping those to a phone would undo the
 * reason this site exists. The source's own thumbnailer returns WebP at about
 * 25 KB for a 400px-wide render, so 2,449 images come to roughly 60 MB: small
 * enough to live in the repository, and honestly sized for a reader.
 *
 * Policy: image URLs come from `action=query&prop=imageinfo`, which the source's
 * robots.txt explicitly permits. The asset host itself publishes no robots.txt
 * at all (it answers 404 with a JPEG for every path — it is a CDN, not a
 * crawlable site), so each fetch is one asset the permitted API just named.
 *
 * Resumable: an existing file is kept unless --force is passed.
 */
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus');
const OUT = path.join(ROOT, 'public', 'media');
const MANIFEST = path.join(ROOT, 'data', 'media-manifest.json');

const API = 'https://oaklands.fandom.com/api.php';
const UA = 'OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)';
const WIDTH = 400;
const BATCH = 40;
const WAIT_MS = 200;
const MAX_BYTES = 4 * 1024 * 1024;
const FORCE = process.argv.includes('--force');
const LIMIT = Number(process.env.MEDIA_LIMIT ?? '0');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchBuffer(url, purpose) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'user-agent': UA, accept: '*/*' }, timeout: 30_000 }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) { response.resume(); reject(new Error(`${purpose}: refused redirect ${status}`)); return; }
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) { request.destroy(); reject(new Error(`${purpose}: exceeded ${MAX_BYTES} bytes`)); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status, buffer: Buffer.concat(chunks), type: response.headers['content-type'] ?? '' }));
    });
    request.on('timeout', () => { request.destroy(); reject(new Error(`${purpose}: timed out`)); });
    request.on('error', (error) => reject(new Error(`${purpose}: ${error.message}`)));
  });
}

/** Verify the bytes really are the image type they claim to be. */
export function sniff(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buffer.toString('utf8', 0, 200).trimStart().startsWith('<svg')) return 'svg';
  return null;
}

/** A stable, filesystem-safe name for a source file title. */
export function mediaName(sourceName) {
  return sourceName
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*%#]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  const pointer = JSON.parse(await readFile(path.join(CORPUS, 'current.json'), 'utf8'));
  const parsedDir = path.join(CORPUS, pointer.snapshotId, 'parsed');

  // Only what the articles actually reference — not the whole media library.
  const referenced = new Set();
  for (const file of await readdir(parsedDir)) {
    if (!/^\d+\.json$/.test(file)) continue;
    const parsed = JSON.parse(await readFile(path.join(parsedDir, file), 'utf8'));
    for (const name of parsed.images ?? []) referenced.add(name);
  }

  // Still images only. Audio and video keep their honest placeholder until the
  // release-backed volumes exist; a 30 MB mp4 has no place in ordinary Git.
  const wanted = [...referenced].filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name));
  const targets = LIMIT ? wanted.slice(0, LIMIT) : wanted;
  const skipped = referenced.size - wanted.length;

  await mkdir(OUT, { recursive: true });
  console.log(`import-media: ${targets.length} still image(s) referenced (${skipped} audio/video left as placeholders)`);

  const manifest = {};
  let fetched = 0; let reused = 0; let bytes = 0;
  const failures = [];

  for (let index = 0; index < targets.length; index += BATCH) {
    const batch = targets.slice(index, index + BATCH);

    // Resolve thumbnail URLs through the permitted API.
    const url = new URL(API);
    for (const [key, value] of Object.entries({
      action: 'query', titles: batch.map((n) => `File:${n}`).join('|'),
      prop: 'imageinfo', iiprop: 'url|size|mime|sha1', iiurlwidth: String(WIDTH),
      format: 'json', formatversion: '2', maxlag: '5',
    })) url.searchParams.set(key, value);

    let info;
    try {
      const response = await fetchBuffer(url.toString(), `imageinfo ${index}`);
      info = JSON.parse(response.buffer.toString('utf8'));
    } catch (error) {
      failures.push({ batch: index, error: error.message });
      continue;
    }
    if (info.error) { failures.push({ batch: index, error: info.error.info }); continue; }

    for (const page of info.query?.pages ?? []) {
      const sourceName = (page.title ?? '').replace(/^File:/, '');
      const image = page.imageinfo?.[0];
      if (!image) { failures.push({ name: sourceName, error: 'no imageinfo' }); continue; }

      const target = image.thumburl ?? image.url;
      const base = mediaName(sourceName).replace(/\.[^.]+$/, '');
      const existing = (await readdir(OUT)).find((f) => f.startsWith(`${base}.`));

      if (!FORCE && existing) {
        manifest[sourceName] = { file: existing, width: image.thumbwidth ?? null, height: image.thumbheight ?? null, sha1: image.sha1 ?? null };
        reused += 1;
        continue;
      }

      try {
        const asset = await fetchBuffer(target, `image ${sourceName}`);
        if (asset.status !== 200) throw new Error(`HTTP ${asset.status}`);
        const kind = sniff(asset.buffer);
        // Trust the bytes, never the extension or the declared MIME type.
        if (!kind) throw new Error(`unrecognised image bytes (${asset.type})`);
        const file = `${base}.${kind}`;
        await writeFile(path.join(OUT, file), asset.buffer);
        manifest[sourceName] = { file, width: image.thumbwidth ?? null, height: image.thumbheight ?? null, sha1: image.sha1 ?? null };
        fetched += 1;
        bytes += asset.buffer.length;
      } catch (error) {
        failures.push({ name: sourceName, error: error.message });
      }
      await sleep(WAIT_MS);
    }
    process.stdout.write(`\rimport-media: ${Math.min(index + BATCH, targets.length)}/${targets.length} (fetched ${fetched}, reused ${reused}, failed ${failures.length})`);
  }
  process.stdout.write('\n');

  if (Object.keys(manifest).length === 0) throw new Error('resolved no media at all — refusing to write an empty manifest');

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 0)}\n`, 'utf8');
  console.log(`import-media: ${fetched} fetched (${(bytes / 1024 / 1024).toFixed(1)} MB), ${reused} reused, ${failures.length} failed`);
  console.log(`import-media: manifest holds ${Object.keys(manifest).length} image(s)`);
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 5)) console.log(`  - ${failure.name ?? `batch ${failure.batch}`}: ${failure.error}`);
  }
}

main().catch((error) => { console.error(`import-media failed: ${error.message}`); process.exit(1); });
