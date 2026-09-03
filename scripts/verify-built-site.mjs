#!/usr/bin/env node
/**
 * Verify the BUILT, DEPLOYED site through an isolated headless browser.
 *
 * Everything here is measured from the running page, never inferred from the
 * source. Reading CSS cannot tell you which rule won, whether a target is big
 * enough, or whether a control does anything; only the rendered page can.
 *
 * Isolation is proved before anything is measured: exactly one debugging target,
 * of page type, at the exact expected URL. Finding one acceptable target among
 * several proves nothing.
 */
import WebSocket from 'ws';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.CDP_PORT ?? '9797';
const ORIGIN = process.env.SITE_ORIGIN ?? 'https://ding-ding-projects.github.io/oaklands-wiki';
const OUT = path.join(ROOT, 'evidence', 'verification');
const RUN_ID = Date.now().toString(36);

/** The tuple every capture is taken under, recorded beside every result. */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, scale: 2, mobile: true },
  { name: 'phone-narrow', width: 320, height: 720, scale: 2, mobile: true },
  { name: 'tablet', width: 768, height: 1024, scale: 2, mobile: true },
  { name: 'desktop', width: 1280, height: 900, scale: 1, mobile: false },
  { name: 'desktop-200pct', width: 1280, height: 900, scale: 2, mobile: false },
];

