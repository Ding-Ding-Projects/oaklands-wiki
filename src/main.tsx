import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { routeIdForPath } from './lib/routes';
import './styles/tokens.css';
import './styles/base.css';
import './styles/elements.css';

/**
 * Only surfaces with real interaction are hydrated. Article pages are static
 * text and ship no script at all, so a thousand of them cost a thousand HTML
 * files and nothing else.
 */
declare const __PAGE_DATA__: unknown;

const root = document.getElementById('root');
if (root) {
  const payload = typeof __PAGE_DATA__ === 'undefined' ? null : __PAGE_DATA__;
  const path = window.location.pathname;
  if (payload && /\/category\//.test(path)) {
    hydrateRoot(root, <StrictMode><App route="category" category={payload as never} /></StrictMode>);
  } else {
    hydrateRoot(root, <StrictMode><App route={routeIdForPath(path)} /></StrictMode>);
  }
}
