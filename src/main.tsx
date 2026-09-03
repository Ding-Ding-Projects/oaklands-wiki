import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App, type AppProps } from './App';
import { Chrome } from './chrome/Chrome';
import './styles/tokens.css';
import './styles/base.css';
import './styles/elements.css';
import './styles/chrome.css';

/**
 * Two independent mounts, on purpose.
 *
 * `#ok-chrome` is an empty container rendered into client-side only, so every
 * page gets working settings, a command palette and notifications — including
 * the 1,063 article pages, whose bodies are prerendered static HTML that React
 * never owns and never re-renders.
 *
 * `#root` hydrates only where the page itself is interactive. Hydrating a
 * thousand static articles would ship a bundle to re-render markup that is
 * already correct, which is pure cost repeated a thousand times.
 */
declare global {
  interface Window {
    __PAGE_DATA__?: unknown;
    __PAGE_ROUTE__?: AppProps['route'];
  }
}

const chromeHost = document.getElementById('ok-chrome');
if (chromeHost) {
  createRoot(chromeHost).render(<StrictMode><Chrome /></StrictMode>);
}

const root = document.getElementById('root');
const route = window.__PAGE_ROUTE__;
const payload = window.__PAGE_DATA__;
if (root && route && payload) {
  const props = { route, [route]: payload } as unknown as AppProps;
  hydrateRoot(root, <StrictMode><App {...props} /></StrictMode>);
}
