import { existsSync } from 'node:fs';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { DB } from './db/database.ts';
import { AppError } from './lib/errors.ts';
import { createMoviesRepository } from './modules/movies/repository.ts';
import { moviesRoutes } from './modules/movies/routes.ts';
import { reviewsRoutes } from './modules/reviews/routes.ts';
import { createSectionsRepository } from './modules/sections/repository.ts';
import { sectionsRoutes } from './modules/sections/routes.ts';
import { createStatsRepository } from './modules/stats/repository.ts';
import { statsRoutes } from './modules/stats/routes.ts';
import type { TmdbClient } from './modules/tmdb/client.ts';
import { createOmdbClient, type OmdbClient } from './modules/external/omdb.ts';
import { externalRoutes } from './modules/external/routes.ts';
import { createExternalRatingsService } from './modules/external/service.ts';
import { tmdbRoutes } from './modules/tmdb/routes.ts';

export interface AppOptions {
  db: DB;
  tmdb: TmdbClient;
  /** OMDb client for IMDb / Rotten Tomatoes / Metacritic scores (optional). */
  omdb?: OmdbClient;
  /** If set and the folder exists, the built React app is served from it. */
  clientDistPath?: string;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp(options: AppOptions) {
  const { db, tmdb, omdb = createOmdbClient({ apiKey: null }), clientDistPath, logger = false } = options;
  const app = Fastify({ logger, bodyLimit: 1024 * 1024 });

  const sections = createSectionsRepository(db);
  const movies = createMoviesRepository(db, sections);
  const stats = createStatsRepository(db, movies);
  const external = createExternalRatingsService({ db, movies, tmdb, omdb });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'bad_request', message: (error as Error).message });
    }
    req.log.error(error);
    return reply.code(500).send({ error: 'internal_error', message: 'Something went wrong on the server' });
  });

  await app.register(
    async (api) => {
      api.get('/health', async () => ({ status: 'ok' }));
      await api.register(sectionsRoutes({ sections }));
      await api.register(moviesRoutes({ movies, external }));
      await api.register(externalRoutes({ external }));
      await api.register(reviewsRoutes({ movies }));
      await api.register(statsRoutes({ stats }));
      await api.register(tmdbRoutes({ tmdb, movies }));
    },
    { prefix: '/api' },
  );

  const serveClient = !!clientDistPath && existsSync(clientDistPath);
  if (serveClient) {
    await app.register(fastifyStatic, { root: clientDistPath, wildcard: false });
  }

  app.setNotFoundHandler((req, reply) => {
    if (serveClient && req.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.sendFile('index.html'); // SPA fallback for client-side routes
    }
    return reply.code(404).send({ error: 'not_found', message: `Route ${req.method} ${req.url} not found` });
  });

  return app;
}
