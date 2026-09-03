import { Shell } from '../components/Shell';
import { siteConfig } from '../lib/site-config';
import { href } from '../lib/routes';
import { Thumb, type Hero } from '../components/Thumb';

export type InfoboxField = { label: string; value: string };
export type ArticleRecord = {
  title: string;
  slug: string;
  hero: Hero;
  pageid: number;
  revid: number;
  timestamp: string;
  lastEditor: string;
  categories: string[];
  infobox: { type: string; fields: InfoboxField[] } | null;
  body: string;
  sections: { id: string; text: string }[];
  /**
   * Present when this page is one of the source wiki's alternate names.
   *
   * The source redirects these, which makes the name itself unreachable: follow
   * a link to it and you arrive somewhere else with no record that the name you
   * asked for exists. Here it is a real page carrying the same content, and the
   * relationship is stated on the page rather than hidden in a hop.
   */
  alias?: { of: string; slug: string } | null;
};

const CATEGORY_ACCENT: Record<string, string> = {
  Ores: 'var(--ok-category-ores)', Trees: 'var(--ok-category-trees)', Tools: 'var(--ok-category-tools)',
  Items: 'var(--ok-category-items)', Locations: 'var(--ok-category-locations)',
  Structures: 'var(--ok-category-structures)', Logic: 'var(--ok-category-logic)',
  Vinyls: 'var(--ok-category-vinyls)', Vehicles: 'var(--ok-category-vehicles)',
  Events: 'var(--ok-category-events)', NPCs: 'var(--ok-category-npcs)',
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'an unrecorded date';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function Article({ article }: { article: ArticleRecord }) {
  const accent = article.categories
    .map((c) => CATEGORY_ACCENT[c])
    .find(Boolean) ?? 'var(--ok-rule-strong)';

  return (
    <Shell current="browse">
      <article className="ok-article">
        <header className="ok-article__head">
          {article.categories.length > 0 ? (
            <p className="ok-eyebrow" style={{ color: accent }}>
              {article.categories.slice(0, 3).join(' · ')}
            </p>
          ) : null}
          <h1>{article.title}</h1>
          {article.alias ? (
            <p className="ok-alias-note">
              <strong>{article.title}</strong> is another name for{' '}
              <a href={href(`/wiki/${article.alias.slug}/`)}>{article.alias.of}</a>. The source wiki
              redirects this name; here it is a page of its own, with the same content, so the name
              you asked for stays where you asked for it.
            </p>
          ) : null}
        </header>

        {/* Key facts sit ABOVE the prose on a phone and beside it when there is
            room. On the source wiki this is a right-floating table that falls
            off the side of a narrow screen. */}
        {article.infobox ? (
          <aside className="ok-keyfacts ok-article__facts" aria-labelledby="keyfacts-heading">
            {article.hero ? (
              <Thumb className="ok-keyfacts__art" hero={article.hero} alt={article.title} />
            ) : null}
            <h2 id="keyfacts-heading" className="ok-eyebrow" style={{ marginBlockEnd: 'var(--ok-space-3)' }}>
              Key facts
            </h2>
            <dl>
              {article.infobox.fields.map((field) => (
                <div key={field.label} style={{ display: 'contents' }}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}

        {article.sections.length > 1 ? (
          <nav className="ok-toc" aria-label="On this page">
            <p className="ok-eyebrow">On this page</p>
            <ul>
              {article.sections.map((section) => (
                <li key={section.id}><a href={`#${section.id}`}>{section.text}</a></li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div
          className="ok-prose ok-article__body"
          // The body is sanitised at build time by scripts/build-articles.mjs:
          // source chrome removed, links resolved or demoted to plain text,
          // tables wrapped so they scroll inside their own box.
          dangerouslySetInnerHTML={{ __html: article.body }}
        />

        <footer className="ok-attribution">
          <h2 className="ok-eyebrow">Attribution</h2>
          <p>
            This article is taken from{' '}
            <a
              href={`${siteConfig.sourceWiki}/wiki/${article.slug}`}
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
            >
              &ldquo;{article.title}&rdquo; on the {siteConfig.sourceWikiName}
            </a>
            , revision <code>{article.revid}</code>, last edited {formatTimestamp(article.timestamp)} by{' '}
            <strong>{article.lastEditor}</strong> and its contributors.
          </p>
          <p>
            Licensed{' '}
            <a href={siteConfig.contentLicenceUrl} rel="noopener noreferrer license">
              {siteConfig.contentLicence}
            </a>
            . This is an archived snapshot, not a live mirror — the source may have changed since.
            Corrections belong upstream, where they actually take effect.
          </p>
          <p>
            <a href={href('/')}>All categories</a>
          </p>
        </footer>
      </article>
    </Shell>
  );
}
