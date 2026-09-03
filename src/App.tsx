import { Home } from './pages/Home';
import { About } from './pages/About';
import { Article, type ArticleRecord } from './pages/Article';
import type { RouteId } from './lib/routes';

export type AppProps = { route: RouteId | 'article'; article?: ArticleRecord };

export function App({ route, article }: AppProps) {
  if (route === 'article' && article) return <Article article={article} />;
  return route === 'about' ? <About /> : <Home />;
}
