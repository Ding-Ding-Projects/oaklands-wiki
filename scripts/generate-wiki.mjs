#!/usr/bin/env node
/**
 * Generate the GitHub wiki mirror from the same corpus the site renders.
 *
 * One corpus, two surfaces. Neither is hand-written, so they cannot drift apart
 * and disagree about what an article says.
 *
 * Output goes to `build/wiki/`. Pushing it needs the wiki repository to exist,
 * and `has_wiki: true` does not create it — a first page must be made through
 * the web UI before `<repo>.wiki.git` resolves at all. Verified against sibling
 * repositories: one had the flag set and no wiki repository, another had a real
 * wiki on branch `master`. So this writes to disk unconditionally and says
 * plainly whether the remote is reachable.
 *
 * The wiki is a PUBLIC record: no private vocabulary, ever.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = path.join(ROOT, 'data', 'articles');
const OUT = path.join(ROOT, 'build', 'wiki');

const SOURCE = 'https://oaklands.fandom.com';
const SITE = 'https://ding-ding-projects.github.io/oaklands-wiki';
const REPO = 'https://github.com/Ding-Ding-Projects/oaklands-wiki';
const LICENCE = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** A wiki page filename. GitHub wikis map `/` in a title to a directory. */
function pageName(slug) {
  return `${slug.replace(/\//g, '-')}.md`;
}

const escapePipes = (text) => text.replace(/\|/g, '\\|');

/**
 * Sanitised article HTML -> GitHub-flavored Markdown.
 *
 * Deliberately small: the body is already clean, so this converts the handful of
 * constructs it actually contains rather than pretending to be a general
 * HTML-to-Markdown engine. Anything unrecognised falls through as its text,
 * which is honest, rather than as broken markup.
 */
