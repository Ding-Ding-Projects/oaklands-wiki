#!/usr/bin/env node
/**
 * Capture the Oaklands wiki corpus through the public MediaWiki API.
 *
 * Policy first, always. This source's robots.txt answers HTTP 200 text/plain to
 * a plain project user agent and its `User-agent: *` group carries an explicit
 * `Allow: /api.php?action=`, so this importer gets a clean allow verdict with no
 * override path. There is deliberately no `--skip-robots` flag: a challenge, a
 * non-200, or a disallow stops the run.
 *
 * Note the user agent must NOT resemble ClaudeBot — that agent is `Disallow: /`
 * on this host, and borrowing its name would turn an allowed request into a
 * forbidden one.
 */
import { createHash } from 'node:crypto';
import https from 'node:https';
import { mkdir, rename, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'corpus');
const STAGING = path.join(OUT, '.staging');

const ORIGIN = 'https://oaklands.fandom.com';
const API = `${ORIGIN}/api.php`;
const ROBOTS = `${ORIGIN}/robots.txt`;
const RIGHTS = 'https://www.fandom.com/licensing';
const USER_AGENT =
  'OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)';

const WAIT_MS = 300;
const MAX_ATTEMPTS = 5;
const MAX_BYTES = 48 * 1024 * 1024;
const BATCH = 20;
const MAX_PAGINATION = 500;
const LIMIT = Number(process.env.IMPORT_LIMIT ?? '0'); // 0 = everything

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ policy */

/**
 * Apply the longest matching rule for our agent to a path, exactly as the
 * robots spec orders it: longest match wins, and Allow beats Disallow on a tie.
 * Exported so the focused test can drive it without any network at all.
 */
export function robotsVerdict(text, agent, target) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === 'user-agent') {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      current.rules.push({ allow: field === 'allow', pattern: value });
    }
  }

  const lower = agent.toLowerCase();
  // A named group for our agent wins outright over the wildcard group.
  const named = groups.find((g) => g.agents.some((a) => a !== '*' && lower.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const group = named ?? wildcard;
  if (!group) return { allowed: true, rule: null, reason: 'no applicable group' };

  let best = null;
  for (const rule of group.rules) {
    if (rule.pattern === '') continue; // an empty Disallow allows everything
    const literal = rule.pattern.split('*')[0];
    if (!target.startsWith(literal)) continue;
    if (!best || literal.length > best.literal.length || (literal.length === best.literal.length && rule.allow)) {
      best = { ...rule, literal };
    }
  }
  if (!best) return { allowed: true, rule: null, reason: 'no matching rule' };
  return {
    allowed: best.allow,
    rule: `${best.allow ? 'Allow' : 'Disallow'}: ${best.pattern}`,
    reason: `longest match "${best.literal}"`,
    group: group.agents.join(', '),
  };
}

/* ----------------------------------------------------------------- fetching */

/**
 * One bounded GET.
 *
 * Deliberately `node:https` rather than the global `fetch`. Measured against
 * this source on 2026-09-03: undici gets HTTP 403 from the edge on
 * `/robots.txt` while `node:https` — and curl at either HTTP version — gets 200,
 * with the identical user agent and headers. It is a client fingerprint, not the
 * request. That matters more than it sounds: undici is refused the *policy* file
 * while being served `/api.php` normally, so a fetch-based importer would decide
 * it must stop on a source that in fact permits it.
 */
function get(url, purpose, redirectsLeft = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'user-agent': USER_AGENT, accept: '*/*' }, timeout: 30_000 },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = response.headers['content-type'] ?? '';
        // Redirects are rejected rather than followed.
        if (status >= 300 && status < 400 && redirectsLeft <= 0) {
          response.resume();
          reject(new Error(`${purpose}: refused to follow redirect (HTTP ${status})`));
          return;
        }
        let body = '';
        let bytes = 0;
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          bytes += Buffer.byteLength(chunk);
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new Error(`${purpose}: response exceeded ${MAX_BYTES} bytes`));
            return;
          }
          body += chunk;
        });
        response.on('end', () => resolve({ status, contentType, text: body }));
      },
    );
    request.on('timeout', () => { request.destroy(); reject(new Error(`${purpose}: timed out`)); });
    request.on('error', (error) => reject(new Error(`${purpose}: ${error.message}`)));
  });
}

