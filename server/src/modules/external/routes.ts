import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema, parse } from '../../lib/validation.ts';
import type { ExternalRatingsService } from './service.ts';

const refreshMissingBody = z.object({
  after: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(25).default(10),
});

export function externalRoutes(deps: { external: ExternalRatingsService }) {
  const { external } = deps;
  return async (app: FastifyInstance) => {
    app.get('/external-ratings/status', async () => external.status());

    app.post('/movies/:id/external-ratings', async (req) => external.refresh(parse(idParamSchema, req.params).id));

    app.post('/external-ratings/refresh-missing', async (req) => {
      const { after, limit } = parse(refreshMissingBody, req.body ?? {});
      return external.refreshMissing(after, limit);
    });
  };
}
