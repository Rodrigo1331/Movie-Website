import { Link } from 'react-router';
import { ArrowRight, Calendar, Clock, Film, PenLine, Plus, Popcorn, Star, Tags } from 'lucide-react';
import type { Movie, Stats } from '@moviesite/shared';
import { useStats } from '../api/hooks';
import { Page } from '../components/Layout';
import { Poster } from '../components/Poster';
import { PosterRow } from '../components/PosterRow';
import { RatingRing } from '../components/Rating';
import { SpoilerText } from '../components/SpoilerText';
import { stripSpoilers } from '../lib/spoilers';
import { EmptyState, ErrorState, PageLoader } from '../components/ui';
import { formatRating, formatRuntime, ratingColor } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { data: stats, isLoading, error, refetch } = useStats();

  if (isLoading) return <PageLoader />;
  if (error || !stats) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  if (stats.totalMovies === 0) {
    return (
      <Page>
        <div className="py-10">
          <EmptyState
            icon={<Popcorn />}
            title="Your film diary starts here"
            action={
              <Link to="/movies/new" className="btn-primary">
                <Plus className="size-4" /> Add your first movie
              </Link>
            }
          >
            Search TMDB or enter a film manually, give it a score out of 10, write what you thought and file it into your sections.
          </EmptyState>
        </div>
      </Page>
    );
  }

  const featured = stats.highestRated[0] ?? stats.recentlyReviewed[0];

  return (
    <>
      {featured && <Hero movie={featured} />}
      <Page className="space-y-14 pt-6 sm:pt-8">
        <StatTiles stats={stats} />

        {stats.recentlyReviewed.length > 0 && (
          <PosterRow
            eyebrow="Latest"
            title="Recently reviewed"
            movies={stats.recentlyReviewed}
            action={<Link to="/library?sort=reviewed" className="btn-ghost px-2 text-xs">See all</Link>}
          />
        )}
        {stats.highestRated.length > 0 && (
          <PosterRow
            eyebrow="Your canon"
            title="Highest rated"
            movies={stats.highestRated}
            action={<Link to="/library?sort=rating" className="btn-ghost px-2 text-xs">See all</Link>}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Distribution stats={stats} />
          <RankList title="Top genres" icon={<Tags className="size-4" />} items={stats.topGenres} link={(n) => `/library?genre=${encodeURIComponent(n)}`} />
          <RankList title="Most-watched directors" icon={<Film className="size-4" />} items={stats.topDirectors} link={(n) => `/library?q=${encodeURIComponent(n)}`} />
        </div>
      </Page>
    </>
  );
}

function Hero({ movie }: { movie: Movie }) {
  const backdrop = movie.backdropUrl ?? movie.posterUrl;
  return (
    <section className="grain relative isolate overflow-hidden">
      {backdrop && (
        <img src={backdrop} alt="" aria-hidden className={`absolute inset-0 -z-20 size-full object-cover object-top ${movie.backdropUrl ? '' : 'scale-110 blur-2xl'}`} />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />
      <div className="mx-auto flex max-w-7xl animate-fade-up items-end gap-8 px-4 pt-20 pb-12 sm:px-6 sm:pt-32 sm:pb-16">
        <Link to={`/movies/${movie.id}`} className="hidden w-44 shrink-0 sm:block">
          <Poster src={movie.posterUrl} title={movie.title} eager className="rounded-xl shadow-2xl ring-1 shadow-black ring-white/10" />
        </Link>
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-gold-300 uppercase">
            <Star className="size-3.5 fill-current" /> Top of your list
          </p>
          <h1 className="font-display text-4xl leading-[1.05] font-bold text-white sm:text-6xl">{movie.title}</h1>
          <p className="mt-3 text-sm text-ink-300">{[movie.releaseYear, movie.director, movie.genres.slice(0, 3).join(', ')].filter(Boolean).join('  ·  ')}</p>
          {movie.review?.body && stripSpoilers(movie.review.body, '').trim() && (
            <SpoilerText text={`“${movie.review.body.trim()}”`} className="mt-4 line-clamp-3 text-base leading-relaxed text-ink-200 italic" />
          )}
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <RatingRing score={movie.rating} size={64} showLabel={false} />
            <Link to={`/movies/${movie.id}`} className="btn-primary">
              Read review <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatTiles({ stats }: { stats: Stats }) {
  const runtime = formatRuntime(stats.totalRuntimeMinutes);
  const tiles = [
    { label: 'Movies in library', value: stats.totalMovies.toLocaleString(), sub: `${stats.ratedMovies} rated`, icon: Film },
    {
      label: 'Average rating',
      value: stats.averageRating === null ? '–' : stats.averageRating.toFixed(2),
      sub: stats.highestRating === null ? 'No ratings yet' : `Highest ${formatRating(stats.highestRating)}`,
      icon: Star,
      color: ratingColor(stats.averageRating),
    },
    { label: 'Reviews written', value: stats.writtenReviews.toLocaleString(), sub: `${stats.genreCount} genres explored`, icon: PenLine },
    { label: 'Watched this year', value: stats.watchedThisYear.toLocaleString(), sub: runtime ? `${runtime} of film in library` : 'Log a watch date', icon: runtime ? Clock : Calendar },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {tiles.map(({ label, value, sub, icon: Icon, color }, i) => (
        <div key={label} className="panel group relative animate-fade-up overflow-hidden p-4 sm:p-5" style={{ animationDelay: `${i * 60}ms` }}>
          <Icon className="absolute -top-2 -right-2 size-20 text-white/[0.03] transition-transform duration-500 group-hover:scale-110" />
          <p className="text-xs font-medium text-ink-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-white tabular-nums sm:text-4xl" style={color ? { color } : undefined}>
            {value}
          </p>
          <p className="mt-1 text-xs text-ink-500">{sub}</p>
        </div>
      ))}
    </div>
  );
}

function Distribution({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.ratingDistribution.map((b) => b.count));
  return (
    <div className="panel p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
        <Star className="size-4 text-gold-500" /> Rating distribution
      </h3>
      <div className="mt-5 flex h-36 items-end gap-1.5" role="img" aria-label="Number of movies per rating">
        {stats.ratingDistribution.map((b) => (
          <div key={b.bucket} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] text-ink-400 tabular-nums opacity-0 transition-opacity group-hover:opacity-100">{b.count}</span>
            <div
              className="w-full rounded-t-sm transition-all duration-700"
              style={{ height: `${Math.max((b.count / max) * 100, b.count ? 6 : 2)}%`, background: b.count ? ratingColor(b.bucket + 0.5) : 'var(--color-ink-700)' }}
              title={`${b.count} movie${b.count === 1 ? '' : 's'} rated ${b.bucket}${b.bucket < 10 ? `–${b.bucket}.9` : ''}`}
            />
            <span className="text-[10px] text-ink-500 tabular-nums">{b.bucket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankList(props: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; count: number; averageRating: number | null }[];
  link: (name: string) => string;
}) {
  const max = Math.max(1, ...props.items.map((i) => i.count));
  return (
    <div className="panel p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
        <span className="text-gold-500">{props.icon}</span> {props.title}
      </h3>
      {props.items.length === 0 ? (
        <p className="mt-5 text-sm text-ink-500">Nothing to show yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {props.items.map((item) => (
            <li key={item.name}>
              <Link to={props.link(item.name)} className="group block">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink-200 group-hover:text-gold-400">{item.name}</span>
                  <span className="shrink-0 text-xs text-ink-500 tabular-nums">
                    {item.count} {item.averageRating !== null && <span style={{ color: ratingColor(item.averageRating) }}>· ★ {formatRating(item.averageRating)}</span>}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-gold-500/60 transition-all duration-700" style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
