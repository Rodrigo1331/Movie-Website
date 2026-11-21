import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { Movie, Section, Stats, TmdbMovieDetails, TmdbSearchResponse } from '@moviesite/shared';
import { buildApp } from '../src/app.ts';
import { openDatabase, type DB } from '../src/db/database.ts';
import { createTmdbClient } from '../src/modules/tmdb/client.ts';

type App = Awaited<ReturnType<typeof buildApp>>;

const noTmdb = createTmdbClient({ token: null });

async function setup(tmdb = noTmdb) {
  const db = openDatabase(':memory:');
  const app = await buildApp({ db, tmdb });
  return { db, app };
}

async function call<T = unknown>(app: App, method: string, url: string, payload?: unknown) {
  const res = await app.inject({ method: method as 'GET', url, payload: payload as object });
  return { status: res.statusCode, body: (res.body ? res.json() : undefined) as T };
}

describe('sections', () => {
  let app: App;
  before(async () => ({ app } = await setup()));
  after(() => app.close());

  test('seeds the five default sections in order', async () => {
    const { body } = await call<Section[]>(app, 'GET', '/api/sections');
    assert.deepEqual(
      body.map((s) => s.name),
      ['Watched', 'Want to Watch', 'Favourite Movies', 'Rewatch', 'Currently Watching'],
    );
    assert.ok(body.every((s) => s.isDefault && s.movieCount === 0));
  });

  test('create, rename, reorder and delete', async () => {
    const created = await call<Section>(app, 'POST', '/api/sections', { name: '  Horror Nights ' });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Horror Nights');
    assert.equal(created.body.slug, 'horror-nights');

    const dup = await call(app, 'POST', '/api/sections', { name: 'horror nights' });
    assert.equal(dup.status, 409);

    const renamed = await call<Section>(app, 'PATCH', `/api/sections/${created.body.id}`, { name: 'Halloween' });
    assert.equal(renamed.body.name, 'Halloween');

    const list = (await call<Section[]>(app, 'GET', '/api/sections')).body;
    const ids = list.map((s) => s.id).reverse();
    const reordered = await call<Section[]>(app, 'PUT', '/api/sections/order', { ids });
    assert.deepEqual(reordered.body.map((s) => s.id), ids);

    const badOrder = await call(app, 'PUT', '/api/sections/order', { ids: ids.slice(1) });
    assert.equal(badOrder.status, 400);

    assert.equal((await call(app, 'DELETE', `/api/sections/${created.body.id}`)).status, 204);
    assert.equal((await call(app, 'DELETE', `/api/sections/${created.body.id}`)).status, 404);
  });

  test('rejects empty names', async () => {
    assert.equal((await call(app, 'POST', '/api/sections', { name: '   ' })).status, 400);
  });
});

