#!/usr/bin/env node
/**
 * Fail closed on the hand-written completeness inventory.
 *
 * The inventory is hand-written on purpose. A guard that discovers features by
 * scanning the tree can only ever validate the features that are already there,
 * so it passes cleanly on a project that is missing all of them — it never
 * looked, so it never failed. This list is what must exist; the guard checks
 * reality against the list, not the list against reality.
 *
 * `--self-test` proves the guard actually bites: it mutates the inventory in
 * memory one way at a time and requires each mutation to be caught. A guard
 * nobody has watched fail proves nothing.
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = path.join(ROOT, 'data', 'inventories', 'completeness.json');

/** Every artefact key a row may name. Adding a key here makes it checked. */
const ARTEFACT_KEYS = ['implementation', 'surfaces', 'docs', 'tests', 'guards', 'captures'];
const STATES = new Set(['built', 'open']);

async function exists(relative) {
  try {
    await access(path.join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
}

/** Returns a list of failure strings. Empty means the inventory holds. */
export async function evaluate(inventory) {
  const failures = [];
  const rows = inventory?.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return ['inventory has no rows — refusing to report a project complete against an empty list'];
  }

  const seen = new Set();
  for (const row of rows) {
    const id = row?.id ?? '(missing id)';
    if (!row?.id) failures.push('a row has no id');
    else if (seen.has(row.id)) failures.push(`${row.id}: duplicate row id`);
    else seen.add(row.id);

    if (!row?.title) failures.push(`${id}: has no title`);
    if (!STATES.has(row?.state)) {
      failures.push(`${id}: state "${row?.state}" is not one of ${[...STATES].join(', ')}`);
      continue;
    }

    if (row.state !== 'built') continue;

    // A built row must name at least one implementation artefact, and every
    // artefact it names must actually be on disk.
    const implementation = row.implementation ?? [];
    if (implementation.length === 0) {
      failures.push(`${id}: marked built but names no implementation`);
    }
    for (const key of ARTEFACT_KEYS) {
      for (const relative of row[key] ?? []) {
        if (!(await exists(relative))) {
          failures.push(`${id}: ${key} artefact "${relative}" does not exist`);
        }
      }
    }
  }
  return failures;
}

async function selfTest(inventory) {
  const clone = () => JSON.parse(JSON.stringify(inventory));
  const mutations = [
    ['empty row list', (i) => { i.rows = []; }],
    ['a built row whose implementation file is gone', (i) => {
      const row = i.rows.find((r) => r.state === 'built');
      row.implementation = ['src/does-not-exist.ts'];
    }],
    ['a built row naming no implementation at all', (i) => {
      const row = i.rows.find((r) => r.state === 'built');
      delete row.implementation;
    }],
    ['a row with an unknown state', (i) => { i.rows[0].state = 'probably-fine'; }],
    ['a duplicated row id', (i) => { i.rows[1].id = i.rows[0].id; }],
    ['a built row whose guard file is gone', (i) => {
      const row = i.rows.find((r) => r.state === 'built' && r.guards?.length);
      row.guards = ['scripts/imaginary-guard.mjs'];
    }],
  ];

  let allCaught = true;
  for (const [label, mutate] of mutations) {
    const mutated = clone();
    mutate(mutated);
    const failures = await evaluate(mutated);
    const caught = failures.length > 0;
    if (!caught) allCaught = false;
    console.log(`  ${caught ? 'RED  ' : 'GREEN'}  ${label}${caught ? '' : '  <-- NOT CAUGHT'}`);
  }

  const clean = await evaluate(inventory);
  console.log(`  ${clean.length === 0 ? 'GREEN' : 'RED  '}  unmutated inventory (must be green)`);
  return allCaught && clean.length === 0;
}

async function main() {
  const inventory = JSON.parse(await readFile(INVENTORY, 'utf8'));

  if (process.argv.includes('--self-test')) {
    console.log('check-completeness: self-test — each mutation must be caught');
    const ok = await selfTest(inventory);
    if (!ok) {
      console.error('check-completeness: self-test FAILED — the guard does not bite');
      process.exit(1);
    }
    console.log('check-completeness: self-test passed');
    return;
  }

  const failures = await evaluate(inventory);
  const built = inventory.rows.filter((r) => r.state === 'built').length;
  const open = inventory.rows.filter((r) => r.state === 'open').length;

  if (failures.length > 0) {
    console.error(`check-completeness: ${failures.length} failure(s)`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(`check-completeness: ok — ${built} built, ${open} open, ${built + open} rows total`);
}

main().catch((error) => {
  console.error(`check-completeness: ${error.message}`);
  process.exit(1);
});
