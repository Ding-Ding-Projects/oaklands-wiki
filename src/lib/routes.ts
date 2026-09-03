import routeData from '../../data/routes.json';

export type RouteId = 'home' | 'about' | 'browse' | 'compare' | 'logic';
export type Route = { id: RouteId; path: string; title: string; description: string };

/** Every prerendered route. `scripts/prerender.mjs` reads this same JSON. */
export const routes = routeData as Route[];

const BASE = (import.meta.env?.BASE_URL ?? '/oaklands-wiki/').replace(/\/+$/, '');

/** Prefix an app path with the configured base so it works on a Pages sub-path. */
export function href(path: string): string {
  return path === '/' ? `${BASE}/` : `${BASE}${path}`;
}

export function routeIdForPath(pathname: string): RouteId {
  const stripped = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const normalised = (stripped.replace(/\/+$/, '') || '/');
  if (normalised === '/about') return 'about';
  if (normalised === '/browse') return 'browse';
  if (normalised === '/compare') return 'compare';
  if (normalised === '/logic') return 'logic';
  return 'home';
}
