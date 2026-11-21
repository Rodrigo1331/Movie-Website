import { useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, Search } from 'lucide-react';
import type { TmdbSearchResult } from '@moviesite/shared';
import { useTmdbSearch } from '../../api/hooks';
import { Poster } from '../../components/Poster';
import { EmptyState, ErrorState, Spinner } from '../../components/ui';
import { useDebouncedValue } from '../../lib/hooks';

export function TmdbSearch({ onPick }: { onPick: (result: TmdbSearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(query.trim(), 350);
  const search = useTmdbSearch(debounced, page, true);
  const data = search.data;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" />
        <input
          autoFocus
          className="field rounded-xl py-4 pr-12 pl-12 text-base"
          placeholder="Search TMDB for a movie title…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        {search.isFetching && <Spinner className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-gold-500" />}
      </div>

      <div className="mt-8">
        {debounced.length < 2 ? (
          <p className="text-center text-sm text-ink-500">Type at least two characters to search.</p>
        ) : search.isError ? (
          <ErrorState error={search.error} onRetry={() => search.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState icon={<Search />} title="No matches">
            Nothing on TMDB matched “{debounced}”. Try another spelling, or add it manually.
          </EmptyState>
        ) : data ? (
          <>
            <p className="mb-4 text-xs text-ink-500">{data.totalResults.toLocaleString()} results</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {data.results.map((r, i) => (
                <li key={r.tmdbId} className="animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
                  {r.inLibraryId ? (
                    <Link to={`/movies/${r.inLibraryId}`} className="group block" title="Already in your library">
                      <ResultCard result={r} inLibrary />
                    </Link>
                  ) : (
                    <button type="button" className="group block w-full cursor-pointer text-left" onClick={() => onPick(r)}>
                      <ResultCard result={r} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 text-sm">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="text-ink-400 tabular-nums">
                  Page {data.page} of {Math.min(data.totalPages, 500)}
                </span>
                <button className="btn-secondary" disabled={page >= Math.min(data.totalPages, 500)} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center py-10 text-ink-500">
            <Spinner className="size-6" />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, inLibrary }: { result: TmdbSearchResult; inLibrary?: boolean }) {
  return (
    <>
      <div className="relative overflow-hidden rounded-xl ring-1 ring-white/6 transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-gold-500/50">
        <Poster src={result.posterUrl} title={result.title} />
        {inLibrary ? (
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-emerald-500/90 py-1 text-[11px] font-bold text-night">
            <CircleCheck className="size-3.5" /> In library
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-snow opacity-0 transition-opacity group-hover:opacity-100">
            Select
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink-100">{result.title}</p>
      <p className="text-xs text-ink-500">{result.releaseYear ?? 'Unknown year'}</p>
    </>
  );
}
