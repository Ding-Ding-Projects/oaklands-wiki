import { href } from '../lib/routes';

/**
 * The search that is on every page.
 *
 * Deliberately a plain `<form method="get">` rather than a scripted field. Most
 * of this site is prerendered static HTML that never hydrates — a thousand
 * article pages carry no React at all — so a search that needed JavaScript to
 * submit would be a decorative box on the majority of the site. A form submits
 * to /search/ with the query in `q`, which works with the bundle, without it,
 * and from a keyboard with nothing but Enter.
 *
 * The results page is where the real search lives: filters, the anchored regex
 * builder, and every kind of page in one index.
 */
export function MasterSearch({ initialQuery = '' }: { initialQuery?: string }) {
  return (
    <form className="ok-mastersearch" action={href('/search/')} method="get" role="search">
      <label className="ok-mastersearch__label" htmlFor="ok-master-q">
        Search this site
      </label>
      <div className="ok-mastersearch__field">
        <input
          id="ok-master-q"
          className="ok-mastersearch__input"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Search 2,051 pages…"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="ok-mastersearch__go">
          <span aria-hidden="true">⏎</span>
          <span className="ok-visually-hidden">Search</span>
        </button>
      </div>
    </form>
  );
}
