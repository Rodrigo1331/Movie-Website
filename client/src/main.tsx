import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './styles/index.css';
import { ApiError } from './api/client';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { AddMoviePage } from './pages/AddMovie';
import { DashboardPage } from './pages/Dashboard';
import { EditMoviePage } from './pages/EditMovie';
import { LibraryPage } from './pages/Library';
import { MovieDetailPage } from './pages/MovieDetail';
import { NotFoundPage } from './pages/NotFound';
import { RoulettePage } from './pages/Roulette';
import { SectionsPage } from './pages/Sections';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors such as 404s
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'sections', element: <SectionsPage /> },
      { path: 'roulette', element: <RoulettePage /> },
      { path: 'movies/new', element: <AddMoviePage /> },
      { path: 'movies/:id', element: <MovieDetailPage /> },
      { path: 'movies/:id/edit', element: <EditMoviePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
