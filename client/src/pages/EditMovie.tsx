import { useNavigate, useParams } from 'react-router';
import type { Movie } from '@moviesite/shared';
import { useMovie, useUpdateMovie } from '../api/hooks';
import { Page } from '../components/Layout';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/ui';
import { MovieForm, type MovieFormValues } from '../features/movie-form/MovieForm';
import { formatRating } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

const toForm = (m: Movie): MovieFormValues => ({
  tmdbId: m.tmdbId,
  title: m.title,
  releaseDate: m.releaseDate ?? '',
  releaseYear: m.releaseYear ? String(m.releaseYear) : '',
  director: m.director ?? '',
  description: m.description ?? '',
  posterUrl: m.posterUrl ?? '',
  backdropUrl: m.backdropUrl ?? '',
  runtime: m.runtime ? String(m.runtime) : '',
  genres: m.genres,
  rating: m.rating === null ? null : Number(formatRating(m.rating)),
  review: m.review?.body ?? '',
  dateWatched: m.review?.dateWatched ?? '',
  sectionIds: m.sections.map((s) => s.id),
});

export function EditMoviePage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: movie, isLoading, error, refetch } = useMovie(id);
  const update = useUpdateMovie(id);
  useDocumentTitle(movie ? `Edit ${movie.title}` : 'Edit');

  if (isLoading) return <PageLoader />;
  if (error || !movie) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  return (
    <Page>
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">Editing</p>
        <h1 className="font-display text-4xl font-bold text-white">{movie.title}</h1>
      </header>
      <MovieForm
        key={movie.id}
        initial={toForm(movie)}
        submitLabel="Save changes"
        pending={update.isPending}
        onCancel={() => navigate(`/movies/${movie.id}`)}
        onSubmit={(input) => {
          // tmdbId is fixed once a movie is linked
          const { tmdbId: _tmdbId, ...changes } = input;
          update.mutate(changes, {
            onSuccess: () => {
              toast.success('Changes saved');
              navigate(`/movies/${movie.id}`, { replace: true });
            },
            onError: (e) => toast.error(e),
          });
        }}
      />
    </Page>
  );
}
