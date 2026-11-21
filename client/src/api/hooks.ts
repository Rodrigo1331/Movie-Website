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
