#!/usr/bin/env node
/**
 * Capture the evidence the inventory rows depend on.
 *
 * Two jobs, both of which must come from the REAL deployed site rather than a
 * source preview or a mock:
 *
 * 1. **Source differentiation.** The same article captured from the source wiki
 *    and from this one, at one identical tuple. A reader must be able to see the
 *    difference without being told about it, and reviewer opinion does not close
 *    that row — the paired capture does.
 *
 * 2. **The design-parity reference set.** Each inventoried screen captured under
 *    a pinned tuple, so a later build can be compared against an approved state
 *    rather than against somebody's memory of it.
 */
import WebSocket from 'ws';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.CDP_PORT ?? '9797';
const SITE = 'https://ding-ding-projects.github.io/oaklands-wiki';
const SOURCE = 'https://oaklands.fandom.com';
const RUN = Date.now().toString(36);

/** One tuple for every capture, recorded beside each result. */
const PHONE = { width: 390, height: 844, scale: 2, mobile: true };
const DESKTOP = { width: 1280, height: 900, scale: 1, mobile: false };

/** The inventoried screens. Hand-written: a discovery scan cannot notice a
 *  screen that was never captured. */
const SCREENS = [
  { id: 'home', path: '/', tuple: PHONE, state: 'default', theme: 'dark' },
  { id: 'home-desktop', path: '/', tuple: DESKTOP, state: 'default', theme: 'dark' },
  { id: 'browse', path: '/browse/', tuple: PHONE, state: 'unfiltered', theme: 'dark' },
  { id: 'compare', path: '/compare/', tuple: DESKTOP, state: 'objects table', theme: 'dark' },
  { id: 'logic', path: '/logic/', tuple: DESKTOP, state: 'half adder starter', theme: 'dark' },
  { id: 'docs', path: '/docs/', tuple: DESKTOP, state: 'documentation tab', theme: 'dark' },
  { id: 'article', path: '/wiki/Copper/', tuple: PHONE, state: 'default', theme: 'dark' },
  { id: 'category', path: '/category/Ores/', tuple: PHONE, state: 'unfiltered', theme: 'dark' },
  { id: 'about', path: '/about/', tuple: PHONE, state: 'default', theme: 'dark' },
];

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pages = targets.filter((t) => t.type === 'page');
  if (targets.length !== 1 || pages.length !== 1) {
    throw new Error(`isolation failed: ${targets.length} target(s), ${pages.length} page(s)`);
  }
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  });
  await new Promise((resolve) => ws.on('open', resolve));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  return { ws, send };
}

async function capture(send, { url, tuple, file, cacheBust = true }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: tuple.width, height: tuple.height, deviceScaleFactor: tuple.scale, mobile: tuple.mobile,
  });
  const target = cacheBust ? `${url}${url.includes('?') ? '&' : '?'}v=${RUN}` : url;
  await send('Page.navigate', { url: target });
  await new Promise((r) => setTimeout(r, 3000));
  // Viewport-only. A full-page capture renders a sticky element at its stuck
  // position, which lands mid-image and reads exactly like a layout defect.
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(shot.data, 'base64');
  await writeFile(file, buffer);
  return { bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
}

async function main() {
  const differentiation = path.join(ROOT, 'evidence', 'differentiation');
  const reference = path.join(ROOT, 'design', 'reference');
  await mkdir(differentiation, { recursive: true });
  await mkdir(reference, { recursive: true });

  const { ws, send } = await connect();
  console.log('isolation: PASS');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  // ---- 1. Source differentiation, one identical tuple both sides ----------
  const pairs = [];
  for (const article of ['Copper', 'Oak']) {
    const ours = await capture(send, {
      url: `${SITE}/wiki/${article}/`, tuple: PHONE,
      file: path.join(differentiation, `${article}-ours.png`),
    });
    const theirs = await capture(send, {
      url: `${SOURCE}/wiki/${article}`, tuple: PHONE,
      file: path.join(differentiation, `${article}-source.png`), cacheBust: false,
    });
    pairs.push({ article, tuple: PHONE, ours, theirs });
    console.log(`differentiation: ${article} — ours ${(ours.bytes / 1024).toFixed(0)}KB, source ${(theirs.bytes / 1024).toFixed(0)}KB`);
  }
  await writeFile(
    path.join(differentiation, 'pairs.json'),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), pairs }, null, 2)}\n`,
    'utf8',
  );

  // ---- 2. The design-parity reference set ---------------------------------
  const rows = [];
  for (const screen of SCREENS) {
    const file = path.join(reference, `${screen.id}.png`);
    const result = await capture(send, { url: `${SITE}${screen.path}`, tuple: screen.tuple, file });
    rows.push({
      id: screen.id,
      route: screen.path,
      referenceFile: path.relative(ROOT, file).replace(/\\/g, '/'),
      state: screen.state,
      theme: screen.theme,
      viewport: `${screen.tuple.width}x${screen.tuple.height}`,
      scale: screen.tuple.scale,
      mobile: screen.tuple.mobile,
      sha256: result.sha256,
      bytes: result.bytes,
    });
    console.log(`reference: ${screen.id} @ ${screen.tuple.width}x${screen.tuple.height} — ${result.sha256.slice(0, 12)}`);
  }
  await writeFile(
    path.join(ROOT, 'design', 'parity-inventory.json'),
    `${JSON.stringify({
      recordType: 'oaklands-wiki-design-parity-inventory',
      schemaVersion: 1,
      note: 'Hand-written screen list captured from the real deployed site under a pinned tuple. A discovery scan cannot notice a screen that was never captured, so the list is explicit and the guard fails when a row has no reference file.',
      capturedAt: new Date().toISOString(),
      rows,
    }, null, 2)}\n`,
    'utf8',
  );

  ws.close();
  console.log(`\ncaptured ${pairs.length} differentiation pair(s) and ${rows.length} reference screen(s)`);
}

main().catch((error) => { console.error(`capture failed: ${error.message}`); process.exit(1); });
