#!/usr/bin/env node
/**
 * Resolve every captured redirect to the article it points at.
 *
 * Without this, 517 internal links in the corpus point at a redirect title, find
 * no article, and render as plain text — technically honest, but a reader loses
 * a working link for no reason. A redirect is not a missing page; it is a page
 * with another name.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus');
const UA = 'OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': UA, accept: '*/*' }, timeout: 30_000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, text: body }));
    }).on('error', reject);
  });
}

const pointer = JSON.parse(await readFile(path.join(CORPUS, 'current.json'), 'utf8'));
const snapshot = path.join(CORPUS, pointer.snapshotId);
const redirects = JSON.parse(await readFile(path.join(snapshot, 'redirects.json'), 'utf8'));

const resolved = [];
for (let i = 0; i < redirects.length; i += 40) {
  const batch = redirects.slice(i, i + 40);
  const url = new URL('https://oaklands.fandom.com/api.php');
  for (const [k, v] of Object.entries({
    action: 'query', titles: batch.map((r) => r.title).join('|'), redirects: '1',
    format: 'json', formatversion: '2', maxlag: '5',
  })) url.searchParams.set(k, v);

  const { status, text } = await get(url.toString());
  if (status !== 200) throw new Error(`redirect batch ${i}: HTTP ${status}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(`redirect batch ${i}: ${data.error.info}`);
  for (const entry of data.query?.redirects ?? []) resolved.push({ from: entry.from, to: entry.to });
  await sleep(300);
}

if (resolved.length === 0) throw new Error('resolved no redirect targets — refusing to write an empty map');
await writeFile(path.join(snapshot, 'redirect-targets.json'), `${JSON.stringify(resolved, null, 2)}\n`, 'utf8');
console.log(`redirect-targets: resolved ${resolved.length} of ${redirects.length} redirects`);
