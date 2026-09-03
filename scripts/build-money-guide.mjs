#!/usr/bin/env node
/**
 * Build the money-making guide from the archived infoboxes.
 *
 * Two rankings, computed separately and deliberately kept that way:
 *
 * - **Money** is read from the wiki's own price fields. Nothing is estimated.
 * - **Difficulty** is derived from where a thing is found, how much processing
 *   its best price needs, and whether it can still be obtained at all.
 *
 * The one rule that matters here: **difficulty never looks at price**. Scoring
 * difficulty from value and then ranking by value would be circular — every
 * expensive thing would come out "hard" by construction, and the guide would
 * confidently tell you what it had already assumed. Keeping them independent is
 * what makes "high value, low difficulty" a real finding rather than an artefact.
 *
 * The formula is published on the page. A reader should be able to disagree with
 * the model rather than with the conclusion.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = path.join(ROOT, 'data', 'articles');
const OUT = path.join(ROOT, 'data', 'generated');

/**
 * Region tiers.
 *
 * The Island field is free text typed by contributors, so it arrives with
 * typos (`Finaly`, `FInlay`, `Finley`, `Finland Island`), with biomes used in
 * place of islands, and with several places listed at once. Normalising it is
 * unavoidable; guessing at it is not, so every spelling below was read out of
 * the corpus rather than invented, and anything unrecognised stays `unknown`
 * instead of being forced into a tier.
 *
 * Tier 1 is where a new player starts. Higher tiers need more travel, more
 * equipment, or a hazard to survive. Where an item lists several places, the
 * EASIEST is used — you only have to reach one of them.
 */
const REGIONS = [
  { tier: 1, name: 'Finlay', match: /^(?:finlay|finaly|finley|finland|classic|the grasslands|grasslands|main area|other area)/ },
  { tier: 1, name: 'Flowering Meadows', match: /^(?:flowering meadow|meadow)/ },
  { tier: 2, name: 'Ferwater', match: /^ferwater/ },
  { tier: 2, name: 'River Caves', match: /^(?:river cave|river)/ },
  { tier: 3, name: 'Desertlands', match: /^(?:desert)/ },
  { tier: 3, name: 'Snowlands', match: /^(?:snowland|snowy peak|snow)/ },
  { tier: 3, name: 'The Taiga', match: /^(?:the taiga|taiga)/ },
  { tier: 4, name: 'Icelands', match: /^(?:iceland|ice island|ice cave|iceisland)/ },
  { tier: 4, name: 'Acidlands', match: /^(?:acid)/ },
  { tier: 4, name: 'Uncertainty Cave', match: /^(?:uncertain|uncertainy)/ },
  { tier: 5, name: 'Magma Caves', match: /^magma/ },
  { tier: 5, name: "Mike's Mines", match: /^mike/ },
  { tier: 5, name: 'The Void', match: /^the void/ },
  { tier: 5, name: 'Azurite Fields', match: /^azurite/ },
];

/**
 * How much work stands between the raw resource and this price.
 *
 * The generic `Price` field is deliberately absent. It is what an item COSTS,
 * not what it earns: 398 of the articles carrying it also carry a Shop, Store
 * or Cost field naming where you buy the thing. Reading those as income put a
 * $10,000,000 shop-bought warhead — the largest money SINK in the game — at the
 * top of a money-making guide, pointing every reader in exactly the wrong
 * direction. Only sell-side fields count here.
 */
const PROCESSING = {
  Ore: { step: 0, label: 'mined, sold raw' },
  Log: { step: 0, label: 'chopped, sold raw' },
  Stone: { step: 0, label: 'quarried, sold raw' },
  '$/burl': { step: 0, label: 'harvested, sold raw' },
  Refined: { step: 1, label: 'refined first' },
  Planked: { step: 1, label: 'milled into planks' },
  Forged: { step: 2, label: 'refined then forged' },
  Sanded: { step: 2, label: 'planked then sanded' },
  '$/sanded': { step: 2, label: 'planked then sanded' },
};

/**
 * The shapes contributors actually typed, read out of the corpus rather than
 * assumed: `$32/stud`, `375$`, `~16/stud`, `$24/Stud`, `34$/stud`, `10,760$`.
 * The dollar sign lands on either side, `/stud` comes in both cases, and a
 * tilde marks an approximation.
 */
const MONEY = /^\s*[~≈]?\s*\$?\s*([\d][\d,]*(?:\.\d+)?)\s*\$?\s*(\/\s*studs?\s*3?)?\s*$/i;

/**
 * Event currencies, which are not money.
 *
 * Both snowflakes are here on purpose. `❅` U+2745 and `❄️` U+2744 look alike and
 * are different characters, and the first version of this filter caught only one
 * of them — so a log priced at "1❄️/stud³" was read as one dollar and quietly
 * entered a money guide. The worded forms appear too ("3,199 Candy").
 */
const EVENT_CURRENCY = /[❅❄🥚🍬🎃🎁🍭⭐🎟]|\b(?:candy|candies|snowflakes?|eggs?|tokens?|tickets?|coins?|gifts?)\b/iu;

