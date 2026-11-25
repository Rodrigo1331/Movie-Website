import type { ComparisonPoint, RatingComparison, Stats } from '@moviesite/shared';
import type { DB } from '../../db/database.ts';
import type { MoviesRepository } from '../movies/repository.ts';

const round1 = (v: unknown) => (v == null ? null : Math.round(Number(v) * 10) / 10);

const round2 = (v: number) => Math.round(v * 100) / 100;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Pearson correlation; null when there are too few points or no variation. */
export function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? null : round2(sxy / Math.sqrt(sxx * syy));
}

function comparison(db: DB): RatingComparison {
  const points = db
    .prepare(
      `SELECT m.id, m.title, m.release_year, m.poster_url, rt.score AS mine, er.imdb_rating AS imdb,
              COALESCE(er.metacritic / 10.0, er.rotten_tomatoes / 10.0) AS critics
         FROM ratings rt
         JOIN movies m ON m.id = rt.movie_id
         JOIN external_ratings er ON er.movie_id = m.id
        WHERE er.imdb_rating IS NOT NULL OR er.metacritic IS NOT NULL OR er.rotten_tomatoes IS NOT NULL
        ORDER BY m.title COLLATE NOCASE`,
    )
    .all()
    .map(
      (r): ComparisonPoint => ({
        id: Number(r.id),
        title: String(r.title),
        releaseYear: r.release_year == null ? null : Number(r.release_year),
        posterUrl: r.poster_url == null ? null : String(r.poster_url),
        mine: Number(r.mine),
        imdb: r.imdb == null ? null : Number(r.imdb),
        critics: r.critics == null ? null : Math.round(Number(r.critics) * 10) / 10,
      }),
    );
  const withImdb = points.filter((p): p is ComparisonPoint & { imdb: number } => p.imdb !== null);
  const mine = withImdb.map((p) => p.mine);
  const imdb = withImdb.map((p) => p.imdb);
  const has = withImdb.length > 0;
  return {
    compared: withImdb.length,
    myAverage: has ? round2(mean(mine)) : null,
    imdbAverage: has ? round2(mean(imdb)) : null,
    averageGap: has ? round2(mean(mine) - mean(imdb)) : null,
    correlation: correlation(mine, imdb),
    points,
  };
}

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
        comparison: comparison(db),
      };
    },
  };
}
