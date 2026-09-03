import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { href, asset } from '../lib/routes';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { Thumb } from '../components/Thumb';

type Entry = {
  t: string;
  u: string;
  k: 'article' | 'alias' | 'category' | 'file' | 'page';
  s: string;
  c: string[];
  x: string;
  h: string | null;
};

const KIND_LABEL: Record<Entry['k'], string> = {
  article: 'Article',
  alias: 'Another name',
  category: 'Category',
  file: 'File',
  page: 'Site page',
};

const KIND_ORDER: Entry['k'][] = ['article', 'category', 'alias', 'file', 'page'];

/**
 * A result is scored so the obvious answer comes first.
 *
 * Searching "copper" should not bury the Copper article under forty files whose
 * names contain it. An exact title match wins, then a title prefix, then a title
 * substring, and only then a match somewhere in the summary or the facts. Kind
 * breaks the remaining ties, because an article is what most people came for.
 */
function score(entry: Entry, needle: string): number {
  const title = entry.t.toLowerCase();
  let base = 0;
  if (title === needle) base = 1000;
  else if (title.startsWith(needle)) base = 800;
  else if (title.includes(needle)) base = 600;
  else if (entry.s.toLowerCase().includes(needle)) base = 300;
  else base = 100;
  const kindBonus = { article: 50, category: 40, alias: 30, page: 20, file: 0 }[entry.k];
  // A shorter title containing the needle is usually the more specific page.
  return base + kindBonus - Math.min(title.length, 40) / 10;
}

export function Search() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [kinds, setKinds] = useState<Set<Entry['k']>>(new Set(KIND_ORDER));

  // The query arrives in the URL, because the master search bar is a plain form
  // that submits from every page including the static ones.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') ?? '';
    if (q) setQuery(q);
    if (params.get('mode') === 'regex') setMode('regex');
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(asset('search-index.json'))
      .then((response) => {
        if (!response.ok) throw new Error(`the index returned HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => { if (!cancelled) setEntries(data.entries as Entry[]); })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'the index could not be loaded');
      });
    return () => { cancelled = true; };
  }, []);

  // Keep the address bar in step, so a result set can be linked to or reloaded.
  useEffect(() => {
    if (entries === null) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (mode === 'regex') params.set('mode', 'regex');
    const next = params.toString();
    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [query, mode, entries]);

  const pool = useMemo(() => (entries ?? []).filter((e) => kinds.has(e.k)), [entries, kinds]);
  const textOf = useCallback((entry: Entry) => `${entry.t} ${entry.s} ${entry.c.join(' ')} ${entry.x}`, []);
  const { results, error } = useSearchFilter(pool, query, mode, flags, textOf);

  const ranked = useMemo(() => {
    if (query.trim() === '') return [];
    const needle = query.toLowerCase();
    return [...results].sort((a, b) => score(b, needle) - score(a, needle) || a.t.localeCompare(b.t));
  }, [results, query]);

  const counts = useMemo(() => {
    const acc = {} as Record<Entry['k'], number>;
    for (const k of KIND_ORDER) acc[k] = 0;
    for (const entry of entries ?? []) acc[entry.k] += 1;
    return acc;
  }, [entries]);

  const toggleKind = (kind: Entry['k']) => {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      // Turning the last one off would leave a filter that can never match,
      // which reads as a broken search rather than as an empty one.
      return next.size === 0 ? new Set([kind]) : next;
    });
  };

  const shown = ranked.slice(0, 200);

  return (
    <Shell current="search">
      <section className="ok-hero">
        <p className="ok-eyebrow">Search</p>
        <h1>Search every page</h1>
        <p className="ok-lede">
          Every article, every alternate name, every category and every archived file — one index,
          searched here. Plain text by default; the builder beside the field turns on regular
          expressions when you want them.
        </p>
      </section>

      <SearchWithRegex
        label="Search every page"
        query={query}
        onQuery={setQuery}
        mode={mode}
        onMode={setMode}
        flags={flags}
        onFlags={setFlags}
        error={error}
        resultCount={ranked.length}
        totalCount={entries?.length ?? 0}
      />

      <div className="ok-filters" role="group" aria-label="Filter by kind">
        {KIND_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            className="ok-chip"
            aria-pressed={kinds.has(kind)}
            onClick={() => toggleKind(kind)}
          >
            {KIND_LABEL[kind]} <span className="ok-muted">{counts[kind] ?? 0}</span>
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="ok-empty" role="alert">
          The search index could not be loaded ({loadError}), so nothing can be searched on this
          page right now. Browse is unaffected — it carries its own list.
          {' '}<a href={href('/browse/')}>Go to Browse</a>.
        </p>
      ) : entries === null ? (
        <p className="ok-empty">Loading the index…</p>
      ) : query.trim() === '' ? (
        <p className="ok-empty">
          Type above to search {entries.length.toLocaleString()} pages. Nothing is searched until you
          do — this page holds the whole index rather than asking a server.
        </p>
      ) : ranked.length === 0 ? (
        <p className="ok-empty">
          Nothing matches <strong>{query}</strong>
          {kinds.size < KIND_ORDER.length ? ' with the current kind filter' : ''}. Every page on this
          site is in the index, so this is a real absence rather than an unindexed corner.
        </p>
      ) : (
        <>
          <p className="ok-search__status" aria-live="polite">
            {ranked.length.toLocaleString()} result{ranked.length === 1 ? '' : 's'}
            {ranked.length > shown.length ? `, showing the first ${shown.length}` : ''}
          </p>
          <ul className="ok-rows ok-results">
            {shown.map((entry) => (
              <li key={entry.u}>
                <a className="ok-row" href={href(entry.u)}>
                  {entry.h ? (
                    <Thumb className="ok-row__thumb" hero={{ file: entry.h, width: null, height: null }} alt="" />
                  ) : null}
                  <span className="ok-row__body">
                    <span className="ok-row__name">{entry.t}</span>
                    <span className="ok-row__summary">{entry.s}</span>
                  </span>
                  <span className="ok-row__meta">{KIND_LABEL[entry.k]}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}
