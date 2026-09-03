#!/usr/bin/env node
/**
 * Design-parity and differentiation guard.
 *
 * Two hand-written inventories, both fail-closed:
 *
 * - **Parity.** Every inventoried screen has a reference capture taken under a
 *   complete, pinned tuple — route, state, theme, viewport, scale — and that
 *   file exists with a recorded digest. A discovery scan cannot notice a screen
 *   that was never captured, which is why the list is explicit.
 *
 * - **Differentiation.** Each named failing of the source wiki has a
 *   counter-treatment and a paired capture. Reviewer opinion does not close one
 *   of those rows; the pair does.
 *
 * `--self-test` proves the guard bites, one removed field at a time.
 */
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARITY = path.join(ROOT, 'design', 'parity-inventory.json');
const DIFFERENTIATION = path.join(ROOT, 'design', 'differentiation-inventory.json');

const REQUIRED_TUPLE = ['route', 'state', 'theme', 'viewport', 'scale', 'referenceFile', 'sha256'];

async function exists(relative) {
  try { await access(path.join(ROOT, relative)); return true; } catch { return false; }
}

export async function evaluateParity(inventory) {
  const failures = [];
  const rows = inventory?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return ['the parity inventory has no rows — a screen list nobody wrote cannot notice a missing screen'];
  }
  const seen = new Set();
  for (const row of rows) {
    const id = row?.id ?? '(no id)';
    if (!row?.id) failures.push('a parity row has no id');
    else if (seen.has(row.id)) failures.push(`${row.id}: duplicate parity row`);
    else seen.add(row.id);

    for (const field of REQUIRED_TUPLE) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        failures.push(`${id}: the capture tuple is incomplete — "${field}" is missing`);
      }
    }
    if (row.referenceFile) {
      if (!(await exists(row.referenceFile))) {
        failures.push(`${id}: reference capture "${row.referenceFile}" does not exist`);
      } else if (row.sha256) {
        const bytes = await readFile(path.join(ROOT, row.referenceFile));
        const digest = createHash('sha256').update(bytes).digest('hex');
        if (digest !== row.sha256) {
          failures.push(`${id}: reference capture has changed since it was recorded (${digest.slice(0, 12)} vs ${String(row.sha256).slice(0, 12)})`);
        }
      }
    }
  }
  return failures;
}

export async function evaluateDifferentiation(inventory) {
  const failures = [];
  const rows = inventory?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return ['the differentiation inventory has no rows'];
  }
  for (const row of rows) {
    const id = row?.id ?? '(no id)';
    for (const field of ['sourceDoes', 'weDo', 'evidence']) {
      if (!row?.[field]) failures.push(`${id}: "${field}" is missing`);
    }
    for (const file of row?.evidence ?? []) {
      if (!(await exists(file))) failures.push(`${id}: evidence "${file}" does not exist`);
    }
  }
  return failures;
}

async function main() {
  const parity = JSON.parse(await readFile(PARITY, 'utf8'));
  const differentiation = JSON.parse(await readFile(DIFFERENTIATION, 'utf8'));

  if (process.argv.includes('--self-test')) {
    console.log('check-parity: self-test — each mutation must be caught');
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const mutations = [
      ['empty parity inventory', async () => evaluateParity({ rows: [] })],
      ['a parity row missing its viewport', async () => {
        const m = clone(parity); delete m.rows[0].viewport; return evaluateParity(m);
      }],
      ['a parity row missing its theme', async () => {
        const m = clone(parity); delete m.rows[0].theme; return evaluateParity(m);
      }],
      ['a reference capture that does not exist', async () => {
        const m = clone(parity); m.rows[0].referenceFile = 'design/reference/imaginary.png'; return evaluateParity(m);
      }],
      ['a reference capture whose digest has drifted', async () => {
        const m = clone(parity); m.rows[0].sha256 = '0'.repeat(64); return evaluateParity(m);
      }],
      ['a duplicated parity row', async () => {
        const m = clone(parity); m.rows[1].id = m.rows[0].id; return evaluateParity(m);
      }],
      ['a differentiation row with no counter-treatment', async () => {
        const m = clone(differentiation); delete m.rows[0].weDo; return evaluateDifferentiation(m);
      }],
      ['a differentiation row whose evidence is gone', async () => {
        const m = clone(differentiation); m.rows[0].evidence = ['evidence/differentiation/nope.png']; return evaluateDifferentiation(m);
      }],
    ];

    let allCaught = true;
    for (const [label, run] of mutations) {
      const caught = (await run()).length > 0;
      if (!caught) allCaught = false;
      console.log(`  ${caught ? 'RED  ' : 'GREEN'}  ${label}${caught ? '' : '  <-- NOT CAUGHT'}`);
    }
    const clean = [...(await evaluateParity(parity)), ...(await evaluateDifferentiation(differentiation))];
    console.log(`  ${clean.length === 0 ? 'GREEN' : 'RED  '}  unmutated inventories (must be green)`);
    if (!allCaught || clean.length > 0) {
      console.error('check-parity: self-test FAILED');
      for (const message of clean) console.error(`    - ${message}`);
      process.exit(1);
    }
    console.log('check-parity: self-test passed');
    return;
  }

  const failures = [...(await evaluateParity(parity)), ...(await evaluateDifferentiation(differentiation))];
  if (failures.length > 0) {
    console.error(`check-parity: ${failures.length} failure(s)`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(`check-parity: ok — ${parity.rows.length} reference screen(s), ${differentiation.rows.length} differentiation row(s), every capture present and unchanged`);
}

main().catch((error) => { console.error(`check-parity: ${error.message}`); process.exit(1); });
