import { useCallback, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { href } from '../lib/routes';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { Thumb, type Hero } from '../components/Thumb';

type Form = { form: string; label: string; step: number; value: number; perStud: boolean };

export type MoneyRow = {
  title: string;
  slug: string;
  hero: Hero;
  type: string;
  region: string | null;
  regionTier: number | null;
  regionKnown: boolean;
  island: string | null;
  status: string | null;
  obtainable: boolean;
  forms: Form[];
  best: Form;
  raw: Form | null;
  uplift: number | null;
  difficulty: number;
  difficultyWhy: string;
  efficiency: number;
};

export type MoneyData = {
  counts: {
    items: number; priceFields: number; unparsed: number; eventCurrency: number;
    withRegion: number; unobtainable: number; perStud: number; perUnit: number;
  };
  method: { money: string; difficulty: string; independence: string; excluded: string; units: string };
  regions: { tier: number; name: string }[];
  rows: MoneyRow[];
  perStud: MoneyRow[];
  perUnit: MoneyRow[];
  tiers: { tier: number; count: number; best: { title: string; slug: string; value: number; form: string; regionKnown: boolean }[] }[];
};

type SortKey = 'value' | 'difficulty' | 'efficiency' | 'name';
type Unit = 'stud' | 'unit';

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Start here', 2: 'Easy', 3: 'Moderate', 4: 'Hard', 5: 'Deep or gone',
};

function Difficulty({ row }: { row: MoneyRow }) {
  const rounded = Math.round(row.difficulty);
  return (
    <span className="ok-difficulty" data-tier={rounded}>
      <span className="ok-difficulty__pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((pip) => (
          <span key={pip} data-on={pip <= rounded || undefined} />
        ))}
      </span>
      {/* Never colour or shape alone: the number and the reason are both text. */}
      <span className="ok-difficulty__text">
        {row.difficulty} — {DIFFICULTY_LABEL[rounded]}
        {row.regionKnown ? '' : ' (estimated)'}
      </span>
    </span>
  );
}

