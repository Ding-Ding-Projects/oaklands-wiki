import routeData from '../../data/routes.json';

export type RouteId = 'home' | 'about' | 'browse' | 'compare' | 'logic' | 'docs' | 'search' | 'money' | 'file';
export type Route = { id: RouteId; path: string; title: string; description: string };

/** Every prerendered route. `scripts/prerender.mjs` reads this same JSON. */
export const routes = routeData as Route[];

const BASE = (import.meta.env?.BASE_URL ?? '/oaklands-wiki/').replace(/\/+$/, '');

/** Prefix an app path with the configured base so it works on a Pages sub-path. */
export function href(path: string): string {
  return path === '/' ? `${BASE}/` : `${BASE}${path}`;
}

/**
 * A file served from the site root rather than bundled.
 *
 * The search index is fetched at runtime instead of imported, because
 * bundling half a megabyte of index into every page would make a thousand
 * article pages pay for a search most visits never run.
 */
export function asset(name: string): string {
  return `${BASE}/${name.startsWith('/') ? name.slice(1) : name}`;
}

export function routeIdForPath(pathname: string): RouteId {
  const stripped = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const normalised = (stripped.replace(/\/+$/, '') || '/');
  if (normalised === '/about') return 'about';
  if (normalised === '/browse') return 'browse';
  if (normalised === '/compare') return 'compare';
  if (normalised === '/logic') return 'logic';
  if (normalised === '/docs') return 'docs';
  if (normalised === '/search') return 'search';
  if (normalised === '/money') return 'money';
  return 'home';
}
