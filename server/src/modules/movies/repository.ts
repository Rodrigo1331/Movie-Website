import type { SQLInputValue } from 'node:sqlite';
import type { AspectRatings, LibraryFacets, Movie, MovieListQuery, SectionRef } from '@moviesite/shared';
import { nowIso, transaction, type DB } from '../../db/database.ts';
import { conflict, notFound } from '../../lib/errors.ts';
import type { SectionsRepository } from '../sections/repository.ts';

interface MovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  release_date: string | null;
  release_year: number | null;
  director: string | null;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  runtime: number | null;
  created_at: string;
  updated_at: string;
  rating: number | null;
  rated_at: string | null;
  review_id: number | null;
  review_body: string | null;
  date_watched: string | null;
  review_created_at: string | null;
  review_updated_at: string | null;
  last_reviewed_at: string | null;
  genres_json: string;
  sections_json: string;
  aspects_json: string;
}

/** Fields that can be written to the movie itself (normalized, null = clear). */
export interface MovieFields {
  tmdbId: number | null;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  director: string | null;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  runtime: number | null;
}

export interface MovieChanges extends Partial<MovieFields> {
  genres?: string[];
  rating?: number | null;
  aspectRatings?: AspectRatings;
  review?: string | null;
  dateWatched?: string | null;
  sectionIds?: number[];
}

const MOVIE_SELECT = `
  SELECT
    m.*,
    rt.score    AS rating,
    rt.rated_at AS rated_at,
    rv.id           AS review_id,
    rv.body         AS review_body,
    rv.date_watched AS date_watched,
    rv.created_at   AS review_created_at,
    rv.updated_at   AS review_updated_at,
    NULLIF(MAX(COALESCE(rv.updated_at, ''), COALESCE(rt.rated_at, '')), '') AS last_reviewed_at,
    (SELECT json_group_array(g.name)
       FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
      WHERE mg.movie_id = m.id) AS genres_json,
    (SELECT json_group_array(json_object('id', s.id, 'name', s.name, 'position', s.position))
       FROM movie_sections ms JOIN sections s ON s.id = ms.section_id
      WHERE ms.movie_id = m.id) AS sections_json,
    (SELECT json_group_object(ar.aspect, ar.score) FROM aspect_ratings ar WHERE ar.movie_id = m.id) AS aspects_json
  FROM movies m
  LEFT JOIN ratings rt ON rt.movie_id = m.id
  LEFT JOIN reviews rv ON rv.movie_id = m.id`;

