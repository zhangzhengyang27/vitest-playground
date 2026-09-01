import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Welcome from './pages/vitest-learn';
import Chapter from './pages/vitest-learn/chapter';
import ProgressPage from './pages/vitest-learn/progressPage';
import { ThemeProvider } from './theme';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Welcome />,
  },
  {
    path: '/vitest-learn/:chapterKey',
    element: <Chapter />,
  },
  {
    path: '/vitest-learn/:chapterKey/:lessonKey',
    element: <Chapter />,
  },
  {
    path: '/progress',
    element: <ProgressPage />,
  },
  {
    path: '*',
    element: <Welcome />,
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
