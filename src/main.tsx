import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { routeIdForPath } from './lib/routes';
import './styles/tokens.css';
import './styles/base.css';
import './styles/elements.css';

const root = document.getElementById('root');
if (root) {
  hydrateRoot(root, <StrictMode><App route={routeIdForPath(window.location.pathname)} /></StrictMode>);
}
