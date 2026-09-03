#!/usr/bin/env node
/**
 * Turn the captured corpus into renderable articles.
 *
 * Two inputs, deliberately: typed facts come from the **wikitext**, where an
 * infobox is a template call with named parameters and is trivially exact; the
 * body comes from the **expanded HTML**, because `{{Ore}}`, `{{Wood}}` and the
 * nav boxes are real templates and re-implementing MediaWiki's expander is a
 * project of its own.
 *
 * Everything the source wraps its content in is removed here rather than hidden
 * with CSS: edit pencils, sign-in links, sprite icons, nav boxes, and the
 * infobox itself (which is re-presented as a Key facts card instead of a
 * right-floating table that falls off a phone).
 */
import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus');
const OUT = path.join(ROOT, 'data', 'articles');

/* ------------------------------------------------------- titles and slugs */

/**
 * MediaWiki title -> the path segment this site uses.
 *
 * A wiki title may legally contain characters that Windows forbids in a path —
 * this wiki really does have an article called `? ? ?` — and the prerenderer
 * writes one directory per article, so the segment must be safe on disk as well
 * as in a URL. Percent-encoding satisfies both, and is what a URL needs anyway.
 */
export function slugFor(title) {
  return title
    .replace(/ /g, '_')
    .replace(/[<>:"/\|?*%#]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

/** Reverse, for matching a link target back to an article. */
export function titleFromSlug(slug) {
  return slug.replace(/_/g, ' ');
}

/* ----------------------------------------------- infobox, from the wikitext */

/**
 * Split a template call's parameters at top level, respecting nested `{{ }}`,
 * `[[ ]]` and `<gallery>`. A naive split on `|` tears every wikilink in half,
 * which is how an infobox ends up with a field called `[[Finlay Island`.
 */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i += 1) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth += 1; current += two; i += 1; continue; }
    if (two === '}}' || two === ']]') { depth -= 1; current += two; i += 1; continue; }
    const char = body[i];
    if (char === '|' && depth === 0) { parts.push(current); current = ''; continue; }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Strip wiki markup from a short field value, keeping the plain text. */
export function plainValue(raw) {
  return raw
    .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The templates that actually carry an article's facts on this wiki.
 *
 * Hand-written, and derived from the corpus rather than guessed. The first
 * version of this list was invented from plausible names and matched 184 of
 * 1,063 articles, because this wiki's largest infobox is called `Objects` and
 * nothing in the plan predicted that. Guessing a vocabulary is how a feature
 * ships looking finished while covering a sixth of the data.
 *
 * `NOT_INFOBOX` records the maintenance banners that also take named
 * parameters, so they are excluded deliberately rather than by accident.
 */
const INFOBOX_TEMPLATES = [
  'Objects', 'Wood', 'Ore', 'Buildings', 'Axe', 'Logic', 'Schematics', 'Stone',
  'Tool', 'Vehicles', 'NPC', 'Pickaxe', 'Explosive', 'Chisel template', 'Saw',
  'Character', 'Burl', 'UGC',
];
const NOT_INFOBOX = [
  'Stub', 'Removed', 'Delete', 'Trade-only', 'Unobtainable',
  'Missing Info', 'Under Construction', 'DISPLAYTITLE',
];

/**
 * Pull the article's infobox out of wikitext as typed key/value pairs.
 *
 * It is deliberately NOT "the first template": a maintenance banner such as
 * `{{Stub}}` regularly sits above the infobox, so taking the first would file a
 * stub notice as the article's facts.
 *
 * Returns null when the article has none, which is a normal state and not a
 * failure — plenty of pages are prose only.
 */
export function extractInfobox(wikitext) {
  const escaped = INFOBOX_TEMPLATES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const match = new RegExp(String.raw`\{\{\s*(` + escaped.join('|') + String.raw`)\s*[|\n}]`, 'i').exec(wikitext);
  if (!match) return null;

  const start = match.index;
  let depth = 0;
  let end = -1;
  for (let i = start; i < wikitext.length; i += 1) {
    if (wikitext.slice(i, i + 2) === '{{') { depth += 1; i += 1; continue; }
    if (wikitext.slice(i, i + 2) === '}}') { depth -= 1; i += 1; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) return null;

  const inner = wikitext.slice(start + 2, end - 2);
  const parts = splitTopLevel(inner);
  const type = parts.shift().trim();

  const fields = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = plainValue(part.slice(eq + 1));
    // An image parameter is a gallery of file names, not a fact.
    if (!key || !value || /^image\d*$/i.test(key)) continue;
    fields.push({ label: key.replace(/([a-z])([A-Z])/g, '$1 $2'), value });
  }
  return fields.length > 0 ? { type, fields } : null;
}

/* ------------------------------------------------------------- body cleanup */

/** Class or tag patterns that are the source's own chrome, not content. */
const CHROME_SELECTORS = [
  'aside.portable-infobox',      // re-presented as the Key facts card
  '.navbox', '.navbox-group', 'table.navbox',
  '.mw-editsection',             // edit pencil plus sign-in link
  '.mw-empty-elt',
  '.wds-tabs__wrapper', '.wds-tabs',
  '.noprint', '.metadata', '.ambox',
  'script', 'style', 'iframe', 'embed', 'object', 'link', 'meta',
];

/** Attributes never carried over: presentation and tracking both go. */
// `id` is deliberately NOT dropped: the sanitiser assigns heading anchors above,
// and stripping them here would leave the table of contents linking to nothing.
const DROP_ATTRIBUTES = [
  'style', 'class', 'onclick', 'onload', 'onerror', 'srcset', 'sizes',
  'data-tracking-label', 'data-action', 'data-testid', 'data-image-key',
  'data-image-name', 'data-src', 'data-video-key', 'referrerpolicy', 'loading',
];

export function sanitiseBody(html, { resolveTitle, slugOf = slugFor }) {
  let root = parse(html, { blockTextElements: { script: false, style: false } });

  for (const selector of CHROME_SELECTORS) {
    for (const node of root.querySelectorAll(selector)) node.remove();
  }

  // Unwrap the source's own parser-output wrapper.
  //
  // Not cosmetic: the reader spaces an article with `.ok-article__body > * + *`,
  // and while every paragraph sits inside a single wrapper div that selector
  // matches exactly one element. The result renders as a wall of text with
  // correct-looking CSS, which is the hardest kind of layout bug to see in a
  // diff and the easiest to see on a phone.
  const wrapper = root.childNodes.filter((node) => node.nodeType === 1);
  if (wrapper.length === 1 && wrapper[0].rawTagName === 'div') {
    root = parse(wrapper[0].innerHTML, { blockTextElements: { script: false, style: false } });
  }

  // Headings: the source embeds decorative images inside heading text, e.g.
  // `== [[File:Hexagon Dollar.png|50x50px]] Selling Price ==`. A heading is text.
  // Each gets a stable, unique anchor so the table of contents can reach it.
  const usedIds = new Set();
  const sections = [];
  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    for (const image of heading.querySelectorAll('img, figure, .image')) image.remove();
    const text = heading.text.replace(/\s+/g, ' ').trim();
    if (!text) { heading.remove(); continue; }
    heading.set_content(escapeText(text));

    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    let suffix = 2;
    while (usedIds.has(id)) id = `${id}-${suffix++}`;
    usedIds.add(id);
    heading.setAttribute('id', id);
    if (heading.rawTagName === 'h2') sections.push({ id, text });
  }

  // Media lands in a later phase. Until the release-backed volumes exist, every
  // media slot renders an honest local placeholder naming the file rather than
  // hotlinking the source's CDN.
  //
  // This deliberately covers more than <img>. The first version handled images
  // only, and the built-output guard then found the CDN still reachable through
  // <video>, <audio>, <source> and plain anchors pointing at a file — the same
  // hotlink, just not in the element anyone thinks of first.
  const placeholder = (name, kind) =>
    parse(
      `<span class="ok-media-placeholder" role="img" aria-label="${escapeAttribute(kind)} not yet archived: ${escapeAttribute(name)}">${escapeText(name)}</span>`,
    );

  for (const image of root.querySelectorAll('img')) {
    const name = image.getAttribute('alt') || image.getAttribute('data-image-name') || 'image';
    image.replaceWith(placeholder(name, 'Image'));
  }
  for (const media of root.querySelectorAll('video, audio, source, track')) {
    const name = media.getAttribute('data-video-key') || media.getAttribute('title') || 'media file';
    media.replaceWith(placeholder(name, 'Media'));
  }

  // An anchor whose target is the media CDN is a file link, not an article link.
  for (const anchor of root.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? '';
    if (/(?:static|images?\d*|vignette\d*)\.(?:wikia|nocookie)\./.test(href) || /\/images\//.test(href)) {
      const name = anchor.text.trim() || 'media file';
      anchor.replaceWith(placeholder(name, 'Media'));
    }
  }

  // Links: internal ones point at this site, external ones are marked safe, and
  // an unresolved target becomes plain text rather than a dead href.
  for (const anchor of root.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? '';
    const wiki = /^\/wiki\/([^#?]+)/.exec(href);
    if (wiki) {
      const target = decodeURIComponent(wiki[1]);
      const resolved = resolveTitle(target);
      if (resolved) {
        anchor.setAttribute('href', `__BASE__/wiki/${slugOf(resolved)}/`);
        anchor.removeAttribute('title');
      } else {
        // Never emit an href that goes nowhere.
        anchor.replaceWith(parse(`<span data-unresolved="1">${anchor.innerHTML}</span>`));
      }
      continue;
    }
    if (/^https?:\/\//.test(href)) {
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
      anchor.setAttribute('referrerpolicy', 'no-referrer');
      continue;
    }
    anchor.replaceWith(parse(`<span>${anchor.innerHTML}</span>`));
  }

  // Tables scroll inside their own box so the page body never scrolls sideways.
  for (const table of root.querySelectorAll('table')) {
    table.replaceWith(parse(`<div class="ok-tablewrap">${table.outerHTML}</div>`));
  }

  for (const node of root.querySelectorAll('*')) {
    for (const attribute of DROP_ATTRIBUTES) {
      if (node.getAttribute(attribute) !== undefined) node.removeAttribute(attribute);
    }
  }
  // Re-apply the two classes the renderer itself needs.
  for (const wrap of root.querySelectorAll('div')) {
    if (wrap.innerHTML.trim().startsWith('<table')) wrap.setAttribute('class', 'ok-tablewrap');
  }

  // A paragraph holding only line breaks is the source's spacing hack, and it
  // renders here as an unexplained gap because this layout spaces blocks itself.
  for (const paragraph of root.querySelectorAll('p')) {
    if (paragraph.text.trim() === '' && paragraph.querySelectorAll('img, span, a').length === 0) {
      paragraph.remove();
    }
  }

  const cleaned = root.innerHTML
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Fail loudly rather than shipping a hotlink.
  //
  // The DOM passes above are the intended mechanism, but they proved fragile in
  // exactly the way DOM surgery usually is: rewriting an <a> replaces its
  // subtree, so an <img> inside a link that had already been replaced was no
  // longer reachable by a later querySelectorAll, and two images per article
  // survived every pass while looking handled. A string assertion cannot be
  // outwitted by tree surgery, and this is the last line before the corpus is
  // written.
  const leak = /(?:static|images?\d*|vignette\d*)\.(?:wikia|nocookie)\.[a-z.]+/i.exec(cleaned);
  if (leak) {
    throw new Error(
      `sanitiser left a source CDN reference in the body: ${leak[0]} — media must render a local placeholder, never a hotlink`,
    );
  }

  return { html: cleaned, sections };
}

const escapeAttribute = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* --------------------------------------------------------------------- main */

async function main() {
  const pointer = JSON.parse(await readFile(path.join(CORPUS, 'current.json'), 'utf8'));
  const snapshot = path.join(CORPUS, pointer.snapshotId);
  const articles = JSON.parse(await readFile(path.join(snapshot, 'articles.json'), 'utf8'));
  const redirects = JSON.parse(await readFile(path.join(snapshot, 'redirects.json'), 'utf8'));
  const parsedDir = path.join(snapshot, 'parsed');

  const byTitle = new Map(articles.map((a) => [a.title, a]));
  const lowerToTitle = new Map(articles.map((a) => [a.title.toLowerCase(), a.title]));

  // A redirect is not a missing page; it is a page with another name. Without
  // this map, 517 perfectly good internal links would render as plain text.
  let redirectTargets = [];
  try {
    redirectTargets = JSON.parse(await readFile(path.join(snapshot, 'redirect-targets.json'), 'utf8'));
  } catch {
    console.log('build-articles: no redirect-targets.json — links to redirects will not resolve');
  }
  const redirectMap = new Map(redirectTargets.map((r) => [r.from.toLowerCase(), r.to]));
  void redirects;

  /** A link target resolves to an article title, or to nothing at all. */
  const resolveTitle = (target) => {
    const normalised = titleFromSlug(target).replace(/_/g, ' ');
    if (byTitle.has(normalised)) return normalised;

    // Case-insensitive second chance: the source carries both `Acid staff` and
    // `Acid Staff`, and a link may point at either.
    const lower = normalised.toLowerCase();
    if (lowerToTitle.has(lower)) return lowerToTitle.get(lower);

    // Follow one redirect hop, then require a real article at the end of it.
    const via = redirectMap.get(lower);
    if (via) {
      if (byTitle.has(via)) return via;
      const viaLower = via.toLowerCase();
      if (lowerToTitle.has(viaLower)) return lowerToTitle.get(viaLower);
    }
    return null;
  };

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const index = [];
  let withInfobox = 0;
  let unresolvedLinks = 0;
  const failures = [];

  const files = new Set(await readdir(parsedDir));

  // Images we actually hold. Absent manifest = no images yet, which is a normal
  // early state and must not stop the build.
  let mediaManifest = {};
  try {
    mediaManifest = JSON.parse(await readFile(path.join(ROOT, 'data', 'media-manifest.json'), 'utf8'));
  } catch {
    console.log('build-articles: no media manifest yet — articles will carry no hero image');
  }

  /*
   * MediaWiki titles are case-sensitive after the first letter, so `Acid staff`
   * and `Acid Staff` are two genuinely different pages. Filesystems on Windows
   * and macOS are not case-sensitive, and neither are most URL routers — so the
   * two collapse onto one path and the second silently overwrites the first.
   *
   * This was not theoretical: four pairs collided here, and the build reported
   * 1,063 articles while writing 1,059 pages. Nothing failed; four articles
   * would simply have shown another article's content.
   *
   * The lowest page id keeps the plain slug so existing URLs stay stable, and
   * later ones are disambiguated deterministically.
   */
  const byLowerSlug = new Map();
  for (const article of articles) {
    const key = slugFor(article.title).toLowerCase();
    if (!byLowerSlug.has(key)) byLowerSlug.set(key, []);
    byLowerSlug.get(key).push(article);
  }
  const uniqueSlug = new Map();
  const slugForTitle = (title) => {
    const found = byTitle.get(title);
    return found ? uniqueSlug.get(found.pageid) ?? slugFor(title) : slugFor(title);
  };
  let disambiguated = 0;
  for (const group of byLowerSlug.values()) {
    const ordered = [...group].sort((a, b) => a.pageid - b.pageid);
    for (const [position, article] of ordered.entries()) {
      const base = slugFor(article.title);
      uniqueSlug.set(article.pageid, position === 0 ? base : `${base}~${article.pageid}`);
      if (position > 0) disambiguated += 1;
    }
  }

  for (const article of articles) {
    const file = `${article.pageid}.json`;
    if (!files.has(file)) { failures.push({ title: article.title, reason: 'no parsed HTML' }); continue; }

    const parsed = JSON.parse(await readFile(path.join(parsedDir, file), 'utf8'));
    const infobox = extractInfobox(article.wikitext);
    if (infobox) withInfobox += 1;

    const { html: body, sections } = sanitiseBody(parsed.html, { resolveTitle, slugOf: slugForTitle });
    unresolvedLinks += (body.match(/data-unresolved="1"/g) ?? []).length;

    // The first referenced image that we actually hold becomes the article's
    // hero. Never a guess: an image absent from the manifest is simply absent,
    // and the surface renders its own placeholder rather than a broken tag.
    // Normalise before matching. The manifest is keyed by the API's page title,
    // which uses SPACES (`Dynamite Stick 1x.png`), while an article's image list
    // uses UNDERSCORES (`Dynamite_Stick_1x.png`). MediaWiki treats the two as
    // the same title; a plain lookup does not, and matching them literally left
    // 371 articles with no art while every part looked correct.
    const hero = (parsed.images ?? [])
      .map((name) => mediaManifest[name] ?? mediaManifest[name.replace(/_/g, ' ')])
      .find((entry) => entry && entry.file) ?? null;

    const record = {
      title: article.title,
      slug: uniqueSlug.get(article.pageid),
      hero: hero ? { file: hero.file, width: hero.width, height: hero.height } : null,
      pageid: article.pageid,
      revid: parsed.revid ?? article.revid,
      timestamp: article.timestamp,
      lastEditor: article.user,
      categories: parsed.categories?.length ? parsed.categories : article.categories,
      infobox,
      sections,
      body,
    };
    await writeFile(path.join(OUT, `${article.pageid}.json`), `${JSON.stringify(record)}\n`, 'utf8');

    index.push({
      title: record.title, slug: record.slug, pageid: record.pageid,
      hero: record.hero,
      categories: record.categories, infoboxType: infobox?.type ?? null,
    });
  }

  index.sort((a, b) => a.title.localeCompare(b.title));
  await writeFile(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 0)}\n`, 'utf8');

  // Category browse. Built from the categories each article actually carries,
  // not from a curated list, so a category cannot silently lose members.
  const byCategory = new Map();
  for (const entry of index) {
    for (const category of entry.categories ?? []) {
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push({
        title: entry.title, slug: entry.slug, infoboxType: entry.infoboxType, hero: entry.hero,
      });
    }
  }
  const categories = [...byCategory.entries()]
    .map(([name, members]) => ({
      name,
      slug: slugFor(name),
      count: members.length,
      articles: members.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // A category tile shows the first image any of its members has, so a category
  // is never represented by a blank square while its articles have art.
  for (const category of categories) {
    category.hero = category.articles.find((a) => a.hero)?.hero ?? null;
  }

  await writeFile(path.join(OUT, 'categories.json'), `${JSON.stringify(categories, null, 0)}\n`, 'utf8');

  // Home: the twelve largest categories plus a dozen articles that have art.
  const home = {
    categories: categories.slice(0, 12).map((c) => ({ name: c.name, slug: c.slug, count: c.count, hero: c.hero })),
    featured: index.filter((entry) => entry.hero).slice(0, 12).map((entry) => ({
      title: entry.title, slug: entry.slug, hero: entry.hero, infoboxType: entry.infoboxType,
    })),
    totals: {
      articles: index.length,
      categories: categories.length,
      images: Object.keys(mediaManifest).length,
    },
  };
  await writeFile(path.join(OUT, 'home.json'), `${JSON.stringify(home, null, 0)}\n`, 'utf8');

  // Browse: every article, with the values its filters actually use.
  const browse = {
    articles: index.map((entry) => ({
      title: entry.title, slug: entry.slug, hero: entry.hero,
      categories: entry.categories ?? [], infoboxType: entry.infoboxType,
    })),
    categories: categories.map((c) => ({ name: c.name, slug: c.slug, count: c.count })),
    types: [...new Set(index.map((e) => e.infoboxType).filter(Boolean))].sort(),
  };
  await writeFile(path.join(OUT, 'browse.json'), `${JSON.stringify(browse, null, 0)}\n`, 'utf8');
  const uncategorised = index.filter((entry) => (entry.categories ?? []).length === 0).length;
  console.log(`build-articles: ${categories.length} categories, ${uncategorised} article(s) carry none`);

  if (index.length === 0) throw new Error('built no articles — refusing to report success');

  console.log(`build-articles: ${index.length} articles, ${withInfobox} with a typed infobox`);
  if (disambiguated > 0) console.log(`build-articles: ${disambiguated} slug(s) disambiguated after a case-insensitive collision`);
  console.log(`build-articles: ${unresolvedLinks} link(s) had no target and render as plain text, never a dead href`);
  if (failures.length > 0) console.log(`build-articles: ${failures.length} skipped (no parsed HTML)`);
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`build-articles failed: ${error.message}`); process.exit(1); });
}
