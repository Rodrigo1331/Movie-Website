import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ExternalRefreshResult, ExternalStatus, Movie, Stats } from '@moviesite/shared';
import { buildApp } from '../src/app.ts';
import { openDatabase } from '../src/db/database.ts';
import { createOmdbClient, parseOmdb } from '../src/modules/external/omdb.ts';
import { createTmdbClient } from '../src/modules/tmdb/client.ts';
import { correlation } from '../src/modules/stats/repository.ts';

type App = Awaited<ReturnType<typeof buildApp>>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Fake TMDB + OMDb backends. OMDb answers per IMDb id or title; `omdbMode` simulates key problems. */
function fakeServices(options: { omdbMode?: 'ok' | 'invalid-key' | 'limit' } = {}) {
  const calls: string[] = [];
  const omdbByImdb: Record<string, object> = {
    tt0133093: {
      Response: 'True',
      imdbID: 'tt0133093',
      imdbRating: '8.7',
      imdbVotes: '2,123,456',
      Metascore: '73',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.7/10' },
        { Source: 'Rotten Tomatoes', Value: '83%' },
        { Source: 'Metacritic', Value: '73/100' },
      ],
    },
  };
  const fetchFn = (async (input: URL | string) => {
    const url = new URL(String(input));
    calls.push(url.host + url.pathname + url.search);
    if (url.host === 'api.themoviedb.org') {
      if (url.pathname === '/3/movie/603') return json({ id: 603, title: 'The Matrix', imdb_id: 'tt0133093', vote_average: 8.217, vote_count: 26000 });
      return json({}, 404);
    }
    if (options.omdbMode === 'invalid-key') return json({ Response: 'False', Error: 'Invalid API key!' }, 401);
    if (options.omdbMode === 'limit') return json({ Response: 'False', Error: 'Request limit reached!' }, 401);
    const id = url.searchParams.get('i');
    if (id && omdbByImdb[id]) return json(omdbByImdb[id]);
    if (url.searchParams.get('t') === 'Paddington 2') {
      return json({ Response: 'True', imdbID: 'tt4468740', imdbRating: '7.8', imdbVotes: '90,000', Metascore: '88', Ratings: [{ Source: 'Rotten Tomatoes', Value: '99%' }] });
    }
    return json({ Response: 'False', Error: 'Movie not found!' });
  }) as typeof fetch;
  return {
    calls,
    tmdb: createTmdbClient({ token: 'eyJfake.token', fetchFn }),
    omdb: createOmdbClient({ apiKey: 'omdbkey1', fetchFn }),
  };
}

async function call<T = unknown>(app: App, method: string, url: string, payload?: unknown) {
  const res = await app.inject({ method: method as 'GET', url, payload: payload as object });
  return { status: res.statusCode, body: (res.body ? res.json() : undefined) as T };
}

describe('OMDb parsing', () => {
  test('reads IMDb, Rotten Tomatoes and Metacritic values and ignores N/A', () => {
    assert.deepEqual(
      parseOmdb({ Response: 'True', imdbID: 'tt1', imdbRating: '7.1', imdbVotes: '1,234', Metascore: 'N/A', Ratings: [{ Source: 'Rotten Tomatoes', Value: '64%' }, { Source: 'Metacritic', Value: '58/100' }] }),
      { imdbId: 'tt1', imdbRating: 7.1, imdbVotes: 1234, rottenTomatoes: 64, metacritic: 58 },
    );
    assert.deepEqual(parseOmdb({ Response: 'True', imdbRating: 'N/A' }), { imdbId: null, imdbRating: null, imdbVotes: null, rottenTomatoes: null, metacritic: null });
  });

  test('correlation needs three points and variation', () => {
    assert.equal(correlation([1, 2], [1, 2]), null);
    assert.equal(correlation([1, 2, 3], [2, 4, 6]), 1);
    assert.equal(correlation([1, 2, 3], [3, 2, 1]), -1);
    assert.equal(correlation([5, 5, 5], [1, 2, 3]), null);
  });
});

