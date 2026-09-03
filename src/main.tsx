import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App, type AppProps } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/elements.css';

/**
 * Only surfaces with real interaction hydrate. Article pages are static text and
 * ship no script at all, so a thousand of them cost a thousand HTML files and
 * nothing else. The theme control works everywhere via a separate inline script,
 * so it is never a button that does nothing.
 */
declare global {
  interface Window {
    __PAGE_DATA__?: unknown;
    __PAGE_ROUTE__?: AppProps['route'];
  }
}

const root = document.getElementById('root');
const route = window.__PAGE_ROUTE__;
const payload = window.__PAGE_DATA__;

if (root && route && payload) {
  const props = { route, [route]: payload } as unknown as AppProps;
  hydrateRoot(root, <StrictMode><App {...props} /></StrictMode>);
}
