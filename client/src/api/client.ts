import type {
  ApiErrorBody,
  ExternalRefreshResult,
  ExternalStatus,
  LibraryFacets,
  Movie,
  MovieInput,
  MovieListQuery,
  MovieUpdate,
  ReviewInput,
  Section,
  Stats,
  TmdbMovieDetails,
  TmdbSearchResponse,
  TmdbStatus,
} from '@moviesite/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { accept: 'application/json' } };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Is it running?');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, err.error ?? 'error', err.message ?? `Request failed (${res.status})`, err.details);
  }
  return data as T;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  movies: {
    list: (query: MovieListQuery = {}) => request<Movie[]>('GET', `/movies${qs(query)}`),
    get: (id: number) => request<Movie>('GET', `/movies/${id}`),
    facets: () => request<LibraryFacets>('GET', '/movies/facets'),
    create: (input: MovieInput) => request<Movie>('POST', '/movies', input),
    update: (id: number, input: MovieUpdate) => request<Movie>('PATCH', `/movies/${id}`, input),
    remove: (id: number) => request<void>('DELETE', `/movies/${id}`),
    setSections: (id: number, sectionIds: number[]) => request<Movie>('PUT', `/movies/${id}/sections`, { sectionIds }),
    saveReview: (id: number, input: ReviewInput) => request<Movie>('PUT', `/movies/${id}/review`, input),
    deleteReview: (id: number) => request<Movie>('DELETE', `/movies/${id}/review`),
  },
  sections: {
    list: () => request<Section[]>('GET', '/sections'),
    create: (name: string) => request<Section>('POST', '/sections', { name }),
    rename: (id: number, name: string) => request<Section>('PATCH', `/sections/${id}`, { name }),
    reorder: (ids: number[]) => request<Section[]>('PUT', '/sections/order', { ids }),
    remove: (id: number) => request<void>('DELETE', `/sections/${id}`),
  },
  stats: () => request<Stats>('GET', '/stats'),
  external: {
    status: () => request<ExternalStatus>('GET', '/external-ratings/status'),
    refresh: (movieId: number) => request<Movie>('POST', `/movies/${movieId}/external-ratings`),
    refreshMissing: (after: number) => request<ExternalRefreshResult>('POST', '/external-ratings/refresh-missing', { after, limit: 10 }),
  },
  tmdb: {
    status: () => request<TmdbStatus>('GET', '/tmdb/status'),
    search: (q: string, page = 1) => request<TmdbSearchResponse>('GET', `/tmdb/search${qs({ q, page })}`),
    details: (tmdbId: number) => request<TmdbMovieDetails>('GET', `/tmdb/movie/${tmdbId}`),
  },
};
