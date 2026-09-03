import { Shell } from '../components/Shell';
import { siteConfig } from '../lib/site-config';
import { href } from '../lib/routes';

export type InfoboxField = { label: string; value: string };
export type ArticleRecord = {
  title: string;
  slug: string;
  pageid: number;
  revid: number;
  timestamp: string;
  lastEditor: string;
  categories: string[];
  infobox: { type: string; fields: InfoboxField[] } | null;
  body: string;
  sections: { id: string; text: string }[];
};

const CATEGORY_ACCENT: Record<string, string> = {
  Ores: 'var(--ok-cat-ores)', Trees: 'var(--ok-cat-trees)', Tools: 'var(--ok-cat-tools)',
  Items: 'var(--ok-cat-items)', Locations: 'var(--ok-cat-locations)',
  Structures: 'var(--ok-cat-structures)', Logic: 'var(--ok-cat-logic)',
  Vinyls: 'var(--ok-cat-vinyls)', Vehicles: 'var(--ok-cat-vehicles)',
  Events: 'var(--ok-cat-events)', NPCs: 'var(--ok-cat-npcs)',
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
    <Shell current="home">
      <article className="ok-article">
        <header className="ok-article__head">
          {article.categories.length > 0 ? (
            <p className="ok-eyebrow" style={{ color: accent }}>
              {article.categories.slice(0, 3).join(' · ')}
            </p>
          ) : null}
          <h1>{article.title}</h1>
        </header>

        {/* Key facts sit ABOVE the prose on a phone and beside it when there is
            room. On the source wiki this is a right-floating table that falls
            off the side of a narrow screen. */}
        {article.infobox ? (
          <aside className="ok-keyfacts ok-article__facts" aria-labelledby="keyfacts-heading">
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