/**
 * A price and its unit, or null.
 *
 * The UNIT COMES FROM THE VALUE, never from the field's name. `Log` usually
 * holds `$1.6/stud`, but a beehive's `Log` is a flat `$1389` — you chop one
 * beehive, you do not measure it in studs. Trusting the label put that $1389
 * into the per-stud table, where it outranked every genuine per-stud price by a
 * factor of thirty and read as the best money in the game. The string says which
 * it is; the label only says which field it was typed into.
 */
export function parseMoney(raw) {
  const value = String(raw ?? '').trim();
  if (value === '' || EVENT_CURRENCY.test(value)) return null;
  // `1M/stud` and the like are not expanded. One article uses it, for a log
  // whose real value is two orders of magnitude lower, so reading it as a
  // million would put obvious vandalism at the top of the table. Guessing at a
  // shorthand nobody else uses is worse than leaving one row out.
  const match = MONEY.exec(value);
  if (!match) return null;
  const number = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(number) || number <= 0) return null;
  return { value: number, perStud: Boolean(match[2]) };
}

export function regionFor(rawIsland) {
  const value = String(rawIsland ?? '').trim();
  if (value === '' || /^(?:\?+|n\/a|none|any|all of them)$/i.test(value)) return null;
  // Several places may be listed; you only need to reach the easiest one.
  const parts = value.split(/[,/|]|\band\b|\{\{!\}\}|\s-\s/).map((s) => s.trim()).filter(Boolean);
  let best = null;
  for (const part of parts) {
    const lower = part.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const found = REGIONS.find((r) => r.match.test(lower));
    if (found && (best === null || found.tier < best.tier)) best = found;
  }
  return best;
}

/**
 * Difficulty from 1 (a new player can do this now) to 5.
 *
 * Inputs, and only these:
 *   region tier      1-5   how far in the world it is
 *   processing step  0-2   how much work stands between it and the money
 *   obtainability    +2    a limited or removed item cannot be farmed at all
 *
 * Hardness is deliberately NOT an input, although the field exists. 22 of the 34
 * articles that carry it record it as `?` and two more as `??`, so fewer than a
 * third hold a usable number. A signal that is missing for most of the data
 * would produce a ranking that looks precise and is mostly guesswork.
 */
export function difficultyFor({ regionTier, step, obtainable }) {
  if (!obtainable) return { score: 5, why: 'cannot be obtained any more' };
  const base = regionTier ?? 2.5;
  const score = Math.max(1, Math.min(5, base + step * 0.5));
  const why = [
    regionTier ? `tier ${regionTier} region` : 'region not recorded',
    step === 0 ? 'sold raw' : `${step} processing step${step === 1 ? '' : 's'}`,
  ].join(', ');
  return { score: Math.round(score * 10) / 10, why };
}

const OBTAINABLE = /^(?:obtainable|available|on the map)$/i;

