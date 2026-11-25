import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Calendar, Clapperboard, Clock, EyeOff, PenLine, Pencil, Trash2 } from 'lucide-react';
import { ApiError } from '../api/client';
import { useDeleteMovie, useDeleteReview, useMovie, useSetMovieSections } from '../api/hooks';
import { Page } from '../components/Layout';
import { ConfirmDialog } from '../components/Modal';
import { Poster } from '../components/Poster';
import { RatingRing } from '../components/Rating';
import { AspectBreakdown } from '../components/AspectRatings';
import { ExternalScores } from '../components/ExternalScores';
import { SectionPicker } from '../components/SectionPicker';
import { SpoilerText } from '../components/SpoilerText';
import { hasSpoilers } from '../lib/spoilers';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader } from '../components/ui';
import { formatDate, formatRuntime, timeAgo } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

export function MovieDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: movie, isLoading, error, refetch } = useMovie(id);
  const setSections = useSetMovieSections(id);
  const deleteMovie = useDeleteMovie();
  const deleteReview = useDeleteReview(id);
  const [confirm, setConfirm] = useState<'movie' | 'review' | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  useDocumentTitle(movie?.title);

  if (isLoading) return <PageLoader />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Page>
        <EmptyState icon={<Clapperboard />} title="Movie not found" action={<Link to="/library" className="btn-secondary">Back to library</Link>}>
          It may have been removed from your library.
        </EmptyState>
      </Page>
    );
  }
  if (error || !movie) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  const backdrop = movie.backdropUrl ?? movie.posterUrl;
  const runtime = formatRuntime(movie.runtime);
  const hasReview = movie.rating !== null || !!movie.review;
  const spoilers = hasSpoilers(movie.review?.body ?? '');

  return (
    <div className="relative isolate">
      {/* Backdrop */}
      <div className="grain absolute inset-x-0 top-0 -z-10 h-[34rem] overflow-hidden sm:h-[40rem]">
        {backdrop && (
          <img src={backdrop} alt="" aria-hidden className={`size-full animate-fade-in object-cover object-top ${movie.backdropUrl ? 'opacity-50' : 'scale-125 opacity-40 blur-3xl'}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/30 via-ink-950/70 to-ink-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/80 to-transparent" />
      </div>

      <Page className="pt-6">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/library'))} className="btn-ghost -ml-3 mb-6 px-3 text-ink-300">
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="grid animate-fade-up gap-8 md:grid-cols-[260px_1fr] lg:gap-12">
          <div className="mx-auto w-52 md:mx-0 md:w-full">
            <Poster src={movie.posterUrl} title={movie.title} eager className="rounded-2xl shadow-2xl ring-1 shadow-black/80 ring-white/10" />
          </div>

          <div className="min-w-0 pt-2">
            <p className="text-sm font-medium tracking-wide text-gold-400">{movie.releaseYear ?? 'Year unknown'}</p>
            <h1 className="mt-1 font-display text-4xl leading-tight font-bold text-white sm:text-5xl lg:text-6xl">{movie.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-300">
              {movie.director && (
                <span>
                  Directed by <span className="font-semibold text-ink-100">{movie.director}</span>
                </span>
              )}
              {movie.releaseDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4 text-ink-500" /> {formatDate(movie.releaseDate)}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 text-ink-500" /> {runtime}
                </span>
              )}
            </div>

            {movie.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {movie.genres.map((g) => (
                  <Link key={g} to={`/library?genre=${encodeURIComponent(g)}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-200 transition-colors hover:border-gold-500/50 hover:text-gold-300">
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <RatingRing score={movie.rating} size={104} />
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Link to={`/movies/${movie.id}/edit`} className="btn-secondary">
                  <Pencil className="size-4" /> Edit
                </Link>
                <button className="btn-ghost text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setConfirm('movie')}>
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            </div>

            {Object.keys(movie.aspectRatings).length > 0 && (
              <div className="mt-6 max-w-md">
                <AspectBreakdown ratings={movie.aspectRatings} />
              </div>
            )}

            <div className="mt-6">
              <ExternalScores movie={movie} />
            </div>

            <div className="mt-8">
              <p className="label">Sections</p>
              <SectionPicker
                value={movie.sections.map((s) => s.id)}
                disabled={setSections.isPending}
                onChange={(ids) => setSections.mutate(ids, { onError: (e) => toast.error(e) })}
              />
            </div>

            {movie.description && (
              <div className="mt-8">
                <p className="label">Synopsis</p>
                <p className="max-w-3xl leading-relaxed text-ink-300">{movie.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Review */}
        <section className="mt-12 animate-fade-up [animation-delay:120ms]">
          <div className="panel relative overflow-hidden p-6 sm:p-8">
            <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-gold-400 to-gold-600" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex flex-wrap items-center gap-3 font-display text-2xl font-semibold text-ink-100">
                  My review
                  {spoilers && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-sans text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
                      Contains spoilers
                    </span>
                  )}
                </h2>
                {movie.review?.dateWatched && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-400">
                    <Calendar className="size-4" /> Watched {formatDate(movie.review.dateWatched)}
                  </p>
                )}
              </div>
              {hasReview && (
                <div className="flex gap-1">
                  <Link to={`/movies/${movie.id}/edit`} className="btn-ghost px-3 text-xs">
                    <PenLine className="size-3.5" /> Edit review
                  </Link>
                  <button className="btn-ghost px-3 text-xs text-ink-400 hover:text-red-300" onClick={() => setConfirm('review')}>
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>

            {movie.review?.body ? (
              <>
                {spoilers && (
                  <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
                    <EyeOff className="size-4 shrink-0" />
                    <span className="flex-1">Spoilers are hidden. Click a hidden passage to reveal it.</span>
                    <button className="cursor-pointer font-semibold text-amber-200 hover:text-white" onClick={() => setRevealAll((r) => !r)}>
                      {revealAll ? 'Hide all' : 'Reveal all'}
                    </button>
                  </div>
                )}
                <SpoilerText
                  key={String(revealAll)}
                  text={movie.review.body}
                  revealAll={revealAll}
                  className="mt-5 max-w-3xl font-display text-lg leading-relaxed text-ink-200"
                />
              </>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <p className="text-ink-400">{movie.rating !== null ? 'You rated this film but haven’t written anything yet.' : 'No review yet.'}</p>
                <Link to={`/movies/${movie.id}/edit`} className="btn-primary">
                  <PenLine className="size-4" /> Write a review
                </Link>
              </div>
            )}

            {movie.lastReviewedAt && <p className="mt-6 text-xs text-ink-500">Last updated {timeAgo(movie.lastReviewedAt)}</p>}
          </div>
        </section>
      </Page>

      <ConfirmDialog
        open={confirm === 'movie'}
        title={`Delete “${movie.title}”?`}
        message="This removes the movie, your rating and review, and its section memberships. This cannot be undone."
        pending={deleteMovie.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          deleteMovie.mutate(movie.id, {
            onSuccess: () => {
              toast.success(`Deleted “${movie.title}”`);
              navigate('/library', { replace: true });
            },
            onError: (e) => toast.error(e),
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'review'}
        title="Remove your review?"
        message="Your rating, written review and watch date will be removed. The movie stays in your library."
        confirmLabel="Remove review"
        pending={deleteReview.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          deleteReview.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null);
              toast.success('Review removed');
            },
            onError: (e) => toast.error(e),
          })
        }
      />
    </div>
  );
}
