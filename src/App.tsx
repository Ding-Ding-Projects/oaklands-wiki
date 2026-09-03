import { Home } from './pages/Home';
import { About } from './pages/About';
import type { RouteId } from './lib/routes';

export function App({ route }: { route: RouteId }) {
  return route === 'about' ? <About /> : <Home />;
}
