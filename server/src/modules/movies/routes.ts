import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { idParamSchema, listQuerySchema, movieInputSchema, movieSectionsSchema, movieUpdateSchema, parse } from '../../lib/validation.ts';
import type { MovieChanges, MovieFields, MoviesRepository } from './repository.ts';

type MovieInput = z.output<typeof movieInputSchema>;

function splitInput(input: MovieInput): { fields: MovieFields; relations: MovieChanges } {
  const { genres, rating, aspectRatings, review, dateWatched, sectionIds, ...f } = input;
  return {
    fields: {
      tmdbId: f.tmdbId ?? null,
      title: f.title,
      releaseDate: f.releaseDate ?? null,
      releaseYear: f.releaseYear ?? null,
      director: f.director ?? null,
      description: f.description ?? null,
      posterUrl: f.posterUrl ?? null,
      backdropUrl: f.backdropUrl ?? null,
      runtime: f.runtime ?? null,
    },
    relations: { genres: genres ?? [], rating: rating ?? null, aspectRatings, review, dateWatched, sectionIds: sectionIds ?? [] },
  };
}

export function moviesRoutes(deps: { movies: MoviesRepository }) {
  const { movies } = deps;
  return async (app: FastifyInstance) => {
    app.get('/movies', async (req) => movies.list(parse(listQuerySchema, req.query)));

    app.get('/movies/facets', async () => movies.facets());

    app.get('/movies/:id', async (req) => movies.get(parse(idParamSchema, req.params).id));

    app.post('/movies', async (req, reply) => {
      const { fields, relations } = splitInput(parse(movieInputSchema, req.body));
      reply.code(201);
      return movies.create(fields, relations);
    });

    app.patch('/movies/:id', async (req) => {
      const { id } = parse(idParamSchema, req.params);
      return movies.update(id, parse(movieUpdateSchema, req.body ?? {}));
    });

    app.delete('/movies/:id', async (req, reply) => {
      movies.delete(parse(idParamSchema, req.params).id);
      reply.code(204).send();
    });

    app.put('/movies/:id/sections', async (req) => {
      const { id } = parse(idParamSchema, req.params);
      return movies.setSections(id, parse(movieSectionsSchema, req.body).sectionIds);
    });
  };
}
