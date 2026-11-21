import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, CircleCheck, Info, PenLine, Search } from 'lucide-react';
import type { MovieInput, TmdbMovieDetails } from '@moviesite/shared';
import { ApiError } from '../api/client';
import { useCreateMovie, useTmdbDetails, useTmdbStatus } from '../api/hooks';
import { Page } from '../components/Layout';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/ui';
import { TmdbSearch } from '../features/add-movie/TmdbSearch';
import { emptyMovieForm, MovieForm, type MovieFormValues } from '../features/movie-form/MovieForm';
import { cx } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

type Mode = 'search' | 'manual';

function fromTmdb(d: TmdbMovieDetails, sectionIds: number[]): MovieFormValues {
  return {
    ...emptyMovieForm(),
    tmdbId: d.tmdbId,
    title: d.title,
    releaseDate: d.releaseDate ?? '',
    releaseYear: d.releaseYear ? String(d.releaseYear) : '',
    director: d.director ?? '',
    description: d.description ?? '',
    posterUrl: d.posterUrl ?? '',
    backdropUrl: d.backdropUrl ?? '',
    runtime: d.runtime ? String(d.runtime) : '',
    genres: d.genres,
    sectionIds,
  };
}

export function AddMoviePage() {
  useDocumentTitle('Add movie');
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const presetSection = Number(params.get('section'));
  const initialSections = Number.isInteger(presetSection) && presetSection > 0 ? [presetSection] : [];

  const status = useTmdbStatus();
  const [mode, setMode] = useState<Mode | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const details = useTmdbDetails(pickedId);
  const create = useCreateMovie();

  if (status.isLoading) return <PageLoader />;
  const configured = status.data?.configured ?? false;
  const activeMode: Mode = mode ?? (configured ? 'search' : 'manual');

  const submit = (input: MovieInput) =>
    create.mutate(input, {
      onSuccess: (movie) => {
        toast.success(`Added “${movie.title}” to your library`);
        navigate(`/movies/${movie.id}`, { replace: true });
      },
      onError: (e) => {
        const existing = e instanceof ApiError && e.status === 409 ? (e.details as { movieId?: number })?.movieId : undefined;
        if (existing) {
          toast.error('That movie is already in your library');
          navigate(`/movies/${existing}`);
        } else toast.error(e);
      },
    });

  return (
    <Page>
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">New entry</p>
        <h1 className="font-display text-4xl font-bold text-white">Add a movie</h1>
      </header>

      {pickedId === null && (
        <div className="mb-8 inline-flex rounded-xl border border-white/8 bg-ink-900 p-1">
          <ModeTab active={activeMode === 'search'} onClick={() => setMode('search')} icon={<Search className="size-4" />}>
            Search TMDB
          </ModeTab>
          <ModeTab active={activeMode === 'manual'} onClick={() => setMode('manual')} icon={<PenLine className="size-4" />}>
            Enter manually
          </ModeTab>
        </div>
      )}

      {activeMode === 'search' && !configured && (
        <div className="panel flex gap-4 border-gold-500/20 p-5 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-gold-500" />
          <div className="space-y-2 text-ink-300">
            <p className="font-semibold text-ink-100">TMDB search isn’t configured</p>
            <p>
              Create a free account at themoviedb.org, copy your <em>API Read Access Token</em> from Settings → API, and put it in the
              <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-gold-300">.env</code> file at the project root as
              <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-gold-300">TMDB_API_TOKEN=…</code>. Then restart the server.
            </p>
            <p>You can still add movies manually in the meantime.</p>
          </div>
        </div>
      )}

      {activeMode === 'search' && configured && pickedId === null && <TmdbSearch onPick={(r) => setPickedId(r.tmdbId)} />}

      {activeMode === 'search' && pickedId !== null && (
        <div className="animate-fade-in">
          <button className="btn-ghost -ml-3 mb-6 px-3" onClick={() => setPickedId(null)}>
            <ArrowLeft className="size-4" /> Choose a different film
          </button>
          {details.isLoading ? (
            <PageLoader />
          ) : details.isError ? (
            <ErrorState error={details.error} onRetry={() => details.refetch()} />
          ) : details.data?.inLibraryId ? (
            <div className="panel flex items-center gap-4 p-6">
              <CircleCheck className="size-6 text-emerald-400" />
              <p className="flex-1 text-ink-200">“{details.data.title}” is already in your library.</p>
              <Link to={`/movies/${details.data.inLibraryId}`} className="btn-primary">
                Open it
              </Link>
            </div>
          ) : details.data ? (
            <MovieForm
              key={details.data.tmdbId}
              initial={fromTmdb(details.data, initialSections)}
              submitLabel="Add to library"
              pending={create.isPending}
              onSubmit={submit}
              onCancel={() => setPickedId(null)}
              detailsCollapsed
            />
          ) : null}
        </div>
      )}

      {activeMode === 'manual' && (
        <MovieForm
          initial={{ ...emptyMovieForm(), sectionIds: initialSections }}
          submitLabel="Add to library"
          pending={create.isPending}
          onSubmit={submit}
          onCancel={() => navigate(-1)}
        />
      )}
    </Page>
  );
}

function ModeTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
        active ? 'bg-white/10 text-white shadow' : 'text-ink-400 hover:text-ink-200',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
