import type { FastifyInstance } from 'fastify';
import { idParamSchema, parse, reviewInputSchema } from '../../lib/validation.ts';
import type { MoviesRepository } from '../movies/repository.ts';

/** A movie's personal review = its rating + written review + date watched. */
export function reviewsRoutes(deps: { movies: MoviesRepository }) {
  const { movies } = deps;
  return async (app: FastifyInstance) => {
    app.put('/movies/:id/review', async (req) => {
      const { id } = parse(idParamSchema, req.params);
      const { rating, body, dateWatched, aspectRatings } = parse(reviewInputSchema, req.body);
      return movies.saveReview(id, rating, body, dateWatched ?? null, aspectRatings);
    });

    app.delete('/movies/:id/review', async (req) => movies.deleteReview(parse(idParamSchema, req.params).id));
  };
}
