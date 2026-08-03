/**
 * Schema REST route (03-02-PLAN.md).
 *
 * GET /api/schema returns the bundle-safe inlined canonical schema in the
 * frozen ApiOk envelope. The route is registered inside the `/api` plugin
 * scope so it inherits the Origin and token guards.
 */
import type { FastifyPluginAsync } from 'fastify';
import { getBundledSchema } from '../schema.js';

export const schemaRoutes: FastifyPluginAsync = async (app) => {
  app.get('/schema', async () => ({ ok: true, schema: getBundledSchema() }));
};
