#!/usr/bin/env node
/**
 * Second import pass: fully-expanded HTML for every captured article.
 *
 * The first pass captures wikitext, which is the canonical source and is where
 * the typed infobox values come from. It is not, however, something to render:
 * `{{Ore}}`, `{{Wood}}` and the nav boxes are real templates, and
 * re-implementing MediaWiki's expander is a project of its own. `action=parse`
 * expands them correctly, so rendering uses that and provenance uses the
 * wikitext.
 *
 * `action=parse` handles one page per request, so this is ~1,000 requests. It is
 * resumable: an existing output file is reused unless --force is passed, so an
 * interrupted run costs only what it had not already fetched.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus');
const USER_AGENT =
  'OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)';
const API = 'https://oaklands.fandom.com/api.php';
const WAIT_MS = 250;
const MAX_ATTEMPTS = 4;
const MAX_BYTES = 8 * 1024 * 1024;
const FORCE = process.argv.includes('--force');
const LIMIT = Number(process.env.PARSE_LIMIT ?? '0');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** node:https, not fetch — see docs/import/source-policy.md for why. */
function get(url, purpose) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': USER_AGENT, accept: '*/*' }, timeout: 30_000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { res.resume(); reject(new Error(`${purpose}: refused redirect ${status}`)); return; }
      let body = ''; let bytes = 0;
      res.setEncoding('utf8');
      res.on('data', (c) => {
        bytes += Buffer.byteLength(c);
        if (bytes > MAX_BYTES) { req.destroy(); reject(new Error(`${purpose}: exceeded ${MAX_BYTES} bytes`)); return; }
        body += c;
      });
      res.on('end', () => resolve({ status, text: body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`${purpose}: timed out`)); });
    req.on('error', (e) => reject(new Error(`${purpose}: ${e.message}`)));
  });
}

async function parsePage(pageid) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({
    action: 'parse', pageid: String(pageid), prop: 'text|revid|categories|links|images|displaytitle',
    format: 'json', formatversion: '2', maxlag: '5', disableeditsection: '1', disabletoc: '1',
  })) url.searchParams.set(k, v);

  let last = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { status, text } = await get(url.toString(), `parse ${pageid}`);
      if (status === 429 || status === 503) { last = `HTTP ${status}`; await sleep(WAIT_MS * attempt * 4); continue; }
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
      const data = JSON.parse(text);
      if (data.error) {
        // A page that cannot be parsed is recorded as such, never guessed at.
        return { error: `${data.error.code}: ${data.error.info}` };
      }
      return data.parse;
    } catch (error) {
      last = error.message;
      await sleep(WAIT_MS * attempt * 2);
    }
  }
  return { error: `exhausted ${MAX_ATTEMPTS} attempts (${last})` };
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  const pointer = JSON.parse(await readFile(path.join(CORPUS, 'current.json'), 'utf8'));
  const snapshot = path.join(CORPUS, pointer.snapshotId);
  const articles = JSON.parse(await readFile(path.join(snapshot, 'articles.json'), 'utf8'));
  const outDir = path.join(snapshot, 'parsed');
  await mkdir(outDir, { recursive: true });

  const targets = LIMIT ? articles.slice(0, LIMIT) : articles;
  console.log(`parse: ${targets.length} article(s) into ${path.relative(ROOT, outDir)}`);

  let fetched = 0; let reused = 0; const failures = [];
  for (const [index, article] of targets.entries()) {
    const file = path.join(outDir, `${article.pageid}.json`);
    if (!FORCE && (await exists(file))) { reused += 1; continue; }

    const parsed = await parsePage(article.pageid);
    if (parsed.error) {
      failures.push({ pageid: article.pageid, title: article.title, error: parsed.error });
    } else {
      await writeFile(file, `${JSON.stringify({
        pageid: article.pageid,
        title: article.title,
        displaytitle: parsed.displaytitle ?? article.title,
        revid: parsed.revid,
        html: parsed.text,
        categories: (parsed.categories ?? []).filter((c) => !c.hidden).map((c) => c.category ?? c['*']),
        links: (parsed.links ?? []).map((l) => ({ title: l.title ?? l['*'], exists: l.exists ?? false })),
        images: parsed.images ?? [],
      }, null, 0)}\n`, 'utf8');
      fetched += 1;
    }
    if ((index + 1) % 25 === 0 || index === targets.length - 1) {
      process.stdout.write(`\rparse: ${index + 1}/${targets.length} (fetched ${fetched}, reused ${reused}, failed ${failures.length})`);
    }
    await sleep(WAIT_MS);
  }
  process.stdout.write('\n');

  if (failures.length > 0) {
    await writeFile(path.join(outDir, '_failures.json'), `${JSON.stringify(failures, null, 2)}\n`, 'utf8');
    console.log(`parse: ${failures.length} page(s) could not be parsed — recorded in parsed/_failures.json`);
    for (const failure of failures.slice(0, 5)) console.log(`  - ${failure.title}: ${failure.error}`);
  }
  if (fetched === 0 && reused === 0) throw new Error('nothing was fetched or reused — refusing to report success');
  console.log(`parse: done — ${fetched} fetched, ${reused} reused, ${failures.length} failed`);
}

main().catch((error) => { console.error(`parse failed: ${error.message}`); process.exit(1); });
