import { useCallback, useState } from 'react';
import { Shell } from '../components/Shell';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { href } from '../lib/routes';
import { Thumb, type Hero } from '../components/Thumb';

export type CategoryMember = { title: string; slug: string; infoboxType: string | null; hero: Hero };
export type CategoryRecord = { name: string; slug: string; count: number; articles: CategoryMember[] };

const ACCENTS: Record<string, string> = {
  Ores: 'var(--ok-cat-ores)', Trees: 'var(--ok-cat-trees)', Tools: 'var(--ok-cat-tools)',
  Items: 'var(--ok-cat-items)', Locations: 'var(--ok-cat-locations)',
  Structures: 'var(--ok-cat-structures)', Logic: 'var(--ok-cat-logic)',
  Vinyls: 'var(--ok-cat-vinyls)', Vehicles: 'var(--ok-cat-vehicles)',
  Events: 'var(--ok-cat-events)', NPCs: 'var(--ok-cat-npcs)',
};

export function Category({ category }: { category: CategoryRecord }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');

  const textOf = useCallback((member: CategoryMember) => member.title, []);
  const { results, error } = useSearchFilter(category.articles, query, mode, flags, textOf);
  const accent = ACCENTS[category.name] ?? 'var(--ok-rule-strong)';

  return (
    <Shell current="browse">
      <p className="ok-eyebrow" style={{ color: accent }}>Category</p>
      <h1>{category.name.replace(/_/g, ' ')}</h1>
      <p className="ok-lede" style={{ marginBlockStart: 'var(--ok-space-3)', maxWidth: 'var(--ok-measure)' }}>
        {category.count} {category.count === 1 ? 'article' : 'articles'} in this category.
      </p>

      <SearchWithRegex
        label={`Search ${category.name.replace(/_/g, ' ')}`}
        query={query}
        onQuery={setQuery}
        mode={mode}
        onMode={setMode}
        flags={flags}
        onFlags={setFlags}
        error={error}
        resultCount={results.length}
        totalCount={category.articles.length}
      />

      {results.length === 0 ? (
        <p className="ok-note" style={{ maxWidth: 'var(--ok-measure)' }}>
          Nothing in this category matches <strong>{query}</strong>. The filter searches
          article titles only.
        </p>
      ) : (
        <ul className="ok-rows" style={{ marginBlockStart: 'var(--ok-space-5)' }}>
          {results.map((member) => (
            <li key={member.slug}>
              <a className="ok-row" href={href(`/wiki/${member.slug}/`)}>
                <Thumb className="ok-row__thumb" hero={member.hero} alt={member.title} />
                <span className="ok-row__name">{member.title}</span>
                {member.infoboxType ? <span className="ok-row__meta">{member.infoboxType}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginBlockStart: 'var(--ok-space-6)' }}>
        <a href={href('/')}>All categories</a>
      </p>
    </Shell>
  );
}
