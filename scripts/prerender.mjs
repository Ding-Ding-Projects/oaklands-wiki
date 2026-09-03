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
  const { render, THEME_INLINE_SCRIPT } = await import(pathToFileURL(path.join(ROOT, 'dist-ssr', 'entry-server.js')).href);
  const list = JSON.parse(await readFile(path.join(ROOT, 'data', 'routes.json'), 'utf8'));
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('data/routes.json is empty — refusing to prerender nothing');
  }

  let template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  // Applied before paint so a returning visitor never sees the wrong theme flash.
  template = template.replace('</head>', '<script>' + THEME_INLINE_SCRIPT + '</script></head>');
  if (!template.includes('<!--app-html-->')) {
    throw new Error('dist/index.html is missing the <!--app-html--> placeholder');
  }

  // Payloads for the routes that need data. A route listed in routes.json but
  // missing its payload file renders its honest fallback rather than a blank.
  const payloadFor = async (id) => {
    const file = { home: 'home.json', browse: 'browse.json' }[id];
    if (!file) return undefined;
    try {
      return JSON.parse(await readFile(path.join(ROOT, 'data', 'articles', file), 'utf8'));
    } catch {
      console.log(`prerender: no ${file} — ${id} will render without data`);
      return undefined;
    }
  };

  let written = 0;
  for (const route of list) {
    const canonical = absolute(route.path === '/' ? '' : `${route.path.replace(/^\//, '')}/`);
    const payload = await payloadFor(route.id);
    let html = template
      .replace('<!--app-html-->', render(route.id, payload))
      .replace(/<title>.*?<\/title>/s, headFor({ ...route, canonical }));
    if (payload) {
      const encoded = JSON.stringify(payload).replace(/</g, '\\u003c');
      html = html.replace(
        '</body>',
        `<script>window.__PAGE_ROUTE__=${JSON.stringify(route.id)};window.__PAGE_DATA__=${encoded}</script></body>`,
      );
    }
    if (/<meta name="description"[^>]*>[^]*<meta name="description"/.test(html)) {
      throw new Error(`duplicate description meta on ${route.path}`);
    }

    const outDir = route.path === '/' ? DIST : path.join(DIST, route.path.replace(/^\//, ''));
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
    written += 1;
    console.log(`prerendered ${route.path} -> ${path.relative(ROOT, path.join(outDir, 'index.html'))}`);
  }

  // ---- Article routes -------------------------------------------------
  // Every captured article gets its own prerendered page. The article BODY is
  // never hydrated — it is static text that React does not own — but the page
  // does load the bundle, because the settings panel, command palette and
  // notifications must work on every surface rather than on the few that happen
  // to be interactive. The bundle mounts into its own empty container and leaves
  // the prerendered body untouched.
  let articleIndex = [];
  try {
    articleIndex = JSON.parse(await readFile(path.join(ROOT, 'data', 'articles', 'index.json'), 'utf8'));
  } catch {
    console.log('prerender: no data/articles/index.json — skipping article routes');
  }

  for (const entry of articleIndex) {
    const record = JSON.parse(
      await readFile(path.join(ROOT, 'data', 'articles', `${entry.pageid}.json`), 'utf8'),
    );
    // The sanitiser leaves a base-path placeholder so the corpus stays portable
    // between a Pages sub-path and any other deployment.
    record.body = record.body.replaceAll('__BASE__', BASE.replace(/\/$/, ''));

    const canonical = absolute(`wiki/${record.slug}/`);
    const description = record.infobox
      ? `${record.title} — ${record.infobox.fields.slice(0, 3).map((f) => `${f.label}: ${f.value}`).join(', ')}. From the Oaklands community wiki.`
      : `${record.title} — an article archived from the Oaklands community wiki.`;

    const html = template
      .replace('<!--app-html-->', render('article', record))
      .replace(/<title>.*?<\/title>/s, headFor({ title: `${record.title} — Oaklands Wiki`, description, canonical }));

    const outDir = path.join(DIST, 'wiki', record.slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
    written += 1;
  }
  if (articleIndex.length > 0) console.log(`prerender: ${articleIndex.length} article route(s)`);

  // ---- Category routes --------------------------------------------------
  // These DO hydrate: the search field and its regex builder are real
  // interaction, so the payload is inlined and the client entry picks it up.
  let categories = [];
  try {
    categories = JSON.parse(await readFile(path.join(ROOT, 'data', 'articles', 'categories.json'), 'utf8'));
  } catch {
    console.log('prerender: no categories.json — skipping category routes');
  }

  for (const category of categories) {
    const canonical = absolute(`category/${category.slug}/`);
    const readable = category.name.replace(/_/g, ' ');
    // JSON embedded in a script element must not be able to close it early.
    const payload = JSON.stringify(category).replace(/</g, '\\u003c');
    const html = template
      .replace('<!--app-html-->', render('category', category))
      .replace(/<title>.*?<\/title>/s, headFor({
        title: `${readable} — Oaklands Wiki`,
        description: `Every article in ${readable}: ${category.count} pages archived from the Oaklands community wiki, searchable by plain text or regular expression.`,
        canonical,
      }))
      .replace('</body>', `<script>window.__PAGE_ROUTE__="category";window.__PAGE_DATA__=${payload}</script></body>`);

    const outDir = path.join(DIST, 'category', category.slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
    written += 1;
  }
  if (categories.length > 0) console.log(`prerender: ${categories.length} category route(s)`);

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
