import { AppError } from '../../lib/errors.ts';

const API_BASE = 'https://www.omdbapi.com/';

type FetchFn = typeof fetch;

export interface OmdbRatings {
  imdbId: string | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: number | null;
  metacritic: number | null;
}

export interface OmdbLookup {
  imdbId?: string | null;
  title?: string;
  year?: number | null;
}

export interface OmdbClient {
  readonly configured: boolean;
  /** Looks a film up by IMDb id (exact) or by title + year. Resolves to null when OMDb has no match. */
  lookup(query: OmdbLookup): Promise<OmdbRatings | null>;
}

interface RawOmdb {
  Response: 'True' | 'False';
  Error?: string;
  imdbID?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
}

/** Parses OMDb values such as "8.5", "2,345,678", "97%", "74/100"; "N/A" and junk become null. */
function num(value: string | undefined): number | null {
  if (!value || value === 'N/A') return null;
  const n = Number(value.replace(/,/g, '').replace(/%$/, '').split('/')[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseOmdb(raw: RawOmdb): OmdbRatings {
  const rt = raw.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value;
  const mc = raw.Ratings?.find((r) => r.Source === 'Metacritic')?.Value;
  return {
    imdbId: raw.imdbID && /^tt\d+$/.test(raw.imdbID) ? raw.imdbID : null,
    imdbRating: num(raw.imdbRating),
    imdbVotes: num(raw.imdbVotes),
    rottenTomatoes: num(rt),
    metacritic: num(raw.Metascore) ?? num(mc),
  };
}

/**
 * Server-side OMDb client (IMDb, Rotten Tomatoes and Metacritic scores). The API key is only read
 * here, from the server environment, and never sent to the browser.
 */
export function createOmdbClient(options: { apiKey: string | null; fetchFn?: FetchFn; timeoutMs?: number }): OmdbClient {
  const { apiKey, fetchFn = fetch, timeoutMs = 10_000 } = options;

  return {
    configured: !!apiKey,
    async lookup(query) {
      if (!apiKey) {
        throw new AppError(503, 'omdb_not_configured', 'OMDb is not configured. Add OMDB_API_KEY to the .env file and restart the server.');
      }
      const url = new URL(API_BASE);
      url.searchParams.set('apikey', apiKey);
      if (query.imdbId) {
        url.searchParams.set('i', query.imdbId);
      } else if (query.title) {
        url.searchParams.set('t', query.title);
        url.searchParams.set('type', 'movie');
        if (query.year) url.searchParams.set('y', String(query.year));
      } else {
        return null;
      }

      let res: Response;
      try {
        res = await fetchFn(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        const timedOut = (error as Error).name === 'TimeoutError';
        throw new AppError(502, 'omdb_unreachable', timedOut ? 'OMDb did not respond in time' : 'Could not reach OMDb');
      }
      const data = (await res.json().catch(() => null)) as RawOmdb | null;
      if (data?.Response === 'True') return parseOmdb(data);

      const message = data?.Error ?? '';
      if (/not found/i.test(message)) return null;
      if (/limit/i.test(message)) {
        throw new AppError(429, 'omdb_rate_limited', 'OMDb daily request limit reached (1,000 on the free key). Try again tomorrow.');
      }
      if (res.status === 401 || /api key/i.test(message)) {
        throw new AppError(502, 'omdb_auth', 'OMDb rejected the API key. Check OMDB_API_KEY in your .env file (and that the key is activated).');
      }
      throw new AppError(502, 'omdb_error', `OMDb request failed${message ? `: ${message}` : ` (${res.status})`}`);
    },
  };
}