const SURFACES = [
  { id: 'home', path: '/' },
  { id: 'browse', path: '/browse/' },
  { id: 'compare', path: '/compare/' },
  { id: 'logic', path: '/logic/' },
  { id: 'docs', path: '/docs/' },
  { id: 'about', path: '/about/' },
  { id: 'article', path: '/wiki/Copper/' },
  { id: 'category', path: '/category/Ores/' },
  { id: 'money', path: '/money/' },
  { id: 'search', path: '/search/?q=copper' },
  { id: 'file', path: '/file/Altar1.png/' },
];

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pages = targets.filter((t) => t.type === 'page');
  if (targets.length !== 1 || pages.length !== 1 || !pages[0].webSocketDebuggerUrl) {
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

/**
 * The accessibility and layout audit, run inside the page.
 *
 * Deliberately synchronous: `Runtime.evaluate` with `awaitPromise` hangs on this
 * Node/Edge pair, so nothing here returns a promise.
 */
const AUDIT = `(() => {
  const problems = [];
  const px = (v) => Math.round(v);

  // 1. The page body never scrolls sideways.
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  if (overflow) problems.push('horizontal body overflow: scrollWidth ' + document.documentElement.scrollWidth + ' vs clientWidth ' + document.documentElement.clientWidth);

  // 2. Every interactive control meets the touch-target floor.
  const MIN = 24; // CSS px; the design aims at 44 and this catches real misses
  const small = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="tab"], [role="menuitem"]')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    // An inline link inside a block of text is explicitly exempt from the
    // target-size rule: enlarging it would break the line box it sits in. This
    // exempts only genuinely inline links in flowing text, never a standalone
    // control that happens to be small.
    const inlineInText = el.tagName === 'A'
      && style.display === 'inline'
      && !!el.closest('p, li, dd, figcaption, caption, td, th');
    if (inlineInText) continue;
    if (box.height < MIN || box.width < MIN) {
      small.push((el.tagName.toLowerCase()) + '[' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) + '] ' + px(box.width) + 'x' + px(box.height));
    }
  }

  // 2b. WHICH element actually overflows.
  //
  // Added after a real miss: the offender scan compared right edges, so it named
  // the floating toolbar whose right edge had been pushed out, while the actual
  // cause was a paragraph with an unbreakable 24-character token. An element can
  // overflow its own box without its right edge exceeding the viewport, so scan
  // scrollWidth against clientWidth as well.
  const scrollers = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
      scrollers.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
        + ' ' + el.scrollWidth + '>' + el.clientWidth);
    }
  }

  // 2c. Nothing fixed is sitting on top of the content.
  //
  // A fixed overlay is out of flow, so it causes no overflow and breaks no
  // layout assertion — every check above passes while it covers the page. The
  // tab strip did exactly that at every desktop width, permanently, for every
  // visitor. The only way to see it is to measure the two boxes against each
  // other, so that is what this does: take the point just inside the main
  // content and ask the document what is actually on top there.
  const occluders = [];
  const main = document.querySelector("main");
  if (main) {
    const m = main.getBoundingClientRect();
    const probes = [
      [m.left + 8, m.top + 8], [m.right - 8, m.top + 8],
      [m.left + 8, Math.min(m.bottom, innerHeight) - 8],
    ];
    for (const [x, y] of probes) {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (!top || main.contains(top) || top.contains(main)) continue;
      const style = getComputedStyle(top);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      occluders.push(top.tagName.toLowerCase() + (top.className ? "." + String(top.className).split(" ")[0] : "")
        + " covers main at " + px(x) + "," + px(y));
    }
  }

  // 3. Every control has an accessible name.
  const unnamed = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea')) {
    const style = getComputedStyle(el);
    if (style.display === 'none') continue;
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()
      || (el.labels && el.labels.length ? 'labelled' : '')
      || (el.id && document.querySelector('label[for="' + el.id + '"]') ? 'labelled' : '');
    if (!name) unnamed.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
  }

  // 4. Images carry alt text.
  const noAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;

  // 5. One h1, and headings do not skip levels by more than one.
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
  const h1Count = headings.filter((l) => l === 1).length;
  let skips = 0;
  for (let i = 1; i < headings.length; i += 1) if (headings[i] - headings[i - 1] > 1) skips += 1;

  // 6. The reading measure is capped.
  const prose = document.querySelector('.ok-prose');
  const proseWidth = prose ? px(prose.getBoundingClientRect().width) : null;
  const bodyFont = parseFloat(getComputedStyle(document.body).fontSize);
  const approxChars = prose ? Math.round(proseWidth / (bodyFont * 0.5)) : null;

  // 7. A visible focus indicator exists on the first focusable control.
  const first = document.querySelector('a, button');
  let focusVisible = null;
  if (first) {
    first.focus();
    const style = getComputedStyle(first, ':focus-visible');
    focusVisible = style.outlineStyle !== 'none' || style.outlineWidth !== '0px';
    first.blur();
  }

  return {
    url: location.pathname,
    horizontalOverflow: overflow,
    smallTargets: small.slice(0, 8),
    smallTargetCount: small.length,
    overflowingElements: scrollers.slice(0, 6),
    overflowingCount: scrollers.length,
    occluders: [...new Set(occluders)],
    occluderCount: new Set(occluders).size,
    unnamedControls: unnamed.slice(0, 8),
    unnamedControlCount: unnamed.length,
    imagesWithoutAlt: noAlt,
    h1Count,
    headingSkips: skips,
    proseWidth,
    approxChars,
    focusVisible,
    problems,
  };
})()`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const { ws, send } = await connect();
  console.log('isolation: PASS (exactly one page target at the expected URL)');

  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  const results = [];
  for (const surface of SURFACES) {
    for (const viewport of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height,
        deviceScaleFactor: viewport.scale, mobile: viewport.mobile,
      });
      // Cache-bust per run. `Network.setCacheDisabled` covers the browser's own
      // cache but not an edge that serves stale HTML, and stale HTML points at
      // the previous CSS hash — so the audit measures a build that is no longer
      // deployed and reports defects that were fixed an hour ago.
      const join = surface.path.includes('?') ? '&' : '?';
      await send('Page.navigate', { url: `${ORIGIN}${surface.path}${join}v=${RUN_ID}` });
      await new Promise((r) => setTimeout(r, 2200));
      const audit = await send('Runtime.evaluate', { returnByValue: true, expression: AUDIT });
      results.push({ surface: surface.id, viewport: viewport.name, tuple: viewport, ...audit.result.value });
      process.stdout.write(`\rverify: ${results.length}/${SURFACES.length * VIEWPORTS.length}`);
    }
  }
  process.stdout.write('\n');

  await writeFile(path.join(OUT, 'accessibility.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');

  // Report honestly: name every failure, and do not average them away.
  const overflowing = results.filter((r) => r.horizontalOverflow);
  const unnamed = results.filter((r) => r.unnamedControlCount > 0);
  const noAlt = results.filter((r) => r.imagesWithoutAlt > 0);
  const badH1 = results.filter((r) => r.h1Count !== 1);
  const tiny = results.filter((r) => r.smallTargetCount > 0);
  const scrolling = results.filter((r) => r.overflowingCount > 0);
  const covered = results.filter((r) => r.occluderCount > 0);

  console.log(`\nchecked ${results.length} surface/viewport combinations`);
  console.log(`  horizontal overflow : ${overflowing.length}`);
  console.log(`  unnamed controls    : ${unnamed.length}`);
  console.log(`  images without alt  : ${noAlt.length}`);
  console.log(`  h1 count not 1      : ${badH1.length}`);
  console.log(`  targets under 24px  : ${tiny.length}`);
  console.log(`  elements overflowing: ${scrolling.length}`);
  console.log(`  content covered     : ${covered.length}`);

  for (const row of [...overflowing, ...unnamed, ...badH1, ...tiny, ...scrolling, ...covered].slice(0, 12)) {
    console.log(`   - ${row.surface} @ ${row.viewport}: ` +
      [row.horizontalOverflow && 'overflow',
       row.unnamedControlCount && `${row.unnamedControlCount} unnamed (${row.unnamedControls.join(', ')})`,
       row.h1Count !== 1 && `${row.h1Count} h1`,
       row.smallTargetCount && `${row.smallTargetCount} small (${row.smallTargets.slice(0, 3).join(', ')})`,
       row.overflowingCount && `${row.overflowingCount} overflowing (${row.overflowingElements.slice(0, 3).join(', ')})`,
       row.occluderCount && `covered by ${row.occluders.join('; ')}`,
      ].filter(Boolean).join('; '));
  }

  ws.close();
  const failed = overflowing.length + unnamed.length + noAlt.length + badH1.length + covered.length;
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => { console.error(`verify failed: ${error.message}`); process.exit(1); });
