import { Home, type HomeData } from './pages/Home';
import { About } from './pages/About';
import { Article, type ArticleRecord } from './pages/Article';
import { Category, type CategoryRecord } from './pages/Category';
import { Browse, type BrowseData } from './pages/Browse';
import { Compare, type CompareData } from './pages/Compare';
import { LogicLab } from './pages/LogicLab';
import { Docs, type DocsData } from './pages/Docs';

export type AppProps = {
  route: 'home' | 'about' | 'article' | 'category' | 'browse' | 'compare' | 'logic' | 'docs';
  home?: HomeData;
  article?: ArticleRecord;
  category?: CategoryRecord;
  browse?: BrowseData;
  compare?: CompareData;
  docs?: DocsData;
};

export function App({ route, home, article, category, browse, compare, docs }: AppProps) {
  if (route === 'article' && article) return <Article article={article} />;
  if (route === 'category' && category) return <Category category={category} />;
  if (route === 'browse' && browse) return <Browse data={browse} />;
  if (route === 'compare' && compare) return <Compare data={compare} />;
  if (route === 'logic') return <LogicLab />;
  if (route === 'docs' && docs) return <Docs data={docs} />;
  if (route === 'about') return <About />;
  if (home) return <Home data={home} />;
  return <About />;
}
