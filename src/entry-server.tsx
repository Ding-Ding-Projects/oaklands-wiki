import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, type AppProps } from './App';

export { THEME_INLINE_SCRIPT } from './components/ThemeToggle';

const KEY: Record<string, keyof AppProps> = {
  home: 'home', article: 'article', category: 'category', browse: 'browse', compare: 'compare', docs: 'docs',
};

export function render(route: AppProps['route'], payload?: unknown): string {
  const props = { route } as Record<string, unknown>;
  const key = KEY[route];
  if (key) props[key] = payload;
  return renderToStaticMarkup(<StrictMode><App {...(props as AppProps)} /></StrictMode>);
}
