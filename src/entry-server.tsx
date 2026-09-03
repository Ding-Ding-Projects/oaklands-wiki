import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, type AppProps } from './App';

export function render(route: AppProps['route'], payload?: AppProps['article'] | AppProps['category']): string {
  const props: AppProps =
    route === 'article'
      ? { route, article: payload as AppProps['article'] }
      : route === 'category'
        ? { route, category: payload as AppProps['category'] }
        : { route };
  return renderToStaticMarkup(<StrictMode><App {...props} /></StrictMode>);
}