async function request(url, purpose) {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await get(url, purpose);
    } catch (error) {
      lastError = error.message;
      await sleep(WAIT_MS * attempt * 2);
      continue;
    }
    if (response.status === 429 || response.status === 503) {
      lastError = `retryable HTTP ${response.status}`;
      await sleep(WAIT_MS * attempt * 4);
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${purpose}: HTTP ${response.status} (${response.contentType || 'no content-type'})`);
    }
    if (/just a moment|cdn-cgi\/challenge-platform|enable javascript and cookies/i.test(response.text.slice(0, 4000))) {
      throw new Error(`${purpose}: source returned a challenge page, not content`);
    }
    return response;
  }
  throw new Error(`${purpose}: exhausted ${MAX_ATTEMPTS} attempts (${lastError})`);
}

async function api(params, purpose) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ format: 'json', formatversion: '2', maxlag: '5', ...params })) {
    url.searchParams.set(key, String(value));
  }
  const { text } = await request(url.toString(), purpose);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${purpose}: response was not JSON`);
  }
  if (parsed.error) throw new Error(`${purpose}: API error ${parsed.error.code} — ${parsed.error.info}`);
  return parsed;
}

/** Follow `continue` to the end of a list, with a hard cycle bound. */
async function paginate(params, extract, purpose) {
  const collected = [];
  let cont = {};
  for (let page = 0; page < MAX_PAGINATION; page += 1) {
    const data = await api({ ...params, ...cont }, `${purpose} page ${page + 1}`);
    collected.push(...extract(data));
    if (!data.continue) return collected;
    cont = data.continue;
    if (LIMIT && collected.length >= LIMIT) return collected.slice(0, LIMIT);
    await sleep(WAIT_MS);
  }
  throw new Error(`${purpose}: exceeded ${MAX_PAGINATION} pages — refusing to loop`);
}