export function toMarkdown(html, { linkBase }) {
  const root = parse(html);
  const lines = [];

  const inline = (node) => {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { out += child.rawText.replace(/\s+/g, ' '); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.rawTagName?.toLowerCase();
      const inner = inline(child);
      if (tag === 'a') {
        const target = child.getAttribute('href') ?? '';
        // A GitHub wiki links by PAGE NAME, not by path. `__BASE__/wiki/Copper/`
        // must become `Copper`, or every internal link in the mirror 404s while
        // looking perfectly well-formed.
        const internal = /^__BASE__\/wiki\/(.+?)\/?$/.exec(target);
        // Parentheses in a page name must be encoded: Markdown ends a link
        // target at the first unescaped `)`, so `[X](Page_(disambiguation))`
        // truncates to `Page_(disambiguation` and 404s while looking
        // entirely well-formed in the source.
        // A GitHub wiki has no file or category pages, so those two link kinds
        // point at the site, which does. Rewriting them to a wiki page name
        // would produce a link that is well-formed and 404s — the mirror's own
        // link check caught 107 of exactly that shape.
        const offsite = /^__BASE__\/(file|category)\/(.+?)\/?$/.exec(target);
        const resolved = internal
          ? `${linkBase}${internal[1].replace(/\//g, '-').replace(/\(/g, '%28').replace(/\)/g, '%29')}`
          : offsite
            ? `${SITE}/${offsite[1]}/${offsite[2].replace(/\(/g, '%28').replace(/\)/g, '%29')}/`
            : target;
        out += resolved ? `[${inner}](${resolved})` : inner;
      } else if (tag === 'strong' || tag === 'b') out += `**${inner}**`;
      else if (tag === 'em' || tag === 'i') out += `_${inner}_`;
      else if (tag === 'code') out += `\`${inner}\``;
      else if (tag === 'br') out += '  \n';
      else if (tag === 'span' && child.getAttribute('class') === 'ok-media-placeholder') {
        out += `_[media not archived: ${inner}]_`;
      } else out += inner;
    }
    return out;
  };

  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      const tag = child.rawTagName?.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(Number(tag[1]) + 1, 6);
        lines.push('', `${'#'.repeat(level)} ${child.text.trim()}`, '');
      } else if (tag === 'p') {
        const text = inline(child).trim();
        if (text) lines.push(text, '');
      } else if (tag === 'ul' || tag === 'ol') {
        for (const [index, item] of child.querySelectorAll('li').entries()) {
          const marker = tag === 'ol' ? `${index + 1}.` : '-';
          const text = inline(item).trim();
          if (text) lines.push(`${marker} ${text}`);
        }
        lines.push('');
      } else if (tag === 'table' || (tag === 'div' && child.querySelector('table'))) {
        const table = tag === 'table' ? child : child.querySelector('table');
        const rows = table.querySelectorAll('tr');
        if (rows.length > 0) {
          const header = rows[0].querySelectorAll('th, td').map((cell) => escapePipes(cell.text.trim()));
          lines.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
          for (const row of rows.slice(1)) {
            const cells = row.querySelectorAll('th, td').map((cell) => escapePipes(cell.text.trim()));
            if (cells.length) lines.push(`| ${cells.join(' | ')} |`);
          }
          lines.push('');
        }
      } else if (tag === 'blockquote') {
        for (const line of inline(child).trim().split('\n')) lines.push(`> ${line}`);
        lines.push('');
      } else {
        walk(child);
      }
    }
  };

  walk(root);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
  const index = JSON.parse(await readFile(path.join(ARTICLES, 'index.json'), 'utf8'));
  const categories = JSON.parse(await readFile(path.join(ARTICLES, 'categories.json'), 'utf8'));
  const corpus = JSON.parse(await readFile(path.join(ROOT, 'data', 'corpus-summary.json'), 'utf8'));

  if (index.length === 0) throw new Error('article index is empty — refusing to generate an empty wiki');

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const footer = [
    '---',
    '',
    `Archived from the [Oaklands Wiki on Fandom](${SOURCE}) and licensed [CC BY-SA 4.0](${LICENCE}).`,
    'Unofficial; not affiliated with Typical Developers, Roblox, or Fandom.',
    '',
    `Snapshot \`${corpus.snapshotId}\`. · [About](About) · [Read it on the web](${SITE}/) · [Source](${REPO})`,
    '',
  ].join('\n');
  await writeFile(path.join(OUT, '_Footer.md'), footer, 'utf8');

  const sidebar = [
    `### [Oaklands Wiki](Home)`,
    '',
    `${index.length} articles · [About](About)`,
    '',
    '**Categories**',
    '',
    ...categories.slice(0, 20).map((c) => `- [${c.name.replace(/_/g, ' ')}](Category-${c.slug}) (${c.count})`),
    '',
    `[All ${categories.length} categories](Home#categories)`,
    '',
  ].join('\n');
  await writeFile(path.join(OUT, '_Sidebar.md'), sidebar, 'utf8');

  let written = 0;
  for (const entry of index) {
    const record = JSON.parse(await readFile(path.join(ARTICLES, `${entry.pageid}.json`), 'utf8'));
    const body = toMarkdown(record.body, { linkBase: '' });

    const page = [`# ${record.title}`, ''];
    if (record.categories?.length) {
      page.push(record.categories.map((c) => `\`${c.replace(/_/g, ' ')}\``).join(' · '), '');
    }
    if (record.infobox) {
      page.push('## Key facts', '', '| | |', '|---|---|');
      for (const field of record.infobox.fields) {
        page.push(`| **${escapePipes(field.label)}** | ${escapePipes(field.value)} |`);
      }
      page.push('');
    }
    page.push(body, '');
    page.push(
      '## Attribution', '',
      `Taken from [&ldquo;${record.title}&rdquo;](${SOURCE}/wiki/${encodeURIComponent(record.title.replace(/ /g, '_'))}) on the Oaklands Wiki, revision \`${record.revid}\`, last edited ${record.timestamp} by **${record.lastEditor}** and its contributors.`,
      '',
      `Licensed [CC BY-SA 4.0](${LICENCE}). An archived snapshot, not a live mirror — corrections belong upstream.`,
      '',
      `[Read this page on the web](${SITE}/wiki/${record.slug}/)`,
      '',
    );

    await writeFile(path.join(OUT, pageName(record.slug)), page.join('\n'), 'utf8');
    written += 1;
  }

  for (const category of categories) {
    const page = [
      `# ${category.name.replace(/_/g, ' ')}`, '',
      `${category.count} ${category.count === 1 ? 'article' : 'articles'}.`, '',
      ...category.articles.map(
        (a) => `- [${a.title}](${pageName(a.slug).replace(/\.md$/, '').replace(/\(/g, '%28').replace(/\)/g, '%29')})`,
      ),
      '',
      `[Search this category on the web](${SITE}/category/${category.slug}/)`,
      '',
    ].join('\n');
    await writeFile(path.join(OUT, `Category-${category.slug}.md`), page, 'utf8');
  }

  const home = [
    '# Oaklands Wiki', '',
    'A reading-first archive of the community wiki for **Oaklands**, the Roblox game by',
    'Typical Developers. This is the Markdown mirror; the web reader is at',
    `${SITE}/`, '',
    `**${index.length} articles**, written by ${corpus.editors} editors, captured \`${corpus.capturedAt}\`.`, '',
    '## Categories', '',
    ...categories.map((c) => `- [${c.name.replace(/_/g, ' ')}](Category-${c.slug}) — ${c.count}`),
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'Home.md'), home, 'utf8');

  const about = [
    '# About', '',
    'An **unofficial** archive of the [Oaklands Wiki on Fandom](' + SOURCE + '), rebuilt so it is',
    'readable — especially on a phone. Not affiliated with Typical Developers, Roblox, or Fandom.', '',
    '## Content and licensing', '',
    `Articles come from the source wiki's public MediaWiki API, which its \`robots.txt\` explicitly`,
    'permits. Wiki text is [CC BY-SA 4.0](' + LICENCE + ') and stays so, with attribution carried on',
    'every page. The site code is Apache-2.0; the two licences are different.', '',
    '## This snapshot', '',
    `Snapshot \`${corpus.snapshotId}\`, captured \`${corpus.capturedAt}\`: ${corpus.captured.articles} articles`,
    `and ${corpus.captured.redirects} redirects. It is a dated snapshot rather than a live mirror, so it`,
    'drifts from the source between captures.', '',
    '## Corrections', '',
    'Content corrections belong upstream on the source wiki, where edits actually take effect.',
    `For a problem with this archive — a rights concern, a bad import, a takedown request —`,
    `please [open an issue](${REPO}/issues).`, '',
  ].join('\n');
  await writeFile(path.join(OUT, 'About.md'), about, 'utf8');

  console.log(`generate-wiki: ${written} article pages, ${categories.length} category pages, plus Home, About, _Sidebar and _Footer`);
  console.log(`generate-wiki: written to ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => { console.error(`generate-wiki failed: ${error.message}`); process.exit(1); });
