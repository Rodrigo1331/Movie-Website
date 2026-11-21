import type { FastifyInstance } from 'fastify';
import type { TmdbMovieDetails, TmdbSearchResponse, TmdbStatus } from '@moviesite/shared';
import { z } from 'zod';
import { parse } from '../../lib/validation.ts';
import type { MoviesRepository } from '../movies/repository.ts';
import type { TmdbClient } from './client.ts';

const searchQuery = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(200),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
const tmdbIdParam = z.object({ tmdbId: z.coerce.number().int().positive() });

export function tmdbRoutes(deps: { tmdb: TmdbClient; movies: MoviesRepository }) {
  const { tmdb, movies } = deps;
  return async (app: FastifyInstance) => {
    app.get('/tmdb/status', async (): Promise<TmdbStatus> => ({ configured: tmdb.configured }));

    app.get('/tmdb/search', async (req): Promise<TmdbSearchResponse> => {
      const { q, page } = parse(searchQuery, req.query);
      const data = await tmdb.search(q, page);
      const inLibrary = movies.libraryIdsForTmdb(data.results.map((r) => r.tmdbId));
      return { ...data, results: data.results.map((r) => ({ ...r, inLibraryId: inLibrary.get(r.tmdbId) ?? null })) };
    });

    app.get('/tmdb/movie/:tmdbId', async (req): Promise<TmdbMovieDetails> => {
      const { tmdbId } = parse(tmdbIdParam, req.params);
      const details = await tmdb.details(tmdbId);
      return { ...details, inLibraryId: movies.libraryIdsForTmdb([tmdbId]).get(tmdbId) ?? null };
    });
  };
}
