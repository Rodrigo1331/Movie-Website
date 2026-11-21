import type { Stats } from '@moviesite/shared';
import type { DB } from '../../db/database.ts';
import type { MoviesRepository } from '../movies/repository.ts';

const round1 = (v: unknown) => (v == null ? null : Math.round(Number(v) * 10) / 10);

export function createStatsRepository(db: DB, movies: MoviesRepository) {
  return {
    get(): Stats {
      const totals = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM movies) AS total,
             (SELECT COUNT(*) FROM ratings) AS rated,
             (SELECT COUNT(*) FROM reviews WHERE length(trim(body)) > 0) AS written,
             (SELECT AVG(score) FROM ratings) AS average,
             (SELECT MAX(score) FROM ratings) AS highest,
             (SELECT COALESCE(SUM(runtime), 0) FROM movies) AS runtime,
             (SELECT COUNT(*) FROM reviews WHERE substr(date_watched, 1, 4) = strftime('%Y', 'now')) AS this_year,
             (SELECT COUNT(DISTINCT genre_id) FROM movie_genres) AS genres,
             (SELECT COUNT(*) FROM sections) AS sections`,
        )
        .get()!;

      const buckets = new Map(
        db
          .prepare('SELECT CAST(score AS INTEGER) AS bucket, COUNT(*) AS count FROM ratings GROUP BY bucket')
          .all()
          .map((r) => [Number(r.bucket), Number(r.count)]),
      );

      const topGenres = db
        .prepare(
          `SELECT g.name AS name, COUNT(*) AS count, AVG(rt.score) AS avg
             FROM movie_genres mg
             JOIN genres g ON g.id = mg.genre_id
             LEFT JOIN ratings rt ON rt.movie_id = mg.movie_id
            GROUP BY g.id ORDER BY count DESC, g.name LIMIT 8`,
        )
        .all()
        .map((r) => ({ name: String(r.name), count: Number(r.count), averageRating: round1(r.avg) }));

      const topDirectors = db
        .prepare(
          `SELECT m.director AS name, COUNT(*) AS count, AVG(rt.score) AS avg
             FROM movies m LEFT JOIN ratings rt ON rt.movie_id = m.id
            WHERE m.director IS NOT NULL AND trim(m.director) != ''
            GROUP BY m.director COLLATE NOCASE
            ORDER BY count DESC, avg DESC LIMIT 6`,
        )
        .all()
        .map((r) => ({ name: String(r.name), count: Number(r.count), averageRating: round1(r.avg) }));

      return {
        totalMovies: Number(totals.total),
        ratedMovies: Number(totals.rated),
        writtenReviews: Number(totals.written),
        averageRating: totals.average == null ? null : Math.round(Number(totals.average) * 100) / 100,
        highestRating: round1(totals.highest),
        totalRuntimeMinutes: Number(totals.runtime),
        watchedThisYear: Number(totals.this_year),
        genreCount: Number(totals.genres),
        sectionCount: Number(totals.sections),
        ratingDistribution: Array.from({ length: 11 }, (_, bucket) => ({ bucket, count: buckets.get(bucket) ?? 0 })),
        topGenres,
        topDirectors,
        recentlyReviewed: movies.list({ reviewedOnly: true, sort: 'reviewed', order: 'desc', limit: 12 }),
        highestRated: movies.list({ ratedOnly: true, sort: 'rating', order: 'desc', limit: 12 }),
      };
    },
  };
}
