import { useCallback, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { Thumb, type Hero } from '../components/Thumb';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { href } from '../lib/routes';

export type CompareRow = { title: string; slug: string; hero: Hero; values: (string | null)[] };
export type CompareTable = { type: string; slug: string; count: number; columns: string[]; rows: CompareRow[] };
export type CompareData = { tables: CompareTable[]; active: string };

/**
 * Cross-article comparison, which the source wiki cannot do at all.
 *
 * Its facts live inside a per-article template, so nobody can see every ore's
 * price beside every other. Typed extraction turns that into a grouping problem
 * and this is the payoff.
 */

/** Sort numerically when a column really is numeric, alphabetically otherwise. */
function compareValues(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const na = Number.parseFloat(a.replace(/[^0-9.-]/g, ''));
  const nb = Number.parseFloat(b.replace(/[^0-9.-]/g, ''));
  const bothNumeric = Number.isFinite(na) && Number.isFinite(nb) && /\d/.test(a) && /\d/.test(b);
  return bothNumeric ? na - nb : a.localeCompare(b);
}

export function Compare({ data }: { data: CompareData }) {
  const [activeType, setActiveType] = useState(data.active);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 } | null>(null);

  const table = data.tables.find((t) => t.type === activeType) ?? data.tables[0];
  const textOf = useCallback((row: CompareRow) => `${row.title} ${row.values.join(' ')}`, []);
  const { results, error } = useSearchFilter(table?.rows ?? [], query, mode, flags, textOf);

  const sorted = useMemo(() => {
    if (!sort) return results;
    return [...results].sort((a, b) => compareValues(a.values[sort.column], b.values[sort.column]) * sort.direction);
  }, [results, sort]);

  if (!table) {
    return (
      <Shell current="browse">
        <h1>Compare</h1>
        <p className="ok-note">No comparison table could be built — no article type has enough shared fields.</p>
      </Shell>
    );
  }

  const toggleSort = (column: number) => {
    setSort((current) =>
      current && current.column === column
        ? { column, direction: current.direction === 1 ? -1 : 1 }
        : { column, direction: 1 },
    );
  };

  return (
    <Shell current="browse">
      <section className="ok-hero" style={{ paddingBlockEnd: 'var(--ok-space-4)' }}>
        <p className="ok-eyebrow">Compare</p>
        <h1>{table.type} side by side</h1>
        <p className="ok-hero__lede">
          Every {table.type.toLowerCase()} article&rsquo;s facts in one sortable table. The source
          wiki keeps these inside each article&rsquo;s own template, so this view does not exist there.
        </p>
      </section>

      <div className="ok-tabs" role="tablist" aria-label="Article type">
        {data.tables.map((entry) => (
          <button
            key={entry.type}
            type="button"
            role="tab"
            aria-selected={entry.type === table.type}
            className="ok-chip"
            onClick={() => { setActiveType(entry.type); setSort(null); }}
          >
            {entry.type} <span className="ok-muted">({entry.count})</span>
          </button>
        ))}
      </div>

      <SearchWithRegex
        label={`Search ${table.type}`}
        query={query} onQuery={setQuery}
        mode={mode} onMode={setMode}
        flags={flags} onFlags={setFlags}
        error={error}
        resultCount={sorted.length}
        totalCount={table.rows.length}
      />

      {/* The wrapper scrolls, never the page body. */}
      <div className="ok-tablewrap" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        <table>
          <caption>
            {sorted.length} of {table.rows.length} {table.type.toLowerCase()} articles.
            Select a column heading to sort; numeric columns sort by value, not by text.
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              {table.columns.map((column, index) => (
                <th key={column} scope="col" aria-sort={sort?.column === index ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="ok-sortbutton" onClick={() => toggleSort(index)}>
                    {column}
                    <span aria-hidden="true">{sort?.column === index ? (sort.direction === 1 ? ' ▲' : ' ▼') : ' ↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.slug}>
                <th scope="row">
                  <a className="ok-compare__name" href={href(`/wiki/${row.slug}/`)}>
                    <Thumb className="ok-row__thumb" hero={row.hero} alt={row.title} />
                    {row.title}
                  </a>
                </th>
                {row.values.map((value, index) => (
                  // An absent value is stated, never blank: a gap in the source
                  // and a gap in the import should not look identical.
                  <td key={table.columns[index]}>{value ?? <span className="ok-muted">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 ? (
        <p className="ok-note" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
          Nothing in {table.type} matches. The search covers the name and every value in the row.
        </p>
      ) : null}
    </Shell>
  );
}
