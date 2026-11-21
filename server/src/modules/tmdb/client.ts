import type { TmdbMovieDetails, TmdbSearchResult } from '@moviesite/shared';
import { AppError } from '../../lib/errors.ts';

const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const posterUrl = (path: string | null | undefined) => (path ? `${IMAGE_BASE}/w500${path}` : null);
export const backdropUrl = (path: string | null | undefined) => (path ? `${IMAGE_BASE}/w1280${path}` : null);

type FetchFn = typeof fetch;

interface RawSearchMovie {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  genre_ids?: number[];
}

interface RawSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: RawSearchMovie[];
}

interface RawDetails {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number | null;
  genres?: { id: number; name: string }[];
  credits?: { crew?: { job: string; name: string }[] };
}

export type TmdbSearchItem = Omit<TmdbSearchResult, 'inLibraryId'>;
export type TmdbDetailsItem = Omit<TmdbMovieDetails, 'inLibraryId'>;

export interface TmdbClient {
  readonly configured: boolean;
  search(query: string, page?: number): Promise<{ page: number; totalPages: number; totalResults: number; results: TmdbSearchItem[] }>;
  details(tmdbId: number): Promise<TmdbDetailsItem>;
}

const validDate = (d: string | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

/**
 * Server-side TMDB client. The credential is only ever read here, from the server environment,
 * so it is never exposed to the browser.
 */
export function createTmdbClient(options: { token: string | null; fetchFn?: FetchFn; timeoutMs?: number }): TmdbClient {
  const { token, fetchFn = fetch, timeoutMs = 10_000 } = options;
  // v4 "API Read Access Tokens" are JWTs (start with "eyJ"); anything else is treated as a v3 API key.
  const isBearer = !!token && token.startsWith('eyJ');
  let genreMap: Promise<Map<number, string>> | null = null;

  async function request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!token) {
      throw new AppError(
        503,
        'tmdb_not_configured',
        'TMDB is not configured. Add TMDB_API_TOKEN to the .env file and restart the server.',
      );
    }
    const url = new URL(`${API_BASE}${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!isBearer) url.searchParams.set('api_key', token);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (isBearer) headers.authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timedOut = (error as Error).name === 'TimeoutError';
      throw new AppError(502, 'tmdb_unreachable', timedOut ? 'TMDB did not respond in time' : 'Could not reach TMDB');
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) {
      throw new AppError(502, 'tmdb_auth', 'TMDB rejected the API credentials. Check TMDB_API_TOKEN in your .env file.');
    }
    if (res.status === 404) throw new AppError(404, 'not_found', 'Movie not found on TMDB');
    if (res.status === 429) throw new AppError(429, 'tmdb_rate_limited', 'TMDB rate limit reached, try again shortly');
    throw new AppError(502, 'tmdb_error', `TMDB request failed (${res.status})`);
  }

  function genres(): Promise<Map<number, string>> {
    genreMap ??= request<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'en-US' })
      .then((r) => new Map(r.genres.map((g) => [g.id, g.name])))
      .catch((error) => {
        genreMap = null; // retry on the next call
        throw error;
      });
    return genreMap;
  }

  return {
    configured: !!token,

    async search(query, page = 1) {
      const [data, genreNames] = await Promise.all([
        request<RawSearchResponse>('/search/movie', {
          query,
          page: String(page),
          include_adult: 'false',
          language: 'en-US',
        }),
        genres().catch(() => new Map<number, string>()),
      ]);
      return {
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        results: data.results.map((m) => {
          const releaseDate = validDate(m.release_date);
          return {
            tmdbId: m.id,
            title: m.title,
            releaseDate,
            releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
            posterUrl: posterUrl(m.poster_path),
            overview: m.overview || null,
            genres: (m.genre_ids ?? []).map((id) => genreNames.get(id)).filter((g): g is string => !!g),
          };
        }),
      };
    },

    async details(tmdbId) {
      const m = await request<RawDetails>(`/movie/${tmdbId}`, { append_to_response: 'credits', language: 'en-US' });
      const releaseDate = validDate(m.release_date);
      const directors = (m.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
      return {
        tmdbId: m.id,
        title: m.title,
        releaseDate,
        releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
        director: directors.length ? [...new Set(directors)].join(', ') : null,
        description: m.overview || null,
        posterUrl: posterUrl(m.poster_path),
        backdropUrl: backdropUrl(m.backdrop_path),
        runtime: m.runtime || null,
        genres: (m.genres ?? []).map((g) => g.name),
      };
    },
  };
}