describe('external ratings', () => {
  test('fetches scores when a movie is added, via TMDB → IMDb id → OMDb', async () => {
    const svc = fakeServices();
    const app = await buildApp({ db: openDatabase(':memory:'), tmdb: svc.tmdb, omdb: svc.omdb });

    const { status, body } = await call<Movie>(app, 'POST', '/api/movies', { title: 'The Matrix', tmdbId: 603, rating: 9.5 });
    assert.equal(status, 201);
    assert.deepEqual({ ...body.externalRatings, fetchedAt: undefined }, {
      imdbId: 'tt0133093',
      imdb: 8.7,
      imdbVotes: 2123456,
      rottenTomatoes: 83,
      metacritic: 73,
      tmdb: 8.2,
      tmdbVotes: 26000,
      fetchedAt: undefined,
    });
    assert.ok(svc.calls.some((c) => c.includes('i=tt0133093')), 'OMDb looked up by IMDb id');
    assert.ok(!svc.calls.some((c) => c.includes('apikey') && c.includes('themoviedb')), 'OMDb key never sent to TMDB');

    // Manual entries without a TMDB id fall back to title + year
    const manual = await call<Movie>(app, 'POST', '/api/movies', { title: 'Paddington 2', releaseYear: 2017, rating: 8 });
    assert.equal(manual.body.externalRatings?.imdb, 7.8);
    assert.equal(manual.body.externalRatings?.rottenTomatoes, 99);

    // A film OMDb doesn't know still gets a row (so bulk refresh won't retry it forever)
    const unknown = await call<Movie>(app, 'POST', '/api/movies', { title: 'My Home Video', rating: 3 });
    assert.equal(unknown.body.externalRatings?.imdb, null);

    const stats = (await call<Stats>(app, 'GET', '/api/stats')).body.comparison;
    assert.equal(stats.compared, 2);
    assert.equal(stats.myAverage, 8.75);
    assert.equal(stats.imdbAverage, 8.25);
    assert.equal(stats.averageGap, 0.5);
    assert.equal(stats.points.find((p) => p.title === 'The Matrix')?.critics, 7.3);
    assert.equal(stats.points.find((p) => p.title === 'Paddington 2')?.critics, 8.8);

    const byGap = (await call<Movie[]>(app, 'GET', '/api/movies?sort=imdbGap')).body.map((m) => m.title);
    assert.deepEqual(byGap, ['The Matrix', 'Paddington 2', 'My Home Video']);
    await app.close();
  });

  test('adding a movie still works when OMDb rejects the key', async () => {
    const svc = fakeServices({ omdbMode: 'invalid-key' });
    const app = await buildApp({ db: openDatabase(':memory:'), tmdb: svc.tmdb, omdb: svc.omdb });
    const created = await call<Movie>(app, 'POST', '/api/movies', { title: 'The Matrix', tmdbId: 603 });
    assert.equal(created.status, 201);
    assert.equal(created.body.externalRatings, null);

    const refresh = await call<{ error: string }>(app, 'POST', `/api/movies/${created.body.id}/external-ratings`);
    assert.equal(refresh.status, 502);
    assert.equal(refresh.body.error, 'omdb_auth');
    await app.close();
  });

  test('bulk refresh fills in missing films in batches and stops on the daily limit', async () => {
    const db = openDatabase(':memory:');
    // Add films with no outside services so they start without scores
    const offline = await buildApp({ db, tmdb: createTmdbClient({ token: null }) });
    for (const title of ['The Matrix', 'Paddington 2', 'Unknown Film']) {
      await call(offline, 'POST', '/api/movies', { title, tmdbId: title === 'The Matrix' ? 603 : null });
    }
    assert.equal((await call<ExternalStatus>(offline, 'GET', '/api/external-ratings/status')).body.missing, 3);
    assert.equal((await call(offline, 'POST', '/api/external-ratings/refresh-missing', {})).status, 503);
    await offline.close();

    const svc = fakeServices();
    const app = await buildApp({ db, tmdb: svc.tmdb, omdb: svc.omdb });
    const first = (await call<ExternalRefreshResult>(app, 'POST', '/api/external-ratings/refresh-missing', { limit: 2 })).body;
    assert.deepEqual({ ...first, nextAfter: undefined }, { updated: 2, failed: 0, remaining: 1, stoppedReason: null, nextAfter: undefined });
    const second = (await call<ExternalRefreshResult>(app, 'POST', '/api/external-ratings/refresh-missing', { after: first.nextAfter })).body;
    assert.equal(second.updated, 1);
    assert.equal(second.remaining, 0);
    const status = (await call<ExternalStatus>(app, 'GET', '/api/external-ratings/status')).body;
    assert.deepEqual(status, { omdb: true, tmdb: true, missing: 0 });
    await app.close();

    const limited = fakeServices({ omdbMode: 'limit' });
    const app2 = await buildApp({ db, tmdb: limited.tmdb, omdb: limited.omdb });
    await call(app2, 'POST', '/api/movies', { title: 'Another' }); // fails quietly, stays missing
    const res = await call<{ error: string }>(app2, 'POST', '/api/external-ratings/refresh-missing', {});
    assert.equal(res.status, 429);
    assert.equal(res.body.error, 'omdb_rate_limited');
    await app2.close();
  });
});