function toMovie(r: MovieRow): Movie {
  const genres = (JSON.parse(r.genres_json) as string[]).sort((a, b) => a.localeCompare(b));
  const sections = (JSON.parse(r.sections_json) as (SectionRef & { position: number })[])
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .map(({ id, name }) => ({ id, name }));
  return {
    id: r.id,
    tmdbId: r.tmdb_id,
    title: r.title,
    releaseDate: r.release_date,
    releaseYear: r.release_year,
    director: r.director,
    description: r.description,
    posterUrl: r.poster_url,
    backdropUrl: r.backdrop_url,
    runtime: r.runtime,
    genres,
    rating: r.rating,
    ratedAt: r.rated_at,
    aspectRatings: JSON.parse(r.aspects_json) as AspectRatings,
    review:
      r.review_id === null
        ? null
        : {
            body: r.review_body ?? '',
            dateWatched: r.date_watched,
            createdAt: r.review_created_at!,
            updatedAt: r.review_updated_at!,
          },
    sections,
    lastReviewedAt: r.last_reviewed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);

const FIELD_COLUMNS: Record<keyof MovieFields, string> = {
  tmdbId: 'tmdb_id',
  title: 'title',
  releaseDate: 'release_date',
  releaseYear: 'release_year',
  director: 'director',
  description: 'description',
  posterUrl: 'poster_url',
  backdropUrl: 'backdrop_url',
  runtime: 'runtime',
};

export function createMoviesRepository(db: DB, sections: SectionsRepository) {
  const getStmt = db.prepare(`${MOVIE_SELECT} WHERE m.id = ?`);

  function find(id: number): Movie | null {
    const row = getStmt.get(id) as unknown as MovieRow | undefined;
    return row ? toMovie(row) : null;
  }

  function get(id: number): Movie {
    const movie = find(id);
    if (!movie) throw notFound('Movie');
    return movie;
  }

  function assertTmdbFree(tmdbId: number | null | undefined, exceptId = 0) {
    if (tmdbId == null) return;
    const row = db.prepare('SELECT id FROM movies WHERE tmdb_id = ? AND id != ?').get(tmdbId, exceptId);
    if (row) throw conflict('This movie is already in your library', { movieId: Number(row.id) });
  }

  function setGenres(movieId: number, names: string[]) {
    db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(movieId);
    const seen = new Set<string>();
    const insertGenre = db.prepare('INSERT INTO genres (name) VALUES (?) ON CONFLICT(name) DO NOTHING');
    const findGenre = db.prepare('SELECT id FROM genres WHERE name = ?');
    const link = db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
    for (const raw of names) {
      const name = raw.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      insertGenre.run(name);
      const genre = findGenre.get(name)!;
      link.run(movieId, Number(genre.id));
    }
    db.exec('DELETE FROM genres WHERE id NOT IN (SELECT genre_id FROM movie_genres)');
  }

  function setRating(movieId: number, score: number | null) {
    if (score === null) {
      db.prepare('DELETE FROM ratings WHERE movie_id = ?').run(movieId);
      return;
    }
    db.prepare(
      `INSERT INTO ratings (movie_id, score, rated_at) VALUES (?, ?, ?)
       ON CONFLICT(movie_id) DO UPDATE SET
         rated_at = CASE WHEN ratings.score = excluded.score THEN ratings.rated_at ELSE excluded.rated_at END,
         score = excluded.score`,
    ).run(movieId, score, nowIso());
  }

  function setAspectRatings(movieId: number, scores: AspectRatings) {
    db.prepare('DELETE FROM aspect_ratings WHERE movie_id = ?').run(movieId);
    const insert = db.prepare('INSERT INTO aspect_ratings (movie_id, aspect, score) VALUES (?, ?, ?)');
    for (const [aspect, score] of Object.entries(scores)) {
      if (score != null) insert.run(movieId, aspect, score);
    }
  }

  function setReview(movieId: number, body: string, dateWatched: string | null) {
    const text = body.trim();
    if (!text && !dateWatched) {
      db.prepare('DELETE FROM reviews WHERE movie_id = ?').run(movieId);
      return;
    }
    const now = nowIso();
    db.prepare(
      `INSERT INTO reviews (movie_id, body, date_watched, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(movie_id) DO UPDATE SET
         updated_at = CASE WHEN reviews.body = excluded.body AND reviews.date_watched IS excluded.date_watched
                           THEN reviews.updated_at ELSE excluded.updated_at END,
         body = excluded.body,
         date_watched = excluded.date_watched`,
    ).run(movieId, text, dateWatched, now, now);
  }

  function setSections(movieId: number, ids: number[]) {
    sections.assertExist(ids);
    const json = JSON.stringify([...new Set(ids)]);
    db.prepare('DELETE FROM movie_sections WHERE movie_id = ? AND section_id NOT IN (SELECT value FROM json_each(?))').run(
      movieId,
      json,
    );
    db.prepare('INSERT OR IGNORE INTO movie_sections (movie_id, section_id) SELECT ?, value FROM json_each(?)').run(
      movieId,
      json,
    );
  }

  function applyRelations(movieId: number, changes: MovieChanges, existing: Movie | null) {
    if (changes.genres !== undefined) setGenres(movieId, changes.genres);
    if (changes.rating !== undefined) setRating(movieId, changes.rating);
    if (changes.aspectRatings !== undefined) setAspectRatings(movieId, changes.aspectRatings);
    if (changes.review !== undefined || changes.dateWatched !== undefined) {
      const body = changes.review !== undefined ? changes.review ?? '' : existing?.review?.body ?? '';
      const watched = changes.dateWatched !== undefined ? changes.dateWatched : existing?.review?.dateWatched ?? null;
      setReview(movieId, body, watched);
    }
    if (changes.sectionIds !== undefined) setSections(movieId, changes.sectionIds);
  }

  return {
    find,
    get,

    list(query: MovieListQuery & { reviewedOnly?: boolean; ratedOnly?: boolean } = {}): Movie[] {
      const where: string[] = [];
      const params: Record<string, SQLInputValue> = {};

      if (query.q) {
        where.push(`(m.title LIKE $q ESCAPE '\\' OR m.director LIKE $q ESCAPE '\\')`);
        params.$q = `%${escapeLike(query.q)}%`;
      }
      if (query.genre) {
        where.push(`EXISTS (SELECT 1 FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
                            WHERE mg.movie_id = m.id AND g.name = $genre)`);
        params.$genre = query.genre;
      }
      if (query.year != null) {
        where.push('m.release_year = $year');
        params.$year = query.year;
      }
      if (query.minRating != null) {
        where.push('rt.score >= $minRating');
        params.$minRating = query.minRating;
      }
      if (query.maxRating != null) {
        where.push('rt.score <= $maxRating');
        params.$maxRating = query.maxRating;
      }
      if (query.section != null) {
        where.push('EXISTS (SELECT 1 FROM movie_sections ms WHERE ms.movie_id = m.id AND ms.section_id = $section)');
        params.$section = query.section;
      }
      if (query.reviewedOnly) where.push('(rt.id IS NOT NULL OR rv.id IS NOT NULL)');
      if (query.ratedOnly) where.push('rt.id IS NOT NULL');

      const sort = query.sort ?? 'added';
      const defaultOrder = sort === 'title' ? 'asc' : 'desc';
      const dir = (query.order ?? defaultOrder) === 'asc' ? 'ASC' : 'DESC';
      const byTitle = 'm.title COLLATE NOCASE ASC';
      const orderBy = {
        rating: `(rt.score IS NULL), rt.score ${dir}, ${byTitle}`,
        release: `(COALESCE(m.release_date, m.release_year) IS NULL),
                  COALESCE(m.release_date, printf('%04d-12-31', m.release_year)) ${dir}, ${byTitle}`,
        title: `m.title COLLATE NOCASE ${dir}`,
        added: `m.created_at ${dir}, m.id ${dir}`,
        reviewed: `(last_reviewed_at IS NULL), last_reviewed_at ${dir}, ${byTitle}`,
      }[sort];

      let sql = `${MOVIE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
      if (query.limit) {
        sql += ' LIMIT $limit';
        params.$limit = query.limit;
      }
      return (db.prepare(sql).all(params) as unknown as MovieRow[]).map(toMovie);
    },

    create(fields: MovieFields, relations: MovieChanges): Movie {
      return transaction(db, () => {
        assertTmdbFree(fields.tmdbId);
        const releaseYear = yearOf(fields.releaseDate) ?? fields.releaseYear;
        const now = nowIso();
        const result = db
          .prepare(
            `INSERT INTO movies (tmdb_id, title, release_date, release_year, director, description,
                                 poster_url, backdrop_url, runtime, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            fields.tmdbId,
            fields.title,
            fields.releaseDate,
            releaseYear,
            fields.director,
            fields.description,
            fields.posterUrl,
            fields.backdropUrl,
            fields.runtime,
            now,
            now,
          );
        const id = Number(result.lastInsertRowid);
        applyRelations(id, relations, null);
        return get(id);
      });
    },

    update(id: number, changes: MovieChanges): Movie {
      return transaction(db, () => {
        const existing = get(id);
        if (changes.tmdbId !== undefined) assertTmdbFree(changes.tmdbId, id);

        const fields: Partial<MovieFields> = {};
        for (const key of Object.keys(FIELD_COLUMNS) as (keyof MovieFields)[]) {
          if (changes[key] !== undefined) (fields as Record<string, unknown>)[key] = changes[key];
        }
        if (changes.releaseDate !== undefined || changes.releaseYear !== undefined) {
          const date = changes.releaseDate !== undefined ? changes.releaseDate : existing.releaseDate;
          fields.releaseYear =
            yearOf(date) ?? (changes.releaseYear !== undefined ? changes.releaseYear : existing.releaseYear);
        }

        const sets = Object.keys(fields).map((k) => `${FIELD_COLUMNS[k as keyof MovieFields]} = ?`);
        const values = Object.values(fields) as SQLInputValue[];
        db.prepare(`UPDATE movies SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE id = ?`).run(
          ...values,
          nowIso(),
          id,
        );
        applyRelations(id, changes, existing);
        return get(id);
      });
    },

    saveReview(id: number, rating: number | null, body: string, dateWatched: string | null, aspectRatings?: AspectRatings): Movie {
      return transaction(db, () => {
        get(id);
        setRating(id, rating);
        if (aspectRatings !== undefined) setAspectRatings(id, aspectRatings);
        setReview(id, body, dateWatched);
        return get(id);
      });
    },

    deleteReview(id: number): Movie {
      return transaction(db, () => {
        get(id);
        db.prepare('DELETE FROM ratings WHERE movie_id = ?').run(id);
        db.prepare('DELETE FROM aspect_ratings WHERE movie_id = ?').run(id);
        db.prepare('DELETE FROM reviews WHERE movie_id = ?').run(id);
        return get(id);
      });
    },

    setSections(id: number, ids: number[]): Movie {
      return transaction(db, () => {
        get(id);
        setSections(id, ids);
        return get(id);
      });
    },

    delete(id: number): void {
      transaction(db, () => {
        const result = db.prepare('DELETE FROM movies WHERE id = ?').run(id);
        if (result.changes === 0) throw notFound('Movie');
        db.exec('DELETE FROM genres WHERE id NOT IN (SELECT genre_id FROM movie_genres)');
      });
    },

    facets(): LibraryFacets {
      const genres = db
        .prepare(
          `SELECT g.name AS name, COUNT(*) AS count
             FROM genres g JOIN movie_genres mg ON mg.genre_id = g.id
            GROUP BY g.id ORDER BY g.name COLLATE NOCASE`,
        )
        .all() as unknown as { name: string; count: number }[];
      const years = db
        .prepare('SELECT DISTINCT release_year AS y FROM movies WHERE release_year IS NOT NULL ORDER BY y DESC')
        .all()
        .map((r) => Number(r.y));
      return { genres, years };
    },

    /** Maps TMDB ids to local movie ids for the given TMDB ids. */
    libraryIdsForTmdb(tmdbIds: number[]): Map<number, number> {
      if (tmdbIds.length === 0) return new Map();
      const rows = db
        .prepare('SELECT id, tmdb_id FROM movies WHERE tmdb_id IN (SELECT value FROM json_each(?))')
        .all(JSON.stringify(tmdbIds));
      return new Map(rows.map((r) => [Number(r.tmdb_id), Number(r.id)]));
    },
  };
}

export type MoviesRepository = ReturnType<typeof createMoviesRepository>;
