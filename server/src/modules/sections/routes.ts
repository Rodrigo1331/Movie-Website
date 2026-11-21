import type { FastifyInstance } from 'fastify';
import { idParamSchema, parse, sectionCreateSchema, sectionOrderSchema, sectionUpdateSchema } from '../../lib/validation.ts';
import type { SectionsRepository } from './repository.ts';

export function sectionsRoutes(deps: { sections: SectionsRepository }) {
  const { sections } = deps;
  return async (app: FastifyInstance) => {
    app.get('/sections', async () => sections.list());

    app.post('/sections', async (req, reply) => {
      const { name } = parse(sectionCreateSchema, req.body);
      reply.code(201);
      return sections.create(name);
    });

    app.put('/sections/order', async (req) => sections.reorder(parse(sectionOrderSchema, req.body).ids));

    app.get('/sections/:id', async (req) => sections.get(parse(idParamSchema, req.params).id));

    app.patch('/sections/:id', async (req) => {
      const { id } = parse(idParamSchema, req.params);
      const { name } = parse(sectionUpdateSchema, req.body ?? {});
      return name === undefined ? sections.get(id) : sections.rename(id, name);
    });

    app.delete('/sections/:id', async (req, reply) => {
      sections.delete(parse(idParamSchema, req.params).id);
      reply.code(204).send();
    });
  };
}
