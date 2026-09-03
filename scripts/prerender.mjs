#!/usr/bin/env node
/**
 * Prerender every route to static HTML.
 *
 * This is not an optimisation. The embed-graphic contract requires real `og:`
 * tags in the markup the server sends, and the crawler does not run JavaScript,
 * so tags injected at runtime do not exist as far as an embed is concerned.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.SITE_BASE ?? '/oaklands-wiki/').replace(/\/+$/, '/');
const ORIGIN = process.env.SITE_ORIGIN ?? 'https://ding-ding-projects.github.io';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Absolute https URL. A relative og:image is the commonest reason no picture shows. */
function absolute(pathname) {
  return new URL(pathname.replace(/^\//, ''), `${ORIGIN}${BASE}`).toString();
}

function headFor({ title, description, canonical }) {
  const image = absolute('social-preview.png');
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Oaklands Wiki" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Oaklands Wiki — a reading-first encyclopedia for Oaklands" />`,
    // This one line decides between a large picture and a small side thumbnail.
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ');
}

async function main() {
  const { render } = await import(pathToFileURL(path.join(ROOT, 'dist-ssr', 'entry-server.js')).href);
  const list = JSON.parse(await readFile(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('data/routes.json is empty — refusing to prerender nothing');
  }

  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  if (!template.includes('<!--app-html-->')) {
    throw new Error('dist/index.html is missing the <!--app-html--> placeholder');
  }

  let written = 0;
  for (const route of list) {
    const canonical = absolute(route.path === '/' ? '' : `${route.path.replace(/^\//, '')}/`);
    const html = template
      .replace('<!--app-html-->', render(route.id))
      .replace(/<title>.*?<\/title>/s, headFor({ ...route, canonical }));
    if (/<meta name="description"[^>]*>[^]*<meta name="description"/.test(html)) {
      throw new Error(`duplicate description meta on ${route.path}`);
    }

    const outDir = route.path === '/' ? DIST : path.join(DIST, route.path.replace(/^\//, ''));
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
    written += 1;
    console.log(`prerendered ${route.path} -> ${path.relative(ROOT, path.join(outDir, 'index.html'))}`);
  }

  // GitHub Pages serves 404.html for unknown paths.
  await writeFile(path.join(DIST, '404.html'), await readFile(path.join(DIST, 'index.html'), 'utf8'), 'utf8');
  // Tell Pages not to run the built output through Jekyll.
  await writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');

  console.log(`prerender: ${written} route(s)`);
  if (written === 0) throw new Error('prerender wrote no routes');
}

main().catch((error) => {
  console.error(`prerender failed: ${error.message}`);
  process.exit(1);
});
