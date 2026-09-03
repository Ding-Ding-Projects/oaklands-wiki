import { Shell } from '../components/Shell';
import { siteConfig } from '../lib/site-config';
import { href } from '../lib/routes';
import { readProvenance, formatBuiltAt } from '../lib/provenance';
import corpus from '../../data/corpus-summary.json';

const ACCENTS: Record<string, string> = {
  ores: 'var(--ok-cat-ores)', trees: 'var(--ok-cat-trees)', tools: 'var(--ok-cat-tools)',
  items: 'var(--ok-cat-items)', locations: 'var(--ok-cat-locations)', structures: 'var(--ok-cat-structures)',
  logic: 'var(--ok-cat-logic)', vinyls: 'var(--ok-cat-vinyls)', vehicles: 'var(--ok-cat-vehicles)',
  events: 'var(--ok-cat-events)', npcs: 'var(--ok-cat-npcs)',
};

function capturedOn(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'an unrecorded date'
    : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function Home() {
  const provenance = readProvenance();
  return (
    <Shell current="home">
      <p className="ok-eyebrow">Unofficial encyclopedia</p>
      <h1>Oaklands</h1>
      <div className="ok-prose" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        <p className="ok-lede">
          A reading-first archive of the community wiki for{' '}
          <a href={siteConfig.gameUrl} rel="noopener noreferrer">Oaklands</a>, the Roblox game
          by {siteConfig.developer} — rebuilt so it is actually readable on a phone.
        </p>
        <p>
          <strong>{corpus.captured.articles.toLocaleString()}</strong> articles are captured here,
          written by <strong>{corpus.editors.toLocaleString()}</strong> editors and taken from the
          source wiki on {capturedOn(corpus.capturedAt)}. The source reports{' '}
          {corpus.sourceReports.articles.toLocaleString()} articles and{' '}
          {corpus.sourceReports.images.toLocaleString()} media files in its own statistics — a
          slightly different count, because it counts pages differently.
        </p>
      </div>

      <h2 style={{ marginBlockStart: 'var(--ok-space-7)' }}>Browse</h2>
      <ul className="ok-catgrid" style={{ marginBlockStart: 'var(--ok-space-4)' }}>
        {corpus.categories.map((category) => (
          <li key={category.slug}>
            <a
              className="ok-cat"
              href={href(`/category/${category.name}/`)}
              style={{ ['--ok-cat-accent' as string]: ACCENTS[category.slug] ?? 'var(--ok-rule-strong)' }}
            >
              <span className="ok-cat__name">{category.name}</span>
              <span className="ok-cat__count">
                {category.count} {category.count === 1 ? 'article' : 'articles'}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="ok-note" style={{ marginBlockStart: 'var(--ok-space-6)', maxWidth: 'var(--ok-measure)' }}>
        <p style={{ margin: 0 }}>
          <strong>This site is at an early phase.</strong> Every article is archived and
          readable, and the categories above lead to them. Media is not archived yet, so
          images render a placeholder naming the file rather than borrowing the source
          wiki&rsquo;s bandwidth. Comparison tables, language modes and the wider settings
          surface come later; the{' '}
          <a href={siteConfig.sourceWiki} rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
            source wiki
          </a>{' '}
          remains where edits actually take effect.
        </p>
      </div>

      <p className="ok-muted" style={{ marginBlockStart: 'var(--ok-space-5)', fontSize: 'var(--ok-size-small)' }}>
        {provenance
          ? `Running version ${provenance.version}, built ${formatBuiltAt(provenance.builtAt)}.`
          : 'Build provenance unavailable — this artifact carries no recorded version or build time.'}
      </p>
    </Shell>
  );
}
