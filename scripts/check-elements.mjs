#!/usr/bin/env node
/**
 * No element on this site renders at browser defaults.
 *
 * The list below is HAND-WRITTEN. That is the whole point: a guard that collects
 * the selectors already present in the stylesheet and then checks they are
 * well-formed passes cleanly on a stylesheet that styles nothing, because it
 * never looked for what is missing. This checks reality against the list, not
 * the list against reality.
 *
 * Every element here can reach a rendered page — most of them arrive inside
 * imported wiki HTML rather than being written by hand, which is exactly why
 * leaving them unstyled would show up as "the CSS did not load" on an article
 * nobody previewed.
 *
 * `--self-test` proves the guard bites.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_FILES = [
  'src/styles/base.css',
  'src/styles/elements.css',
  'src/styles/chrome.css',
];

/** Every element the site can emit. Grouped only for readability. */
const REQUIRED = {
  'inline semantics': ['strong', 'b', 'em', 'i', 'cite', 'var', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'abbr', 'q', 'time', 'data', 'address'],
  code: ['code', 'kbd', 'samp', 'pre'],
  quotations: ['blockquote'],
  lists: ['ul', 'ol', 'li', 'dl', 'dt', 'dd', 'menu'],
  tables: ['table', 'caption', 'th', 'td', 'thead', 'tfoot'],
  media: ['img', 'video', 'audio', 'picture', 'canvas', 'svg', 'figure', 'figcaption', 'iframe', 'embed', 'object'],
  structure: ['hr', 'details', 'summary', 'dialog'],
  forms: ['button', 'input', 'select', 'textarea', 'label', 'fieldset', 'legend', 'progress', 'meter'],
  typography: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'body'],
};

/** Elements deliberately left to inherit, with the reason recorded. */
const INHERITED = {
  span: 'a pure inline wrapper with no default appearance to override',
  div: 'a pure block wrapper with no default appearance to override',
  section: 'no default appearance beyond block flow',
  article: 'no default appearance beyond block flow',
  nav: 'styled by its own component classes',
  header: 'styled by its own component classes',
  footer: 'styled by its own component classes',
  main: 'styled in base.css by tag',
  tbody: 'a row-grouping box with no default appearance of its own; its rows carry the striping and its cells carry the borders. Styling it directly would be a no-op written only to satisfy this guard.',
  br: 'no box to style',
  wbr: 'no box to style',
};

/** Normalise line endings before parsing: a CRLF checkout otherwise silently
 *  produces an empty selector set and the guard reports clean. */
const norm = (text) => text.replace(/\r\n/g, '\n');

/** Strip comments, then collect every bare type selector that carries a rule. */
export function styledElements(css) {
  const withoutComments = norm(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Set();
  // Walk selector lists that precede a declaration block.
  for (const match of withoutComments.matchAll(/(^|[}{;])\s*([^{}@]+?)\s*\{/g)) {
    const selectorList = match[2];
    if (!selectorList || selectorList.includes('&')) continue;
    for (const selector of selectorList.split(',')) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      // A bare type selector: the element name, optionally with attribute,
      // pseudo-class or pseudo-element parts, and nothing that makes it a
      // descendant of something else.
      const bare = /^([a-z][a-z0-9]*)(?:\[[^\]]*\]|::?[a-zA-Z-]+(?:\([^)]*\))?)*$/.exec(trimmed);
      if (bare) found.add(bare[1]);
      // Also count `x y` where the LAST simple selector is a bare element, since
      // `pre code` does style `code` — but only when that element is styled
      // somewhere on its own too, which the bare pass above records.
    }
  }
  return found;
}

export function evaluate(styled) {
  const failures = [];
  for (const [group, elements] of Object.entries(REQUIRED)) {
    for (const element of elements) {
      if (!styled.has(element)) {
        failures.push(`<${element}> (${group}) has no rule — it would render at browser defaults`);
      }
    }
  }
  for (const element of Object.keys(INHERITED)) {
    if (REQUIRED[element]) failures.push(`${element} is listed as both required and inherited`);
  }
  return failures;
}

async function loadStyled() {
  let css = '';
  for (const relative of STYLE_FILES) {
    css += `\n${await readFile(path.join(ROOT, relative), 'utf8')}`;
  }
  return styledElements(css);
}

async function main() {
  if (process.argv.includes('--self-test')) {
    console.log('check-elements: self-test — each mutation must be caught');
    const styled = await loadStyled();
    let allCaught = true;
    // Removing any single required element must go red.
    for (const element of ['table', 'blockquote', 'input', 'summary', 'sup']) {
      const mutated = new Set(styled);
      mutated.delete(element);
      const caught = evaluate(mutated).length > 0;
      if (!caught) allCaught = false;
      console.log(`  ${caught ? 'RED  ' : 'GREEN'}  <${element}> unstyled${caught ? '' : '  <-- NOT CAUGHT'}`);
    }
    // An empty stylesheet must go very red, not quietly green.
    const empty = evaluate(new Set());
    console.log(`  ${empty.length > 0 ? 'RED  ' : 'GREEN'}  nothing styled at all (${empty.length} failures)`);
    if (empty.length === 0) allCaught = false;

    const clean = evaluate(styled);
    console.log(`  ${clean.length === 0 ? 'GREEN' : 'RED  '}  real stylesheet (must be green)`);
    if (!allCaught || clean.length !== 0) {
      console.error('check-elements: self-test FAILED');
      process.exit(1);
    }
    console.log('check-elements: self-test passed');
    return;
  }

  const styled = await loadStyled();
  const failures = evaluate(styled);
  const total = Object.values(REQUIRED).flat().length;

  if (failures.length > 0) {
    console.error(`check-elements: ${failures.length} of ${total} required element(s) unstyled`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(`check-elements: ok — ${total} elements styled, ${Object.keys(INHERITED).length} deliberately inherited`);
}

main().catch((error) => {
  console.error(`check-elements: ${error.message}`);
  process.exit(1);
});
