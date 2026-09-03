import { Shell } from '../components/Shell';
import { Thumb, type Hero } from '../components/Thumb';
import { siteConfig } from '../lib/site-config';
import { href } from '../lib/routes';
import corpus from '../../data/corpus-summary.json';

export type HomeData = {
  categories: { name: string; slug: string; count: number; hero: Hero }[];
  featured: { title: string; slug: string; hero: Hero; infoboxType: string | null }[];
  totals: { articles: number; categories: number; images: number };
};

const ACCENTS: Record<string, string> = {
  Ores: 'var(--ok-category-ores)', Trees: 'var(--ok-category-trees)', Tools: 'var(--ok-category-tools)',
  Items: 'var(--ok-category-items)', Locations: 'var(--ok-category-locations)',
  Structures: 'var(--ok-category-structures)', Logic: 'var(--ok-category-logic)',
  Vinyls: 'var(--ok-category-vinyls)', Vehicles: 'var(--ok-category-vehicles)',
  Events: 'var(--ok-category-events)', NPCs: 'var(--ok-category-npcs)',
};

export function Home({ data }: { data: HomeData }) {
  return (
    <Shell current="home">
      <section className="ok-hero">
        <p className="ok-eyebrow">Unofficial encyclopedia</p>
        <h1>Everything in Oaklands, finally readable.</h1>
        <p className="ok-hero__lede">
          A complete archive of the community wiki for{' '}
          <a href={siteConfig.gameUrl} rel="noopener noreferrer">Oaklands</a>, the Roblox game
          by {siteConfig.developer} — rebuilt for a phone, with the facts up front.
        </p>
        <ul className="ok-hero__stats">
          <li><b>{data.totals.articles.toLocaleString()}</b><span>Articles</span></li>
          <li><b>{data.totals.categories}</b><span>Categories</span></li>
          <li><b>{data.totals.images.toLocaleString()}</b><span>Images</span></li>
          <li><b>{corpus.editors.toLocaleString()}</b><span>Editors credited</span></li>
        </ul>
      </section>

      <div className="ok-section-head">
        <h2>Browse by category</h2>
        <a className="ok-chip" href={href('/browse/')}>All {data.totals.categories} →</a>
      </div>
      <ul className="ok-tiles">
        {data.categories.map((category) => (
          <li key={category.slug}>
            <a
              className="ok-tile"
              href={href(`/category/${category.slug}/`)}
              style={{ ['--ok-category-accent' as string]: ACCENTS[category.name] ?? 'var(--ok-rule-strong)' }}
            >
              <Thumb className="ok-tile__art" hero={category.hero} alt={category.name.replace(/_/g, ' ')} />
              <span className="ok-tile__body">
                <span className="ok-tile__name">{category.name.replace(/_/g, ' ')}</span>
                <span className="ok-tile__meta">{category.count} articles</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="ok-section-head">
        <h2>Start somewhere</h2>
        <a className="ok-chip" href={href('/browse/')}>Search everything →</a>
      </div>
      <ul className="ok-tiles">
        {data.featured.map((article) => (
          <li key={article.slug}>
            <a className="ok-tile" href={href(`/wiki/${article.slug}/`)}>
              <Thumb className="ok-tile__art" hero={article.hero} alt={article.title} />
              <span className="ok-tile__body">
                <span className="ok-tile__name">{article.title}</span>
                {article.infoboxType ? <span className="ok-tile__meta">{article.infoboxType}</span> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="ok-note" style={{ marginBlockStart: 'var(--ok-space-7)', maxWidth: 'var(--ok-measure)' }}>
        <p style={{ margin: 0 }}>
          <strong>An archived snapshot, not a live mirror.</strong> Everything here was captured
          from the source wiki and will drift from it between captures. Corrections belong{' '}
          <a href={siteConfig.sourceWiki} rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
            upstream
          </a>
          , where edits actually take effect. Audio and video are not archived yet and show a
          placeholder naming the file rather than borrowing the source&rsquo;s bandwidth.
        </p>
      </div>
    </Shell>
  );
}
