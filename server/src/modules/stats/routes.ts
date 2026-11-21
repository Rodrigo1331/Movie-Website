import type { FastifyInstance } from 'fastify';
import type { createStatsRepository } from './repository.ts';

export function statsRoutes(deps: { stats: ReturnType<typeof createStatsRepository> }) {
  return async (app: FastifyInstance) => {
    app.get('/stats', async () => deps.stats.get());
  };
}
