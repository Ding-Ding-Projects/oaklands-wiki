import { Shell } from '../components/Shell';
import { href } from '../lib/routes';
import { Thumb } from '../components/Thumb';

export type FileRecord = {
  name: string;
  slug: string;
  media: { file: string; width: number | null; height: number | null } | null;
  usedBy: { title: string; slug: string }[];
};

/**
 * A page for one archived file.
 *
 * The source wiki gives every file a page, and 891 links across the corpus point
 * at one. Without these they were the largest remaining group of links that went
 * nowhere — a reader clicking an image caption got plain text and no way to see
 * the picture any larger or find what else used it.
 */
export function FilePage({ file }: { file: FileRecord }) {
  return (
    <Shell current="file">
      <article className="ok-filepage">
        <header className="ok-article__head">
          <p className="ok-eyebrow">File</p>
          <h1>{file.name}</h1>
        </header>

        {file.media ? (
          <figure className="ok-filepage__figure">
            <Thumb className="ok-filepage__art" hero={file.media} alt={file.name} />
            <figcaption>
              {file.media.width && file.media.height
                ? `Archived at ${file.media.width}×${file.media.height}.`
                : 'Archived.'}{' '}
              This is the display-size copy this site holds, not the source's original.
            </figcaption>
          </figure>
        ) : (
          <p className="ok-empty">
            The wiki references this file, but it is not archived here. Nothing is shown rather than
            a broken image — a gap in the archive and a fault in the site deserve to look different.
          </p>
        )}

        <section>
          <h2>Used by</h2>
          {file.usedBy.length === 0 ? (
            <p className="ok-muted">
              No archived article links to this file. It is reachable because something in the corpus
              referenced it, which is not the same as an article using it.
            </p>
          ) : (
            <ul className="ok-rows">
              {file.usedBy.map((article) => (
                <li key={article.slug}>
                  <a className="ok-row" href={href(`/wiki/${article.slug}/`)}>
                    <span className="ok-row__body">
                      <span className="ok-row__name">{article.title}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </Shell>
  );
}
