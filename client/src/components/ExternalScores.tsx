import { ArrowDown, ArrowUp, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import type { Movie } from '@moviesite/shared';
import { useExternalStatus, useRefreshExternal } from '../api/hooks';
import { formatGap, formatVotes } from '../lib/comparison';
import { cx, formatRating, timeAgo } from '../lib/format';
import { Spinner } from './ui';
import { useToast } from './Toast';

interface Source {
  name: string;
  /** Display value, e.g. "8.7" or "83%" */
  value: string | null;
  suffix: string;
  /** Score on a 0–10 scale, for the gap vs your rating */
  outOf10: number | null;
  detail: string | null;
  href: string | null;
}

function sources(movie: Movie): Source[] {
  const e = movie.externalRatings!;
  const q = encodeURIComponent(movie.title);
  return [
    {
      name: 'IMDb',
      value: e.imdb === null ? null : formatRating(e.imdb),
      suffix: '/10',
      outOf10: e.imdb,
      detail: formatVotes(e.imdbVotes),
      href: e.imdbId ? `https://www.imdb.com/title/${e.imdbId}/` : null,
    },
    {
      name: 'Rotten Tomatoes',
      value: e.rottenTomatoes === null ? null : `${e.rottenTomatoes}%`,
      suffix: '',
      outOf10: e.rottenTomatoes === null ? null : e.rottenTomatoes / 10,
      detail: 'Tomatometer',
      href: `https://www.rottentomatoes.com/search?search=${q}`,
    },
    {
      name: 'Metacritic',
      value: e.metacritic === null ? null : String(e.metacritic),
      suffix: '/100',
      outOf10: e.metacritic === null ? null : e.metacritic / 10,
      detail: 'Metascore',
      href: `https://www.metacritic.com/search/${q}/`,
    },
    {
      name: 'TMDB',
      value: e.tmdb === null ? null : formatRating(e.tmdb),
      suffix: '/10',
      outOf10: e.tmdb,
      detail: formatVotes(e.tmdbVotes),
      href: movie.tmdbId ? `https://www.themoviedb.org/movie/${movie.tmdbId}` : null,
    },
  ];
}

function Gap({ mine, theirs }: { mine: number | null; theirs: number | null }) {
  if (mine === null || theirs === null) return null;
  const gap = mine - theirs;
  const Icon = gap > 0.05 ? ArrowUp : gap < -0.05 ? ArrowDown : null;
  return (
    <span className="mt-2 inline-flex items-center gap-1 text-xs text-ink-400" title="Your rating minus theirs (on a 0–10 scale)">
      {Icon && <Icon className="size-3" />}
      You {formatGap(gap)}
    </span>
  );
}

/** "How others rated it": IMDb, Rotten Tomatoes, Metacritic and TMDB next to your own score. */
export function ExternalScores({ movie }: { movie: Movie }) {
  const { data: status } = useExternalStatus();
  const refresh = useRefreshExternal(movie.id);
  const toast = useToast();
  const configured = !!status && (status.omdb || status.tmdb);
  const e = movie.externalRatings;

  const onRefresh = () =>
    refresh.mutate(undefined, {
      onError: (err) => toast.error(err),
    });

  const refreshButton = configured && (
    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onRefresh} disabled={refresh.isPending}>
      {refresh.isPending ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
      {e ? 'Refresh' : 'Fetch scores'}
    </button>
  );

  const list = e ? sources(movie) : [];
  const anyScore = list.some((s) => s.value !== null);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="label mb-0 flex items-center gap-1.5">
          <Globe className="size-3.5" /> How others rated it
        </p>
        {refreshButton}
      </div>

      {!e ? (
        <p className="text-sm text-ink-400">
          {configured
            ? 'Scores from IMDb, Rotten Tomatoes and Metacritic haven’t been fetched for this film yet.'
            : status
              ? 'Add OMDB_API_KEY to the .env file and restart the server to compare your rating with IMDb, Rotten Tomatoes and Metacritic.'
              : 'Loading…'}
        </p>
      ) : !anyScore ? (
        <p className="text-sm text-ink-400">
          No outside scores were found for this film. If you added it manually, check that the title and release year match.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {list.map((s) => {
              const body = (
                <>
                  <span className="flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    {s.name}
                    {s.href && s.value !== null && <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold text-ink-100 tabular-nums">
                    {s.value ?? <span className="text-ink-600">–</span>}
                    {s.value !== null && s.suffix && <span className="ml-0.5 font-sans text-xs font-medium text-ink-500">{s.suffix}</span>}
                  </span>
                  {s.value !== null && s.detail && <span className="block text-[11px] text-ink-500">{s.detail}</span>}
                  <Gap mine={movie.rating} theirs={s.outOf10} />
                </>
              );
              const cls = cx('group block h-full rounded-xl border border-white/6 bg-ink-850 p-3', s.href && s.value !== null && 'transition-colors hover:border-gold-500/40');
              return (
                <li key={s.name}>
                  {s.href && s.value !== null ? (
                    <a href={s.href} target="_blank" rel="noreferrer noopener" className={cls}>
                      {body}
                    </a>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {movie.rating === null && <p className="mt-3 text-xs text-ink-500">Rate this film to see how your score compares.</p>}
        </>
      )}
      {e && <p className="mt-3 text-[11px] text-ink-500">Updated {timeAgo(e.fetchedAt)} · Scores via OMDb and TMDB</p>}
    </div>
  );
}