export function Money({ data }: { data: MoneyData }) {
  const [unit, setUnit] = useState<Unit>('stud');
  const [sort, setSort] = useState<SortKey>('value');
  const [maxDifficulty, setMaxDifficulty] = useState(5);
  const [obtainableOnly, setObtainableOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');

  const source = unit === 'stud' ? data.perStud : data.perUnit;

  const filtered = useMemo(
    () => source.filter((r) => r.difficulty <= maxDifficulty && (!obtainableOnly || r.obtainable)),
    [source, maxDifficulty, obtainableOnly],
  );

  const textOf = useCallback(
    (r: MoneyRow) => `${r.title} ${r.type} ${r.region ?? ''} ${r.island ?? ''} ${r.best.label} ${r.status ?? ''}`,
    [],
  );
  const { results, error } = useSearchFilter(filtered, query, mode, flags, textOf);

  const sorted = useMemo(() => {
    const copy = [...results];
    if (sort === 'value') copy.sort((a, b) => b.best.value - a.best.value);
    if (sort === 'difficulty') copy.sort((a, b) => a.difficulty - b.difficulty || b.best.value - a.best.value);
    if (sort === 'efficiency') copy.sort((a, b) => b.efficiency - a.efficiency);
    if (sort === 'name') copy.sort((a, b) => a.title.localeCompare(b.title));
    return copy;
  }, [results, sort]);

  const starters = useMemo(
    () => data.perStud.filter((r) => r.obtainable && r.difficulty <= 2).slice(0, 5),
    [data.perStud],
  );

  return (
    <Shell current="money">
      <section className="ok-hero">
        <p className="ok-eyebrow">Guide</p>
        <h1>Making money</h1>
        <p className="ok-lede">
          Every sell price the wiki records, ranked by what it earns and by how much work it takes to
          get — worked out separately, so "worth a lot and easy to reach" is a real finding rather
          than something the ranking assumed.
        </p>
      </section>

      {starters.length > 0 ? (
        <section className="ok-callout">
          <h2>If you are starting out</h2>
          <p>
            The best money on the easiest ground, out of the {data.counts.perStud} items priced per
            stud. Nothing here needs a boat trip or a hazard suit.
          </p>
          <ul className="ok-rows">
            {starters.map((row) => (
              <li key={row.slug}>
                <a className="ok-row" href={href(`/wiki/${row.slug}/`)}>
                  <Thumb className="ok-row__thumb" hero={row.hero} alt="" />
                  <span className="ok-row__body">
                    <span className="ok-row__name">{row.title}</span>
                    <span className="ok-row__summary">
                      {money(row.best.value)}/stud · {row.best.label} · {row.region}
                    </span>
                  </span>
                  <span className="ok-row__meta"><Difficulty row={row} /></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>The table</h2>

        <div className="ok-filters" role="group" aria-label="Price unit">
          <button type="button" className="ok-chip" aria-pressed={unit === 'stud'} onClick={() => setUnit('stud')}>
            Per stud <span className="ok-muted">{data.counts.perStud}</span>
          </button>
          <button type="button" className="ok-chip" aria-pressed={unit === 'unit'} onClick={() => setUnit('unit')}>
            Per item <span className="ok-muted">{data.counts.perUnit}</span>
          </button>
        </div>
        <p className="ok-note">
          These two are never mixed. A stud is a length of what you harvested and an item is one
          object, so ranking {money(13288)} a burl against {money(46)} a stud would compare numbers
          that do not measure the same quantity of anything.
        </p>

        <SearchWithRegex
          label="Search this table"
          query={query}
          onQuery={setQuery}
          mode={mode}
          onMode={setMode}
          flags={flags}
          onFlags={setFlags}
          error={error}
          resultCount={sorted.length}
          totalCount={source.length}
        />

        <div className="ok-filters" role="group" aria-label="Sort and filter">
          {(['value', 'difficulty', 'efficiency', 'name'] as SortKey[]).map((key) => (
            <button key={key} type="button" className="ok-chip" aria-pressed={sort === key} onClick={() => setSort(key)}>
              {{ value: 'Most money', difficulty: 'Easiest first', efficiency: 'Money per effort', name: 'A–Z' }[key]}
            </button>
          ))}
          <button type="button" className="ok-chip" aria-pressed={obtainableOnly} onClick={() => setObtainableOnly((v) => !v)}>
            Obtainable only <span className="ok-muted">{data.counts.unobtainable} hidden</span>
          </button>
        </div>

        <label className="ok-slider">
          <span>Hardest to show: {maxDifficulty} — {DIFFICULTY_LABEL[maxDifficulty]}</span>
          <input
            type="range" min={1} max={5} step={1} value={maxDifficulty}
            onChange={(event) => setMaxDifficulty(Number(event.target.value))}
          />
        </label>

        <p className="ok-search__status" aria-live="polite">
          {sorted.length} of {source.length} shown
        </p>

        <div className="ok-tablewrap">
          <table className="ok-table">
            <caption className="ok-visually-hidden">
              Sell prices ranked by {sort}, {unit === 'stud' ? 'per stud' : 'per item'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Best price</th>
                <th scope="col">How</th>
                <th scope="col">Where</th>
                <th scope="col">Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.slug}>
                  <th scope="row">
                    <a href={href(`/wiki/${row.slug}/`)}>{row.title}</a>
                    {row.obtainable ? null : <span className="ok-tag">no longer obtainable</span>}
                  </th>
                  <td className="ok-num">
                    {money(row.best.value)}{row.best.perStud ? '/stud' : ''}
                    {row.uplift && row.uplift > 1 ? (
                      <span className="ok-muted"> ×{row.uplift} on raw</span>
                    ) : null}
                  </td>
                  <td>{row.best.label}</td>
                  <td>{row.region ?? <span className="ok-muted">not recorded</span>}</td>
                  <td><Difficulty row={row} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 ? (
          <p className="ok-empty">Nothing matches those filters. Widen the difficulty or clear the search.</p>
        ) : null}
      </section>

      <section>
        <h2>How these numbers were worked out</h2>
        <p>
          Read this before trusting the ranking. The method is published so you can disagree with the
          model rather than with the conclusion.
        </p>
        <dl className="ok-method">
          <dt>Money</dt>
          <dd>{data.method.money}</dd>
          <dt>Difficulty</dt>
          <dd>{data.method.difficulty}</dd>
          <dt>Why they are kept apart</dt>
          <dd>{data.method.independence}</dd>
          <dt>Units</dt>
          <dd>{data.method.units}</dd>
          <dt>What is left out</dt>
          <dd>{data.method.excluded}</dd>
        </dl>

        <h3>Region tiers</h3>
        <p>
          The Island field is free text typed by contributors, so it arrives with typos, with biomes
          used in place of islands, and with several places at once. These are the groupings, read
          out of the corpus rather than invented. Where an item lists more than one place, the
          easiest counts — you only have to reach one of them.
        </p>
        <ul className="ok-tierlist">
          {[1, 2, 3, 4, 5].map((tier) => (
            <li key={tier}>
              <strong>Tier {tier}</strong>{' — '}
              {data.regions.filter((r) => r.tier === tier).map((r) => r.name).join(', ') || 'none'}
            </li>
          ))}
        </ul>

        <h3>What this cannot tell you</h3>
        <ul>
          <li>
            <strong>{data.counts.items - data.counts.withRegion} of {data.counts.items} items have no
            recorded region</strong>, including every burl. Their difficulty uses the midpoint and is
            marked <em>estimated</em> in the table rather than presented as measured.
          </li>
          <li>
            <strong>Nothing here measures time.</strong> A price per stud says what a stud is worth,
            not how long it takes to harvest, walk back and sell. Two items at the same price can be
            very different amounts of work.
          </li>
          <li>
            <strong>{data.counts.unparsed} price fields could not be read</strong> out of{' '}
            {data.counts.priceFields}, and a further {data.counts.eventCurrency} are in an event
            currency — snowflakes, eggs, candy — which is not money and is excluded.
          </li>
          <li>
            <strong>These prices are a dated snapshot</strong> of a community wiki, entered by hand.
            An update can change any of them, and a wrong figure here is a wrong figure there.
          </li>
        </ul>
      </section>
    </Shell>
  );
}