async function main() {
  const index = JSON.parse(await readFile(path.join(ARTICLES, 'index.json'), 'utf8'));

  const rows = [];
  let priceFields = 0;
  let unparsed = 0;
  let eventCurrency = 0;

  for (const entry of index) {
    if (entry.alias) continue; // an alternate name is the same item, not a second one
    const record = JSON.parse(await readFile(path.join(ARTICLES, `${entry.pageid}.json`), 'utf8'));
    if (!record.infobox) continue;

    const field = (label) => record.infobox.fields.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value;
    const statusRaw = field('Status');
    const obtainable = statusRaw ? OBTAINABLE.test(statusRaw.trim()) : true;
    const region = regionFor(field('Island'));

    // Every priced form of the item, so the guide can show what the extra
    // processing is actually worth rather than only the headline number.
    const forms = [];
    for (const [label, meta] of Object.entries(PROCESSING)) {
      const raw = field(label);
      if (raw === undefined) continue;
      priceFields += 1;
      if (EVENT_CURRENCY.test(String(raw))) { eventCurrency += 1; continue; }
      const price = parseMoney(raw);
      if (price === null) { unparsed += 1; continue; }
      forms.push({ form: label, label: meta.label, step: meta.step, value: price.value, perStud: price.perStud });
    }
    if (forms.length === 0) continue;

    // Best within each unit, never across them. One item can genuinely carry
    // both — a beehive has a flat price and a tree has a per-stud one — and
    // taking the larger number regardless of unit is the same category error at
    // row level that the two separate tables exist to prevent.
    const pick = (subset) => (subset.length === 0 ? null : subset.reduce((a, b) => (b.value > a.value ? b : a)));
    const studForms = forms.filter((f) => f.perStud);
    const unitForms = forms.filter((f) => !f.perStud);
    const best = pick(studForms) ?? pick(unitForms);
    const raw = forms.find((f) => f.step === 0 && f.perStud === best.perStud) ?? null;
    const difficulty = difficultyFor({ regionTier: region?.tier ?? null, step: best.step, obtainable });

    rows.push({
      bestPerStud: pick(studForms),
      bestPerUnit: pick(unitForms),
      title: record.title,
      slug: record.slug,
      hero: record.hero,
      type: record.infobox.type,
      region: region?.name ?? null,
      regionTier: region?.tier ?? null,
      // Whether the difficulty rests on a recorded region or on the midpoint
      // default. Every burl lands here — the source records a burl's two prices
      // and no location at all — and a defaulted score presented like a measured
      // one is the kind of false precision this whole guide is trying to avoid.
      regionKnown: Boolean(region),
      island: field('Island') ?? null,
      status: statusRaw ?? null,
      obtainable,
      forms: forms.sort((a, b) => a.step - b.step),
      best,
      raw,
      // What the processing is worth: the multiple over the raw price.
      uplift: raw && raw.value > 0 ? Math.round((best.value / raw.value) * 10) / 10 : null,
      difficulty: difficulty.score,
      difficultyWhy: difficulty.why,
      // The whole point of keeping the two independent: value per unit of effort.
      efficiency: Math.round((best.value / difficulty.score) * 10) / 10,
    });
  }

  rows.sort((a, b) => b.best.value - a.best.value);

  /**
   * Two tables, because a stud and a unit are not the same thing.
   *
   * An ore is priced per stud of the vein you mined; a burl is one object with
   * one price. Ranking `$13,288 a burl` above `$46 a stud` in a single list
   * would be arithmetic on incompatible units, and it would tell a reader that
   * burls are three hundred times better than ore when the two numbers do not
   * describe the same quantity of anything. They are ranked separately and
   * never compared.
   */
  const perStud = rows.filter((r) => r.bestPerStud).map((r) => ({ ...r, best: r.bestPerStud }))
    .sort((a, b) => b.best.value - a.best.value);
  const perUnit = rows.filter((r) => r.bestPerUnit).map((r) => ({ ...r, best: r.bestPerUnit }))
    .sort((a, b) => b.best.value - a.best.value);

  const tiersFor = (set) => [1, 2, 3, 4, 5].map((tier) => {
    const members = set.filter((r) => Math.round(r.difficulty) === tier);
    return {
      tier,
      count: members.length,
      best: members.slice(0, 8).map((r) => ({
        title: r.title, slug: r.slug, value: r.best.value, form: r.best.form, regionKnown: r.regionKnown,
      })),
    };
  });
  const tiers = tiersFor(perStud);

  const guide = {
    generatedFrom: 'data/articles',
    counts: {
      items: rows.length,
      priceFields,
      unparsed,
      eventCurrency,
      withRegion: rows.filter((r) => r.regionTier).length,
      unobtainable: rows.filter((r) => !r.obtainable).length,
      perStud: perStud.length,
      perUnit: perUnit.length,
    },
    method: {
      money: 'Read from the article\'s own price fields. Nothing is estimated, and no price is inferred from a similar item.',
      difficulty: 'Region tier (1 starting island … 5 deepest), plus half a point per processing step, forced to 5 for anything that can no longer be obtained.',
      independence: 'Difficulty never reads price. Scoring effort from value and then ranking by value would be circular, and every expensive thing would come out hard by construction.',
      excluded: 'Event currencies (snowflakes, eggs, candy) are not money and are left out. Hardness is not used: fewer than a third of the articles that carry it record a number.',
      units: 'Per-stud and per-unit prices are ranked in separate tables and never compared. A stud is a length of what you harvested; a burl is one object. Putting them in one list would say burls beat ore by three hundred times, when the two numbers do not measure the same quantity of anything.',
    },
    regions: REGIONS.map((r) => ({ tier: r.tier, name: r.name })),
    rows,
    perStud,
    perUnit,
    tiers,
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'money.json'), `${JSON.stringify(guide)}\n`, 'utf8');

  console.log(`build-money-guide: ${rows.length} priced item(s) from ${priceFields} price field(s)`);
  console.log(`  ${guide.counts.withRegion} placed in a region, ${guide.counts.unobtainable} no longer obtainable`);
  console.log(`  ${unparsed} price field(s) unparseable, ${eventCurrency} in an event currency and deliberately excluded`);
  console.log(`  ${perStud.length} priced per stud, ${perUnit.length} priced per unit — ranked separately, never compared`);
  const topStud = perStud[0];
  const topUnit = perUnit[0];
  if (topStud) console.log(`  best per stud: ${topStud.title} at $${topStud.best.value}/stud (difficulty ${topStud.difficulty}${topStud.regionKnown ? '' : ', region not recorded'})`);
  if (topUnit) console.log(`  best per unit: ${topUnit.title} at $${topUnit.best.value} (difficulty ${topUnit.difficulty}${topUnit.regionKnown ? '' : ', region not recorded'})`);
  const easiest = [...perStud].sort((a, b) => a.difficulty - b.difficulty || b.best.value - a.best.value)[0];
  if (easiest) console.log(`  best per stud at the lowest difficulty: ${easiest.title} at $${easiest.best.value}/stud (difficulty ${easiest.difficulty})`);
  if (rows.length === 0) throw new Error('the money guide has no rows — refusing to report success');
}

main().catch((error) => { console.error(`build-money-guide failed: ${error.message}`); process.exit(1); });