describe('movies & reviews', () => {
  let app: App;
  let db: DB;
  let sections: Section[];
  before(async () => {
    ({ app, db } = await setup());
    sections = (await call<Section[]>(app, 'GET', '/api/sections')).body;
  });
  after(() => app.close());

  const seed = async (payload: Record<string, unknown>) => {
    const res = await call<Movie>(app, 'POST', '/api/movies', payload);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
  };

  test('creates a movie with genres, rating, review and multiple sections', async () => {
    const movie = await seed({
      title: 'Arrival',
      releaseDate: '2016-11-11',
      director: 'Denis Villeneuve',
      genres: ['Sci-Fi', 'Drama', 'drama'],
      rating: 9.25,
      review: 'Gorgeous and moving.',
      dateWatched: '2024-03-02',
      sectionIds: [sections[0]!.id, sections[2]!.id],
      posterUrl: '',
    });
    assert.equal(movie.releaseYear, 2016);
    assert.deepEqual(movie.genres, ['Drama', 'Sci-Fi']);
    assert.equal(movie.rating, 9.3);
    assert.equal(movie.review?.body, 'Gorgeous and moving.');
    assert.equal(movie.review?.dateWatched, '2024-03-02');
    assert.deepEqual(movie.sections.map((s) => s.name), ['Watched', 'Favourite Movies']);
    assert.equal(movie.posterUrl, null);
    assert.ok(movie.lastReviewedAt);
  });

  test('validates input', async () => {
    assert.equal((await call(app, 'POST', '/api/movies', { title: '' })).status, 400);
    assert.equal((await call(app, 'POST', '/api/movies', { title: 'X', rating: 10.5 })).status, 400);
    assert.equal((await call(app, 'POST', '/api/movies', { title: 'X', rating: -1 })).status, 400);
    assert.equal((await call(app, 'POST', '/api/movies', { title: 'X', releaseDate: '2020-02-30' })).status, 400);
    assert.equal((await call(app, 'POST', '/api/movies', { title: 'X', sectionIds: [9999] })).status, 400);
    assert.equal((await call(app, 'POST', '/api/movies', { title: 'X', posterUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call(app, 'GET', '/api/movies/abc')).status, 400);
    assert.equal((await call(app, 'GET', '/api/movies/12345')).status, 404);
  });

  test('rejects duplicate TMDB ids with the existing movie id', async () => {
    const first = await seed({ title: 'Heat', tmdbId: 949, releaseYear: 1995, rating: 0 });
    assert.equal(first.rating, 0);
    const dup = await call<{ details: { movieId: number } }>(app, 'POST', '/api/movies', { title: 'Heat', tmdbId: 949 });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.details.movieId, first.id);
  });

  test('filters, searches and sorts', async () => {
    await seed({ title: 'Paddington 2', releaseDate: '2017-11-10', genres: ['Comedy', 'Family'], rating: 8.4 });
    await seed({ title: 'Cats', releaseDate: '2019-12-20', genres: ['Comedy'], rating: 1.2 });
    await seed({ title: 'Unrated Thing', releaseYear: 2001 });

    const list = async (qs: string) => (await call<Movie[]>(app, 'GET', `/api/movies${qs}`)).body.map((m) => m.title);

    assert.deepEqual(await list('?q=padd'), ['Paddington 2']);
    assert.deepEqual(await list('?q=villeneuve'), ['Arrival']);
    assert.deepEqual(await list('?q=%25'), []);
    assert.deepEqual(await list('?genre=comedy&sort=title'), ['Cats', 'Paddington 2']);
    assert.deepEqual(await list('?year=2017'), ['Paddington 2']);
    assert.deepEqual(await list('?minRating=8&sort=rating'), ['Arrival', 'Paddington 2']);
    assert.deepEqual(await list('?maxRating=2&sort=rating&order=asc'), ['Heat', 'Cats']);
    assert.deepEqual(await list('?sort=rating'), ['Arrival', 'Paddington 2', 'Cats', 'Heat', 'Unrated Thing']);
    assert.deepEqual(await list('?sort=release'), ['Cats', 'Paddington 2', 'Arrival', 'Unrated Thing', 'Heat']);
    assert.deepEqual(await list('?sort=title&order=desc'), ['Unrated Thing', 'Paddington 2', 'Heat', 'Cats', 'Arrival']);
    assert.deepEqual(await list(`?section=${sections[2]!.id}`), ['Arrival']);
    assert.deepEqual(await list('?q=&genre=&sort='), await list(''));
    assert.equal((await call(app, 'GET', '/api/movies?sort=bogus')).status, 400);

    const facets = (await call<{ genres: { name: string; count: number }[]; years: number[] }>(app, 'GET', '/api/movies/facets')).body;
    assert.deepEqual(facets.genres.find((g) => g.name === 'Comedy'), { name: 'Comedy', count: 2 });
    assert.deepEqual(facets.years, [2019, 2017, 2016, 2001, 1995]);
  });

  test('updates movie fields, sections and review', async () => {
    const movie = await seed({ title: 'Draft', genres: ['Thriller'], sectionIds: [sections[1]!.id] });
    assert.equal(movie.review, null);

    const patched = await call<Movie>(app, 'PATCH', `/api/movies/${movie.id}`, {
      title: 'Final Cut',
      releaseDate: '1999-01-01',
      genres: ['Mystery'],
      rating: 7.5,
      review: 'Better on rewatch',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.title, 'Final Cut');
    assert.equal(patched.body.releaseYear, 1999);
    assert.deepEqual(patched.body.genres, ['Mystery']);
    assert.equal(patched.body.rating, 7.5);
    assert.equal(patched.body.review?.body, 'Better on rewatch');
    assert.deepEqual(patched.body.sections.map((s) => s.name), ['Want to Watch'], 'sections untouched when omitted');

    // Orphaned genre "Thriller" is cleaned up
    const facets = (await call<{ genres: { name: string }[] }>(app, 'GET', '/api/movies/facets')).body;
    assert.ok(!facets.genres.some((g) => g.name === 'Thriller'));

    const moved = await call<Movie>(app, 'PUT', `/api/movies/${movie.id}/sections`, {
      sectionIds: [sections[3]!.id, sections[0]!.id],
    });
    assert.deepEqual(moved.body.sections.map((s) => s.name), ['Watched', 'Rewatch']);

    const reviewed = await call<Movie>(app, 'PUT', `/api/movies/${movie.id}/review`, {
      rating: 6,
      body: 'Changed my mind',
      dateWatched: '2025-01-05',
    });
    assert.equal(reviewed.body.rating, 6);
    assert.equal(reviewed.body.review?.dateWatched, '2025-01-05');

    const cleared = await call<Movie>(app, 'DELETE', `/api/movies/${movie.id}/review`);
    assert.equal(cleared.body.rating, null);
    assert.equal(cleared.body.review, null);
    assert.equal(cleared.body.lastReviewedAt, null);
  });

  test('deleting a movie cascades to reviews, ratings and section links', async () => {
    const movie = await seed({ title: 'Temp', rating: 5, review: 'meh', sectionIds: [sections[0]!.id] });
    assert.equal((await call(app, 'DELETE', `/api/movies/${movie.id}`)).status, 204);
    assert.equal((await call(app, 'GET', `/api/movies/${movie.id}`)).status, 404);
    for (const table of ['ratings', 'reviews', 'movie_sections']) {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE movie_id = ?`).get(movie.id)!;
      assert.equal(Number(row.n), 0, table);
    }
  });

  test('deleting a section keeps its movies', async () => {
    const created = await call<Section>(app, 'POST', '/api/sections', { name: 'Temp Section' });
    const movie = await seed({ title: 'Survivor', sectionIds: [created.body.id] });
    await call(app, 'DELETE', `/api/sections/${created.body.id}`);
    const after = await call<Movie>(app, 'GET', `/api/movies/${movie.id}`);
    assert.equal(after.status, 200);
    assert.deepEqual(after.body.sections, []);
  });

  test('stats aggregate the collection', async () => {
    const stats = (await call<Stats>(app, 'GET', '/api/stats')).body;
    assert.equal(stats.totalMovies, 7);
    assert.equal(stats.ratedMovies, 4);
    assert.equal(stats.averageRating, Math.round(((9.3 + 0 + 8.4 + 1.2) / 4) * 100) / 100);
    assert.equal(stats.highestRating, 9.3);
    assert.equal(stats.ratingDistribution.length, 11);
    assert.equal(stats.ratingDistribution[9]!.count, 1);
    assert.equal(stats.highestRated[0]!.title, 'Arrival');
    assert.ok(stats.recentlyReviewed.every((m) => m.lastReviewedAt));
    assert.equal(stats.topGenres[0]!.name, 'Comedy');
    assert.equal(stats.sectionCount, 5);
  });
});

describe('persistence', () => {
  test('data survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'moviesite-'));
    const file = path.join(dir, 'movies.db');
    try {
      const db1 = openDatabase(file);
      const app1 = await buildApp({ db: db1, tmdb: noTmdb });
      await call(app1, 'POST', '/api/movies', { title: 'Persisted', rating: 7 });
      await call(app1, 'POST', '/api/sections', { name: 'Kept' });
      await app1.close();
      db1.close();

      const db2 = openDatabase(file);
      const app2 = await buildApp({ db: db2, tmdb: noTmdb });
      const movies = (await call<Movie[]>(app2, 'GET', '/api/movies')).body;
      const sections = (await call<Section[]>(app2, 'GET', '/api/sections')).body;
      assert.equal(movies[0]?.title, 'Persisted');
      assert.equal(movies[0]?.rating, 7);
      assert.equal(sections.length, 6, 'defaults are not re-seeded');
      await app2.close();
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('tmdb', () => {
  test('reports not configured without a token', async () => {
    const { app } = await setup();
    assert.deepEqual((await call(app, 'GET', '/api/tmdb/status')).body, { configured: false });
    const res = await call<{ error: string }>(app, 'GET', '/api/tmdb/search?q=alien');
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'tmdb_not_configured');
    await app.close();
  });

  test('searches and fetches details via the server-side client', async () => {
    const seen: { url: string; auth: string | undefined }[] = [];
    const fakeFetch = (async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      seen.push({ url: url.toString(), auth: (init?.headers as Record<string, string>)?.authorization });
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
      if (url.pathname.endsWith('/genre/movie/list')) return json({ genres: [{ id: 878, name: 'Science Fiction' }] });
      if (url.pathname.endsWith('/search/movie')) {
        return json({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [{ id: 348, title: 'Alien', release_date: '1979-05-25', poster_path: '/a.jpg', overview: 'In space…', genre_ids: [878] }],
        });
      }
      if (url.pathname.endsWith('/movie/348')) {
        return json({
          id: 348,
          title: 'Alien',
          release_date: '1979-05-25',
          overview: 'In space…',
          poster_path: '/a.jpg',
          backdrop_path: '/b.jpg',
          runtime: 117,
          genres: [{ id: 878, name: 'Science Fiction' }, { id: 27, name: 'Horror' }],
          credits: { crew: [{ job: 'Director', name: 'Ridley Scott' }, { job: 'Writer', name: "Dan O'Bannon" }] },
        });
      }
      return json({ status_message: 'not found' }, 404);
    }) as typeof fetch;

    const { app } = await setup(createTmdbClient({ token: 'eyJfake.token.value', fetchFn: fakeFetch }));

    const search = await call<TmdbSearchResponse>(app, 'GET', '/api/tmdb/search?q=alien');
    assert.equal(search.status, 200);
    assert.deepEqual(search.body.results[0], {
      tmdbId: 348,
      title: 'Alien',
      releaseDate: '1979-05-25',
      releaseYear: 1979,
      posterUrl: 'https://image.tmdb.org/t/p/w500/a.jpg',
      overview: 'In space…',
      genres: ['Science Fiction'],
      inLibraryId: null,
    });
    assert.ok(seen.every((s) => s.auth === 'Bearer eyJfake.token.value' && !s.url.includes('api_key')));

    const details = await call<TmdbMovieDetails>(app, 'GET', '/api/tmdb/movie/348');
    assert.equal(details.body.director, 'Ridley Scott');
    assert.equal(details.body.runtime, 117);
    assert.equal(details.body.backdropUrl, 'https://image.tmdb.org/t/p/w1280/b.jpg');

    const added = await call<Movie>(app, 'POST', '/api/movies', { ...details.body, inLibraryId: undefined, rating: 8 });
    assert.equal(added.status, 201);
    const again = await call<TmdbSearchResponse>(app, 'GET', '/api/tmdb/search?q=alien');
    assert.equal(again.body.results[0]!.inLibraryId, added.body.id);

    assert.equal((await call(app, 'GET', '/api/tmdb/movie/999')).status, 404);
    await app.close();
  });

  test('maps rejected credentials to a clear error and supports v3 keys', async () => {
    let url = '';
    const fetch401 = (async (input: URL | string) => {
      url = String(input);
      return new Response('{}', { status: 401 });
    }) as typeof fetch;
    const { app } = await setup(createTmdbClient({ token: 'v3key123', fetchFn: fetch401 }));
    const res = await call<{ error: string }>(app, 'GET', '/api/tmdb/movie/1');
    assert.equal(res.status, 502);
    assert.equal(res.body.error, 'tmdb_auth');
    assert.ok(url.includes('api_key=v3key123'));
    await app.close();
  });
});
