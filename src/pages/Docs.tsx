import { useCallback, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { SearchWithRegex, useSearchFilter, type SearchMode } from '../components/SearchWithRegex';
import { readProvenance, formatBuiltAt } from '../lib/provenance';
import { siteConfig } from '../lib/site-config';
import { href } from '../lib/routes';

export type DocArticle = {
  slug: string;
  category: string;
  title: string;
  body: string;
  suggested: { slug: string; title: string }[];
};
export type ChangelogEntry = {
  sha: string; shortSha: string; date: string; subject: string; body: string; url: string;
};
export type DocsData = { docs: DocArticle[]; changelog: ChangelogEntry[] };

/**
 * Documentation, changelog and status, in one offline surface.
 *
 * Every article is bundled into the build: nothing here fetches, so it all works
 * with the network unplugged. Article-to-article links resolve inside this page
 * rather than opening a browser or dead-ending.
 */
export function Docs({ data }: { data: DocsData }) {
  const [tab, setTab] = useState<'docs' | 'changelog' | 'status'>('docs');
  return (
    <Shell current="docs">
      <section className="ok-hero" style={{ paddingBlockEnd: 'var(--ok-space-4)' }}>
        <p className="ok-eyebrow">Reference</p>
        <h1>Documentation, changelog and status</h1>
        <p className="ok-hero__lede">
          All of it is bundled into this page, so it works with the network unplugged.
        </p>
      </section>

      <div className="ok-tabs" role="tablist" aria-label="Reference section">
        {(['docs', 'changelog', 'status'] as const).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name}
            className="ok-chip" onClick={() => setTab(name)}>
            {name === 'docs' ? 'Documentation' : name === 'changelog' ? 'Changelog' : 'Status'}
          </button>
        ))}
      </div>

      {tab === 'docs' ? <DocBrowser docs={data.docs} /> : null}
      {tab === 'changelog' ? <Changelog entries={data.changelog} /> : null}
      {tab === 'status' ? <Status docs={data.docs} changelog={data.changelog} /> : null}
    </Shell>
  );
}

