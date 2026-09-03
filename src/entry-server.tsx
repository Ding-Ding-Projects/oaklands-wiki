import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';
import type { RouteId } from './lib/routes';

export function render(route: RouteId): string {
  return renderToStaticMarkup(<StrictMode><App route={route} /></StrictMode>);
}
