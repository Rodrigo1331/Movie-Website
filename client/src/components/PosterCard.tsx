import { Link } from 'react-router';
import type { Movie } from '@moviesite/shared';
import { cx } from '../lib/format';
import { Poster } from './Poster';
import { RatingBadge } from './Rating';

export function PosterCard({ movie, index = 0, className }: { movie: Movie; index?: number; className?: string }) {
  return (
    <Link
      to={`/movies/${movie.id}`}
      className={cx('group block animate-fade-up focus-visible:outline-none', className)}
      style={{ animationDelay: `${Math.min(index, 18) * 35}ms` }}
    >
      <div
        className="relative overflow-hidden rounded-xl shadow-lg ring-1 shadow-black/40 ring-white/6 transition-all duration-300
          group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-gold-500/40
          group-focus-visible:ring-2 group-focus-visible:ring-gold-500"
      >
        <Poster src={movie.posterUrl} title={movie.title} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          {movie.genres.length > 0 && <p className="line-clamp-1 text-[11px] font-medium text-ink-200">{movie.genres.slice(0, 3).join(' · ')}</p>}
          {movie.director && <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-400">{movie.director}</p>}
        </div>
        <RatingBadge score={movie.rating} className="absolute top-2 right-2" />
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-ink-100 transition-colors group-hover:text-gold-400">{movie.title}</h3>
        <p className="text-xs text-ink-500">{movie.releaseYear ?? '—'}</p>
      </div>
    </Link>
  );
}

export function PosterCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[2/3] rounded-xl" />
      <div className="skeleton mt-2.5 h-4 w-3/4 rounded" />
      <div className="skeleton mt-1.5 h-3 w-1/4 rounded" />
    </div>
  );
}

export const posterGridClass = 'grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
