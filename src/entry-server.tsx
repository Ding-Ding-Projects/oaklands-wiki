import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, type AppProps } from './App';

export function render(route: AppProps['route'], article?: AppProps['article']): string {
  return renderToStaticMarkup(
    <StrictMode>
      <App route={route} article={article} />
    </StrictMode>,
  );
}
