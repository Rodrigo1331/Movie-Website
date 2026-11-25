import { useCallback, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Movie, MovieInput, MovieListQuery, MovieUpdate, ReviewInput } from '@moviesite/shared';
import { api } from './client';

export const keys = {
  movies: (q: MovieListQuery) => ['movies', q] as const,
  movie: (id: number) => ['movie', id] as const,
  facets: ['facets'] as const,
  sections: ['sections'] as const,
  stats: ['stats'] as const,
  tmdbStatus: ['tmdb', 'status'] as const,
  externalStatus: ['external', 'status'] as const,
  tmdbSearch: (q: string, page: number) => ['tmdb', 'search', q, page] as const,
  tmdbDetails: (id: number) => ['tmdb', 'details', id] as const,
};

/** Any write can affect lists, stats, facets and section counts — refresh them all. */
function invalidateLibrary(qc: QueryClient, movie?: Movie) {
  if (movie) qc.setQueryData(keys.movie(movie.id), movie);
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['movies'] }),
    qc.invalidateQueries({ queryKey: keys.stats }),
    qc.invalidateQueries({ queryKey: keys.facets }),
    qc.invalidateQueries({ queryKey: keys.sections }),
    qc.invalidateQueries({ queryKey: ['tmdb', 'search'] }),
    qc.invalidateQueries({ queryKey: keys.externalStatus }),
  ]);
}

export const useMovies = (query: MovieListQuery, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: keys.movies(query),
    queryFn: () => api.movies.list(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });

export const useMovie = (id: number) =>
  useQuery({ queryKey: keys.movie(id), queryFn: () => api.movies.get(id), enabled: Number.isFinite(id) && id > 0 });

export const useFacets = () => useQuery({ queryKey: keys.facets, queryFn: api.movies.facets });
export const useSections = () => useQuery({ queryKey: keys.sections, queryFn: api.sections.list });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: api.stats });
export const useTmdbStatus = () => useQuery({ queryKey: keys.tmdbStatus, queryFn: api.tmdb.status, staleTime: Infinity });

export const useTmdbSearch = (q: string, page: number, enabled: boolean) =>
  useQuery({
    queryKey: keys.tmdbSearch(q, page),
    queryFn: () => api.tmdb.search(q, page),
    enabled: enabled && q.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

export const useTmdbDetails = (tmdbId: number | null) =>
  useQuery({
    queryKey: keys.tmdbDetails(tmdbId ?? 0),
    queryFn: () => api.tmdb.details(tmdbId!),
    enabled: tmdbId !== null,
    staleTime: 10 * 60_000,
  });

export function useCreateMovie() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: MovieInput) => api.movies.create(input), onSuccess: (m) => invalidateLibrary(qc, m) });
}

export function useUpdateMovie(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: MovieUpdate) => api.movies.update(id, input), onSuccess: (m) => invalidateLibrary(qc, m) });
}

export function useDeleteMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.movies.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.movie(id) });
      return invalidateLibrary(qc);
    },
  });
}

export function useSetMovieSections(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sectionIds: number[]) => api.movies.setSections(id, sectionIds),
    onSuccess: (m) => invalidateLibrary(qc, m),
  });
}

export function useSaveReview(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: ReviewInput) => api.movies.saveReview(id, input), onSuccess: (m) => invalidateLibrary(qc, m) });
}

export function useDeleteReview(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.movies.deleteReview(id), onSuccess: (m) => invalidateLibrary(qc, m) });
}

export function useSectionMutations() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.sections }),
      qc.invalidateQueries({ queryKey: ['movies'] }),
      qc.invalidateQueries({ queryKey: ['movie'] }),
      qc.invalidateQueries({ queryKey: keys.stats }),
    ]);
  return {
    create: useMutation({ mutationFn: api.sections.create, onSuccess: refresh }),
    rename: useMutation({ mutationFn: (v: { id: number; name: string }) => api.sections.rename(v.id, v.name), onSuccess: refresh }),
    reorder: useMutation({ mutationFn: api.sections.reorder, onSuccess: refresh }),
    remove: useMutation({ mutationFn: api.sections.remove, onSuccess: refresh }),
  };
}

export const useExternalStatus = () => useQuery({ queryKey: keys.externalStatus, queryFn: api.external.status });

/** Re-fetch IMDb / Rotten Tomatoes / Metacritic / TMDB scores for one film. */
export function useRefreshExternal(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.external.refresh(id), onSuccess: (m) => invalidateLibrary(qc, m) });
}

export interface BackfillState {
  running: boolean;
  done: number;
  total: number;
  error: string | null;
}

/** Fetches outside scores for every film that doesn't have them yet, in small batches, with progress. */
export function useExternalBackfill() {
  const qc = useQueryClient();
  const [state, setState] = useState<BackfillState>({ running: false, done: 0, total: 0, error: null });

  const run = useCallback(
    async (total: number) => {
      setState({ running: true, done: 0, total, error: null });
      let after = 0;
      let done = 0;
      let error: string | null = null;
      try {
        for (;;) {
          const r = await api.external.refreshMissing(after);
          done += r.updated + r.failed;
          setState((s) => ({ ...s, done }));
          if (r.stoppedReason) {
            error = r.stoppedReason;
            break;
          }
          if (r.remaining === 0 || r.nextAfter === after) break;
          after = r.nextAfter;
        }
      } catch (e) {
        error = (e as Error).message;
      }
      setState({ running: false, done, total, error });
      await Promise.all([invalidateLibrary(qc), qc.invalidateQueries({ queryKey: ['movie'] })]);
    },
    [qc],
  );

  return { ...state, run };
}