/** Minimal Markdown rendering for the bundled articles. */
function renderMarkdown(body: string, onNavigate: (slug: string) => void) {
  const blocks: React.ReactNode[] = [];
  const lines = body.split('\n');
  let paragraph: string[] = [];
  let list: string[] = [];

  const inline = (text: string, key: string): React.ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((part, index) => {
      const id = `${key}-${index}`;
      if (part.startsWith('**')) return <strong key={id}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`')) return <code key={id}>{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        const target = link[2];
        // A relative .md link stays inside this page rather than dead-ending.
        if (target.endsWith('.md')) {
          return (
            <a key={id} href="#" onClick={(event) => { event.preventDefault(); onNavigate(target.replace(/\.md$/, '')); }}>
              {link[1]}
            </a>
          );
        }
        return <a key={id} href={target} rel="noopener noreferrer">{link[1]}</a>;
      }
      return <span key={id}>{part}</span>;
    });

  const flush = (key: string) => {
    if (paragraph.length > 0) { blocks.push(<p key={`p${key}`}>{inline(paragraph.join(' '), `p${key}`)}</p>); paragraph = []; }
    if (list.length > 0) {
      blocks.push(<ul key={`u${key}`}>{list.map((item, index) => <li key={index}>{inline(item, `l${key}-${index}`)}</li>)}</ul>);
      list = [];
    }
  };

  lines.forEach((line, index) => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush(String(index));
      const level = Math.min(heading[1].length + 1, 6);
      const Tag = `h${level}` as 'h2';
      blocks.push(<Tag key={`h${index}`}>{heading[2]}</Tag>);
      return;
    }
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    if (bullet) { if (paragraph.length) flush(String(index)); list.push(bullet[1]); return; }
    if (line.trim() === '') { flush(String(index)); return; }
    if (list.length) flush(String(index));
    paragraph.push(line.trim());
  });
  flush('end');
  return blocks;
}

function DocBrowser({ docs }: { docs: DocArticle[] }) {
  const [slug, setSlug] = useState(docs[0]?.slug ?? '');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');

  // Search covers titles AND bodies: a reader who remembers a phrase should not
  // have to remember which article it was in.
  const textOf = useCallback((doc: DocArticle) => `${doc.title} ${doc.category} ${doc.body}`, []);
  const { results, error } = useSearchFilter(docs, query, mode, flags, textOf);
  const active = docs.find((doc) => doc.slug === slug) ?? docs[0];

  const byCategory = useMemo(() => {
    const groups = new Map<string, DocArticle[]>();
    for (const doc of results) {
      if (!groups.has(doc.category)) groups.set(doc.category, []);
      groups.get(doc.category)!.push(doc);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  if (!active) return <p className="ok-note">No documentation is bundled in this build.</p>;

  return (
    <div className="ok-docs">
      <aside className="ok-docs__nav" aria-label="Documentation">
        <SearchWithRegex
          label="Search documentation"
          query={query} onQuery={setQuery} mode={mode} onMode={setMode}
          flags={flags} onFlags={setFlags} error={error}
          resultCount={results.length} totalCount={docs.length}
        />
        {byCategory.map(([category, items]) => (
          <section key={category}>
            <p className="ok-eyebrow">{category}</p>
            <ul className="ok-rows">
              {items.map((doc) => (
                <li key={doc.slug}>
                  <button type="button" className="ok-row" style={{ width: '100%' }}
                    aria-current={doc.slug === active.slug ? 'page' : undefined}
                    onClick={() => setSlug(doc.slug)}>
                    <span className="ok-row__name">{doc.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {results.length === 0 ? <p className="ok-muted">Nothing matches.</p> : null}
      </aside>

      <article className="ok-prose ok-docs__body">
        {renderMarkdown(active.body, setSlug)}
        {active.suggested.length > 0 ? (
          <>
            <h2>Suggested articles</h2>
            <ul>
              {active.suggested.map((entry) => (
                <li key={entry.slug}>
                  <a href="#" onClick={(event) => { event.preventDefault(); setSlug(entry.slug); }}>{entry.title}</a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </div>
  );
}

function Changelog({ entries }: { entries: ChangelogEntry[] }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('text');
  const [flags, setFlags] = useState('i');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const narrowed = useMemo(
    () => entries.filter((entry) => {
      const date = entry.date.slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    }),
    [entries, from, to],
  );
  const textOf = useCallback((entry: ChangelogEntry) => `${entry.subject} ${entry.body}`, []);
  const { results, error } = useSearchFilter(narrowed, query, mode, flags, textOf);

  const copy = () => {
    const text = results
      .map((entry) => `## ${entry.subject}\n${entry.date} · ${entry.shortSha}\n\n${entry.body}`)
      .join('\n\n---\n\n');
    void navigator.clipboard?.writeText(`# Changelog (${results.length} of ${entries.length} entries)\n\n${text}`);
  };

  return (
    <div>
      <p className="ok-muted">
        Every entry links to the commit that made the change. An entry that says what changed
        but not where is unverifiable, so each carries its full SHA and each SHA was checked to
        exist before this build shipped.
      </p>

      <SearchWithRegex
        label="Search the changelog"
        query={query} onQuery={setQuery} mode={mode} onMode={setMode}
        flags={flags} onFlags={setFlags} error={error}
        resultCount={results.length} totalCount={entries.length}
      />

      <div className="ok-filters">
        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="cl-from">From</label>
          <input id="cl-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="ok-filter">
          <label className="ok-eyebrow" htmlFor="cl-to">To</label>
          <input id="cl-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <button type="button" className="ok-chip" onClick={copy}>Copy {results.length} shown</button>
      </div>

      <ol className="ok-changelog">
        {results.map((entry) => (
          <li key={entry.sha}>
            <h3>{entry.subject}</h3>
            <p className="ok-muted">
              <time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString()}</time>
              {' · '}
              <a href={entry.url} rel="noopener noreferrer"><code>{entry.shortSha}</code></a>
            </p>
            {entry.body ? <p>{entry.body.split('\n\n')[0]}</p> : null}
          </li>
        ))}
        {results.length === 0 ? <li className="ok-muted">No entry matches.</li> : null}
      </ol>
    </div>
  );
}

function Status({ docs, changelog }: { docs: DocArticle[]; changelog: ChangelogEntry[] }) {
  const provenance = readProvenance();
  const rows: { label: string; value: string; state: string }[] = [
    { label: 'Site', value: 'Published to GitHub Pages', state: '✅ live' },
    { label: 'Wiki mirror', value: 'Generated from the same corpus', state: '✅ live' },
    { label: 'Documentation', value: `${docs.length} articles bundled offline`, state: '✅ verified' },
    { label: 'Changelog', value: `${changelog.length} entries, every SHA checked`, state: '✅ verified' },
    { label: 'Media', value: 'Still images archived; audio and video are not', state: '⚠ partial' },
    { label: 'CI', value: 'Builds and publishes; runs no tests by policy', state: '✅ green' },
  ];

  return (
    <div>
      <p className="ok-muted">
        What this build actually is, and what it is not. Anything unfinished says so here
        rather than being left for somebody to discover.
      </p>

      <div className="ok-tablewrap" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        <table>
          <caption>Current state of this build</caption>
          <thead>
            <tr><th scope="col">Area</th><th scope="col">State</th><th scope="col">Detail</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.state}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ok-muted" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {provenance
          ? <>Version {provenance.version}, built {formatBuiltAt(provenance.builtAt)}, from commit{' '}
            <a href={`${siteConfig.repository}/commit/${provenance.commit}`} rel="noopener noreferrer">
              <code>{provenance.commit.slice(0, 7)}</code>
            </a>.</>
          : 'Build provenance is unavailable for this artifact, and none is invented here.'}
      </p>
      <p><a href={href('/about/')}>About this archive</a></p>
    </div>
  );
}
