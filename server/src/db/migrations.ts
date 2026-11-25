import type { DatabaseSync } from 'node:sqlite';

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE movies (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id       INTEGER UNIQUE,
        title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
        release_date  TEXT,
        release_year  INTEGER,
        director      TEXT,
        description   TEXT,
        poster_url    TEXT,
        backdrop_url  TEXT,
        runtime       INTEGER CHECK (runtime IS NULL OR runtime >= 0),
        created_at    TEXT NOT NULL DEFAULT ${NOW},
        updated_at    TEXT NOT NULL DEFAULT ${NOW}
      );
      CREATE INDEX idx_movies_title   ON movies (title COLLATE NOCASE);
      CREATE INDEX idx_movies_release ON movies (release_date);
      CREATE INDEX idx_movies_year    ON movies (release_year);

      CREATE TABLE genres (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
      );

      CREATE TABLE movie_genres (
        movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
        genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
        PRIMARY KEY (movie_id, genre_id)
      );
      CREATE INDEX idx_movie_genres_genre ON movie_genres (genre_id);

      CREATE TABLE ratings (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id INTEGER NOT NULL UNIQUE REFERENCES movies(id) ON DELETE CASCADE,
        score    REAL NOT NULL CHECK (score >= 0 AND score <= 10),
        rated_at TEXT NOT NULL DEFAULT ${NOW}
      );
      CREATE INDEX idx_ratings_score ON ratings (score);

      CREATE TABLE reviews (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id     INTEGER NOT NULL UNIQUE REFERENCES movies(id) ON DELETE CASCADE,
        body         TEXT NOT NULL DEFAULT '',
        date_watched TEXT,
        created_at   TEXT NOT NULL DEFAULT ${NOW},
        updated_at   TEXT NOT NULL DEFAULT ${NOW}
      );
      CREATE INDEX idx_reviews_date_watched ON reviews (date_watched);
      CREATE INDEX idx_reviews_updated      ON reviews (updated_at);

      CREATE TABLE sections (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
        slug       TEXT NOT NULL,
        position   INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT ${NOW}
      );

      CREATE TABLE movie_sections (
        movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        added_at   TEXT NOT NULL DEFAULT ${NOW},
        PRIMARY KEY (movie_id, section_id)
      );
      CREATE INDEX idx_movie_sections_section ON movie_sections (section_id);

      -- Default sections are seeded once; the user may rename or delete them afterwards.
      INSERT INTO sections (name, slug, position, is_default) VALUES
        ('Watched',            'watched',            0, 1),
        ('Want to Watch',      'want-to-watch',      1, 1),
        ('Favourite Movies',   'favourite-movies',   2, 1),
        ('Rewatch',            'rewatch',            3, 1),
        ('Currently Watching', 'currently-watching', 4, 1);
    `,
  },
  {
    version: 2,
    name: 'aspect_ratings',
    sql: `
      CREATE TABLE aspect_ratings (
        movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
        aspect   TEXT    NOT NULL,
        score    REAL    NOT NULL CHECK (score >= 0 AND score <= 10),
        PRIMARY KEY (movie_id, aspect)
      ) WITHOUT ROWID;
    `,
  },
  {
    version: 3,
    name: 'external_ratings',
    sql: `
      CREATE TABLE external_ratings (
        movie_id        INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
        imdb_id         TEXT,
        imdb_rating     REAL    CHECK (imdb_rating IS NULL OR (imdb_rating >= 0 AND imdb_rating <= 10)),
        imdb_votes      INTEGER,
        rotten_tomatoes INTEGER CHECK (rotten_tomatoes IS NULL OR (rotten_tomatoes >= 0 AND rotten_tomatoes <= 100)),
        metacritic      INTEGER CHECK (metacritic IS NULL OR (metacritic >= 0 AND metacritic <= 100)),
        tmdb_rating     REAL    CHECK (tmdb_rating IS NULL OR (tmdb_rating >= 0 AND tmdb_rating <= 10)),
        tmdb_votes      INTEGER,
        fetched_at      TEXT    NOT NULL
      );
    `,
  },
];

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT ${NOW}
    );
  `);
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => Number(row.version)),
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      record.run(migration.version, migration.name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${(error as Error).message}`);
    }
  }
}