/* --------------------------------------------------------------------- main */

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`import: agent ${USER_AGENT}`);

  // 1. Policy preflight. No override path exists; a refusal ends the run here.
  const robots = await request(ROBOTS, 'robots.txt');
  if (!/^text\/plain/i.test(robots.contentType)) {
    throw new Error(`robots.txt returned ${robots.contentType || 'no content-type'}, not text/plain`);
  }
  const verdict = robotsVerdict(robots.text, USER_AGENT, '/api.php?action=query');
  console.log(`import: robots group "${verdict.group ?? 'none'}" -> ${verdict.allowed ? 'ALLOW' : 'DISALLOW'} (${verdict.rule ?? verdict.reason})`);
  if (!verdict.allowed) throw new Error(`robots.txt disallows the API for this agent: ${verdict.rule}`);

  const rights = await request(RIGHTS, 'licensing page');

  // 2. Site facts.
  const site = await api(
    { action: 'query', meta: 'siteinfo', siprop: 'general|statistics|rightsinfo' },
    'siteinfo',
  );

  // 3. Inventory: articles, redirects, categories.
  const articles = await paginate(
    { action: 'query', list: 'allpages', apnamespace: 0, aplimit: 500, apfilterredir: 'nonredirects' },
    (d) => d.query.allpages.map((p) => ({ pageid: p.pageid, title: p.title })),
    'article inventory',
  );
  const redirects = await paginate(
    { action: 'query', list: 'allpages', apnamespace: 0, aplimit: 500, apfilterredir: 'redirects' },
    (d) => d.query.allpages.map((p) => ({ pageid: p.pageid, title: p.title })),
    'redirect inventory',
  );
  const categories = await paginate(
    { action: 'query', list: 'allcategories', aclimit: 500, acprop: 'size' },
    (d) => d.query.allcategories.map((c) => ({ name: c.category, pages: c.pages ?? 0 })),
    'category inventory',
  );
  console.log(`import: ${articles.length} articles, ${redirects.length} redirects, ${categories.length} categories`);

  // 4. Bodies: wikitext for provenance, expanded HTML for rendering.
  await mkdir(STAGING, { recursive: true });
  const pages = [];
  for (let index = 0; index < articles.length; index += BATCH) {
    const slice = articles.slice(index, index + BATCH);
    const data = await api(
      {
        action: 'query',
        pageids: slice.map((a) => a.pageid).join('|'),
        prop: 'revisions|categories',
        rvprop: 'ids|timestamp|user|content',
        rvslots: 'main',
        cllimit: 'max',
      },
      `bodies ${index + 1}-${index + slice.length}`,
    );
    for (const page of data.query?.pages ?? []) {
      const revision = page.revisions?.[0];
      if (!revision) continue;
      pages.push({
        pageid: page.pageid,
        title: page.title,
        revid: revision.revid,
        timestamp: revision.timestamp,
        user: revision.user,
        categories: (page.categories ?? []).map((c) => c.title.replace(/^Category:/, '')),
        wikitext: revision.slots?.main?.content ?? '',
      });
    }
    process.stdout.write(`\rimport: bodies ${Math.min(index + BATCH, articles.length)}/${articles.length}`);
    await sleep(WAIT_MS);
  }
  process.stdout.write('\n');

  if (pages.length === 0) throw new Error('captured no page bodies — refusing to publish an empty corpus');

  // 5. Stage the whole set, then publish one pointer.
  const snapshotId = `${startedAt.replace(/[:.]/g, '-')}`;
  const capture = {
    recordType: 'oaklands-corpus-capture',
    schemaVersion: 1,
    snapshotId,
    startedAt,
    completedAt: new Date().toISOString(),
    importerVersion: '1.0.0',
    userAgent: USER_AGENT,
    source: { origin: ORIGIN, api: API },
    policy: {
      robotsStatus: robots.status,
      robotsContentType: robots.contentType,
      robotsSha256: sha256(robots.text),
      verdict: verdict.allowed ? 'allowed' : 'disallowed',
      matchedGroup: verdict.group ?? null,
      matchedRule: verdict.rule ?? null,
      rightsStatus: rights.status,
      rightsSha256: sha256(rights.text),
    },
    site: {
      generator: site.query.general.generator,
      sitename: site.query.general.sitename,
      rights: site.query.rightsinfo,
      statistics: site.query.statistics,
    },
    counts: {
      articles: articles.length,
      redirects: redirects.length,
      categories: categories.length,
      captured: pages.length,
    },
  };

  const files = {
    'capture.json': JSON.stringify(capture, null, 2),
    'articles.json': JSON.stringify(pages, null, 2),
    'redirects.json': JSON.stringify(redirects, null, 2),
    'categories.json': JSON.stringify(categories, null, 2),
  };
  for (const [name, body] of Object.entries(files)) {
    await writeFile(path.join(STAGING, name), `${body}\n`, 'utf8');
  }

  const target = path.join(OUT, snapshotId);
  await rename(STAGING, target);
  await writeFile(
    path.join(OUT, 'current.json'),
    `${JSON.stringify({ snapshotId, capturedAt: capture.completedAt, counts: capture.counts }, null, 2)}\n`,
    'utf8',
  );

  console.log(`import: published ${snapshotId} — ${pages.length} pages captured`);
  if (pages.length < articles.length) {
    console.log(`import: NOTE ${articles.length - pages.length} article(s) returned no revision and were skipped`);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch((error) => {
    console.error(`import failed: ${error.message}`);
    process.exit(1);
  });
}
