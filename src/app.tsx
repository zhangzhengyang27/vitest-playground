import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Welcome from './pages/vitest-learn';
import Chapter from './pages/vitest-learn/chapter';

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
    path: '*',
    element: <Welcome />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
