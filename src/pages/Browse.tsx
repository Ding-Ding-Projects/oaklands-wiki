import { useCallback, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { Thumb, type Hero } from '../components/Thumb';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { href } from '../lib/routes';

export type BrowseEntry = {
  title: string;
  slug: string;
  hero: Hero;
  categories: string[];
  infoboxType: string | null;
};
export type BrowseData = {
  articles: BrowseEntry[];
  categories: { name: string; slug: string; count: number }[];
  types: string[];
};

const LETTERS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

/** The initial a title files under. Anything not A-Z lands in `#`. */
function initialOf(title: string): string {
  const first = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export function Browse({ data }: { data: BrowseData }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [letter, setLetter] = useState('All');
  const [category, setCategory] = useState('All');
  const [type, setType] = useState('All');

  // Every filter composes; none silently overrides another.
  const narrowed = useMemo(
    () =>
      data.articles.filter((article) => {
        if (letter !== 'All' && initialOf(article.title) !== letter) return false;
        if (category !== 'All' && !article.categories.includes(category)) return false;
        if (type !== 'All' && article.infoboxType !== type) return false;
        return true;
      }),
    [data.articles, letter, category, type],
  );

  const textOf = useCallback((article: BrowseEntry) => article.title, []);
  const { results, error } = useSearchFilter(narrowed, query, mode, flags, textOf);

  const active = letter !== 'All' || category !== 'All' || type !== 'All' || query.trim() !== '';
  const clear = () => { setLetter('All'); setCategory('All'); setType('All'); setQuery(''); };

  return (
    <Shell current="browse">
      <section className="ok-hero" style={{ paddingBlockEnd: 'var(--ok-space-5)' }}>
        <p className="ok-eyebrow">Browse</p>
        <h1>All {data.articles.length.toLocaleString()} articles</h1>
        <p className="ok-hero__lede">
          Filter by first letter, category or item type, and search by plain text or a regular
          expression. Every filter composes with the others.
        </p>
      </section>

      <SearchWithRegex
        label="Search every article"
        query={query}
        onQuery={setQuery}
        mode={mode}
        onMode={setMode}
        flags={flags}
        onFlags={setFlags}
        error={error}
        resultCount={results.length}
        totalCount={data.articles.length}
      />

      <div className="ok-filters">
        <div className="ok-filter">
          <p className="ok-eyebrow" id="filter-letter">First letter</p>
          <div className="ok-filter__chips" role="group" aria-labelledby="filter-letter">
            {LETTERS.map((value) => (
              <button
                key={value}
                type="button"
                className="ok-chip"
                aria-pressed={letter === value}
                onClick={() => setLetter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="filter-category">Category</label>
          <select id="filter-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="All">All categories</option>
            {data.categories.map((entry) => (
              <option key={entry.slug} value={entry.name}>
                {entry.name.replace(/_/g, ' ')} ({entry.count})
              </option>
            ))}
          </select>
        </div>

        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="filter-type">Item type</label>
          <select id="filter-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="All">All types</option>
            {data.types.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>

        {active ? (
          <button type="button" className="ok-chip" onClick={clear}>Clear filters</button>
        ) : null}
      </div>

      <p className="ok-muted" style={{ marginBlock: 'var(--ok-space-4)', fontSize: 'var(--ok-size-small)' }}>
        Showing <strong>{results.length.toLocaleString()}</strong> of {data.articles.length.toLocaleString()} articles.
      </p>

      {results.length === 0 ? (
        <div className="ok-note" style={{ maxWidth: 'var(--ok-measure)' }}>
          <p style={{ margin: 0 }}>
            Nothing matches these filters. The search covers article titles; the category and type
            filters use the values each article actually carries.
          </p>
        </div>
      ) : (
        <ul className="ok-rows">
          {results.map((article) => (
            <li key={article.slug}>
              <a className="ok-row" href={href(`/wiki/${article.slug}/`)}>
                <Thumb className="ok-row__thumb" hero={article.hero} alt={article.title} />
                <span className="ok-row__name">{article.title}</span>
                <span className="ok-row__meta">{article.infoboxType ?? article.categories[0]?.replace(/_/g, ' ') ?? ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
