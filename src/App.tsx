import { Home, type HomeData } from './pages/Home';
import { About } from './pages/About';
import { Article, type ArticleRecord } from './pages/Article';
import { Category, type CategoryRecord } from './pages/Category';
import { Browse, type BrowseData } from './pages/Browse';
import { Compare, type CompareData } from './pages/Compare';
import { LogicLab } from './pages/LogicLab';
import { Docs, type DocsData } from './pages/Docs';
import { Search } from './pages/Search';
import { Money, type MoneyData } from './pages/Money';
import { FilePage, type FileRecord } from './pages/FilePage';

export type AppProps = {
  route: 'home' | 'about' | 'article' | 'category' | 'browse' | 'compare' | 'logic' | 'docs' | 'search' | 'money' | 'file';
  home?: HomeData;
  article?: ArticleRecord;
  category?: CategoryRecord;
  browse?: BrowseData;
  compare?: CompareData;
  docs?: DocsData;
  money?: MoneyData;
  file?: FileRecord;
};

export function App({ route, home, article, category, browse, compare, docs, money, file }: AppProps) {
  if (route === 'article' && article) return <Article article={article} />;
  if (route === 'category' && category) return <Category category={category} />;
  if (route === 'file' && file) return <FilePage file={file} />;
  if (route === 'browse' && browse) return <Browse data={browse} />;
  if (route === 'compare' && compare) return <Compare data={compare} />;
  if (route === 'money' && money) return <Money data={money} />;
  if (route === 'logic') return <LogicLab />;
  if (route === 'search') return <Search />;
  if (route === 'docs' && docs) return <Docs data={docs} />;
  if (route === 'about') return <About />;
  if (home) return <Home data={home} />;
  return <About />;
}
