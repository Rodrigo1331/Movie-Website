import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Plus, Search, SearchX, X } from 'lucide-react';
import type { MovieListQuery, SortField, SortOrder } from '@moviesite/shared';
import { useFacets, useMovies, useSections } from '../api/hooks';
import { Page } from '../components/Layout';
import { PosterCard, PosterCardSkeleton, posterGridClass } from '../components/PosterCard';
import { EmptyState, ErrorState } from '../components/ui';
import { cx } from '../lib/format';
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks';

const SORTS: { value: SortField; label: string }[] = [
  { value: 'added', label: 'Date added' },
  { value: 'reviewed', label: 'Recently reviewed' },
  { value: 'rating', label: 'Rating' },
  { value: 'release', label: 'Release date' },
  { value: 'title', label: 'Title' },
];
const RATING_FILTERS = [9, 8, 7, 6, 5];

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search, 250);

  const sort = (params.get('sort') as SortField | null) ?? 'added';
  const defaultOrder: SortOrder = sort === 'title' ? 'asc' : 'desc';
  const order = (params.get('order') as SortOrder | null) ?? defaultOrder;
  const sectionId = params.get('section') ? Number(params.get('section')) : undefined;

  const query: MovieListQuery = {
    q: params.get('q') || undefined,
    genre: params.get('genre') || undefined,
    year: params.get('year') ? Number(params.get('year')) : undefined,
    minRating: params.get('minRating') ? Number(params.get('minRating')) : undefined,
    section: sectionId,
    sort,
    order,
  };

  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
        return next;
      },
      { replace: true },
    );

  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    if (urlQ !== debouncedSearch.trim()) update({ q: debouncedSearch.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the input in sync when the URL changes from elsewhere (e.g. dashboard links)
  useEffect(() => {
    if (urlQ !== debouncedSearch.trim()) setSearch(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const movies = useMovies(query);
  const { data: facets } = useFacets();
  const { data: sections = [] } = useSections();
  const activeSection = sections.find((s) => s.id === sectionId);
  useDocumentTitle(activeSection?.name ?? 'Library');

  const hasFilters = !!(query.q || query.genre || query.year || query.minRating);
  const clearFilters = () => {
    setSearch('');
    update({ q: undefined, genre: undefined, year: undefined, minRating: undefined });
  };

  return (
    <Page>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">{activeSection ? 'Section' : 'Collection'}</p>
          <h1 className="font-display text-4xl font-bold text-white">{activeSection?.name ?? 'Library'}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {movies.data ? `${movies.data.length} ${movies.data.length === 1 ? 'film' : 'films'}` : ' '}
            {hasFilters && ' matching your filters'}
          </p>
        </div>
      </header>

      {/* Section tabs */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <SectionTab active={!sectionId} onClick={() => update({ section: undefined })}>All films</SectionTab>
        {sections.map((s) => (
          <SectionTab key={s.id} active={s.id === sectionId} onClick={() => update({ section: String(s.id) })}>
            {s.name}
            <span className="ml-1.5 text-[10px] opacity-60 tabular-nums">{s.movieCount}</span>
          </SectionTab>
        ))}
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-30 -mx-4 mb-8 border-y border-white/5 bg-ink-950/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" />
            <input className="field pl-9" placeholder="Search title or director…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by title" />
          </div>
          <select className="field w-auto" aria-label="Filter by genre" value={query.genre ?? ''} onChange={(e) => update({ genre: e.target.value || undefined })}>
            <option value="">All genres</option>
            {facets?.genres.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count})
              </option>
            ))}
          </select>
          <select className="field w-auto" aria-label="Filter by year" value={query.year ?? ''} onChange={(e) => update({ year: e.target.value || undefined })}>
            <option value="">Any year</option>
            {facets?.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select className="field w-auto" aria-label="Minimum rating" value={query.minRating ?? ''} onChange={(e) => update({ minRating: e.target.value || undefined })}>
            <option value="">Any rating</option>
            {RATING_FILTERS.map((r) => (
              <option key={r} value={r}>
                ★ {r}+
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <select className="field w-auto" aria-label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value, order: undefined })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary px-3"
              onClick={() => update({ order: order === 'asc' ? 'desc' : 'asc' })}
              aria-label={order === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'}
              title={order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {order === 'asc' ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
            </button>
          </div>
          {hasFilters && (
            <button className="btn-ghost px-3 text-xs" onClick={clearFilters}>
              <X className="size-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {movies.isError ? (
        <ErrorState error={movies.error} onRetry={() => movies.refetch()} />
      ) : movies.isLoading ? (
        <div className={posterGridClass}>
          {Array.from({ length: 12 }, (_, i) => (
            <PosterCardSkeleton key={i} />
          ))}
        </div>
      ) : movies.data!.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<SearchX />} title="No films match" action={<button className="btn-secondary" onClick={clearFilters}>Clear filters</button>}>
            Try a different search or loosen the filters.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<Plus />}
            title={activeSection ? `Nothing in ${activeSection.name} yet` : 'Your library is empty'}
            action={
              <Link to={activeSection ? `/movies/new?section=${activeSection.id}` : '/movies/new'} className="btn-primary">
                <Plus className="size-4" /> Add a movie
              </Link>
            }
          >
            {activeSection ? 'Add a film here, or assign sections from any movie’s page.' : 'Start by searching TMDB or adding a film manually.'}
          </EmptyState>
        )
      ) : (
        <div className={cx(posterGridClass, movies.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {movies.data!.map((m, i) => (
            <PosterCard key={m.id} movie={m} index={i} />
          ))}
        </div>
      )}
    </Page>
  );
}

function SectionTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all',
        active ? 'bg-white text-ink-950' : 'bg-white/5 text-ink-300 hover:bg-white/10 hover:text-ink-100',
      )}
    >
      {children}
    </button>
  );
}
