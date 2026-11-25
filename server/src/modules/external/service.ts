import type { ExternalRefreshResult, ExternalStatus, Movie } from '@moviesite/shared';
import { nowIso, type DB } from '../../db/database.ts';
import { AppError } from '../../lib/errors.ts';
import type { MoviesRepository } from '../movies/repository.ts';
import type { TmdbClient } from '../tmdb/client.ts';
import type { OmdbClient } from './omdb.ts';

/** Errors that will fail for every film (bad key, quota) — stop a bulk run instead of continuing. */
const FATAL = new Set(['omdb_auth', 'omdb_rate_limited', 'tmdb_auth', 'tmdb_rate_limited', 'omdb_unreachable', 'tmdb_unreachable']);

/**
 * Fetches scores from other sites (IMDb, Rotten Tomatoes and Metacritic via OMDb; TMDB's own score)
 * and caches them in `external_ratings`, so pages never wait on third-party APIs.
 */
export function createExternalRatingsService(deps: { db: DB; movies: MoviesRepository; tmdb: TmdbClient; omdb: OmdbClient }) {
  const { db, movies, tmdb, omdb } = deps;
  const configured = () => omdb.configured || tmdb.configured;

  const upsert = db.prepare(
    `INSERT INTO external_ratings
       (movie_id, imdb_id, imdb_rating, imdb_votes, rotten_tomatoes, metacritic, tmdb_rating, tmdb_votes, fetched_at)
     VALUES ($movieId, $imdbId, $imdbRating, $imdbVotes, $rottenTomatoes, $metacritic, $tmdbRating, $tmdbVotes, $fetchedAt)
     ON CONFLICT(movie_id) DO UPDATE SET
       imdb_id = excluded.imdb_id, imdb_rating = excluded.imdb_rating, imdb_votes = excluded.imdb_votes,
       rotten_tomatoes = excluded.rotten_tomatoes, metacritic = excluded.metacritic,
       tmdb_rating = excluded.tmdb_rating, tmdb_votes = excluded.tmdb_votes, fetched_at = excluded.fetched_at`,
  );
  const missingAfter = db.prepare(
    `SELECT id FROM movies WHERE id > ? AND id NOT IN (SELECT movie_id FROM external_ratings) ORDER BY id LIMIT ?`,
  );
  const countMissingAfter = db.prepare(
    `SELECT COUNT(*) AS n FROM movies WHERE id > ? AND id NOT IN (SELECT movie_id FROM external_ratings)`,
  );

  async function refreshMovie(movie: Movie): Promise<Movie> {
    if (!configured()) {
      throw new AppError(503, 'external_not_configured', 'Add OMDB_API_KEY (and/or TMDB_API_TOKEN) to the .env file to fetch scores from other sites.');
    }
    let imdbId = movie.externalRatings?.imdbId ?? null;
    let tmdbRating: number | null = null;
    let tmdbVotes: number | null = null;

    if (movie.tmdbId && tmdb.configured) {
      const info = await tmdb.ratingInfo(movie.tmdbId);
      imdbId = info.imdbId ?? imdbId;
      if (info.voteCount > 0) {
        tmdbRating = Math.round(info.voteAverage * 10) / 10;
        tmdbVotes = info.voteCount;
      }
    }

    const found = omdb.configured
      ? await omdb.lookup(imdbId ? { imdbId } : { title: movie.title, year: movie.releaseYear })
      : null;

    // A row is stored even when nothing matched, so bulk refreshes don't keep retrying the same film.
    upsert.run({
      $movieId: movie.id,
      $imdbId: found?.imdbId ?? imdbId,
      $imdbRating: found?.imdbRating ?? null,
      $imdbVotes: found?.imdbVotes ?? null,
      $rottenTomatoes: found?.rottenTomatoes ?? null,
      $metacritic: found?.metacritic ?? null,
      $tmdbRating: tmdbRating,
      $tmdbVotes: tmdbVotes,
      $fetchedAt: nowIso(),
    });
    return movies.get(movie.id);
  }

  return {
    status(): ExternalStatus {
      const missing = Number(countMissingAfter.get(0)!.n);
      return { omdb: omdb.configured, tmdb: tmdb.configured, missing };
    },

    refresh(movieId: number): Promise<Movie> {
      return refreshMovie(movies.get(movieId));
    },

    /** Best-effort fetch right after a film is added; failures are logged and never block the save. */
    async refreshQuietly(movie: Movie, log: (error: unknown) => void): Promise<Movie> {
      if (!configured()) return movie;
      try {
        return await refreshMovie(movie);
      } catch (error) {
        log(error);
        return movie;
      }
    },

    /** Processes films with no stored scores, in id order after `after`. Call repeatedly with `nextAfter`. */
    async refreshMissing(after: number, limit: number): Promise<ExternalRefreshResult> {
      if (!configured()) {
        throw new AppError(503, 'external_not_configured', 'Add OMDB_API_KEY to the .env file to fetch scores from other sites.');
      }
      const ids = missingAfter.all(after, limit).map((r) => Number(r.id));
      let updated = 0;
      let failed = 0;
      let nextAfter = after;
      for (const id of ids) {
        try {
          await refreshMovie(movies.get(id));
          updated++;
        } catch (error) {
          if (error instanceof AppError && FATAL.has(error.code)) {
            if (updated === 0 && failed === 0) throw error;
            return { updated, failed, nextAfter, remaining: Number(countMissingAfter.get(nextAfter)!.n), stoppedReason: error.message };
          }
          failed++;
        }
        nextAfter = id;
      }
      return { updated, failed, nextAfter, remaining: Number(countMissingAfter.get(nextAfter)!.n), stoppedReason: null };
    },
  };
}

export type ExternalRatingsService = ReturnType<typeof createExternalRatingsService>;
