import { Home } from './pages/Home';
import { About } from './pages/About';
import { Article, type ArticleRecord } from './pages/Article';
import { Category, type CategoryRecord } from './pages/Category';
import type { RouteId } from './lib/routes';

export type AppProps = {
  route: RouteId | 'article' | 'category';
  article?: ArticleRecord;
  category?: CategoryRecord;
};

export function App({ route, article, category }: AppProps) {
  if (route === 'article' && article) return <Article article={article} />;
  if (route === 'category' && category) return <Category category={category} />;
  return route === 'about' ? <About /> : <Home />;
}
