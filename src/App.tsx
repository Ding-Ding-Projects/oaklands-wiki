import { Home, type HomeData } from './pages/Home';
import { About } from './pages/About';
import { Article, type ArticleRecord } from './pages/Article';
import { Category, type CategoryRecord } from './pages/Category';
import { Browse, type BrowseData } from './pages/Browse';

export type AppProps = {
  route: 'home' | 'about' | 'article' | 'category' | 'browse';
  home?: HomeData;
  article?: ArticleRecord;
  category?: CategoryRecord;
  browse?: BrowseData;
};

export function App({ route, home, article, category, browse }: AppProps) {
  if (route === 'article' && article) return <Article article={article} />;
  if (route === 'category' && category) return <Category category={category} />;
  if (route === 'browse' && browse) return <Browse data={browse} />;
  if (route === 'about') return <About />;
  if (home) return <Home data={home} />;
  return <About />;
}
