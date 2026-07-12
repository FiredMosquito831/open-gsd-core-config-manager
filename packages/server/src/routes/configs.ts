/**
 * Config REST routes (SAVE-04, SEC-02; 02-API-CONTRACT.md). Registered
 * inside `app.ts`'s encapsulated `/api` plugin scope, so every route here
 * inherits the Origin guard and the token guard automatically — nothing in
 * this file re-implements or bypasses either.
 *
 * `registry.resolve(id)` is the ONLY translation from a client-supplied
 * opaque id to a filesystem path (T-02-05) — the read and write handlers
 * below never see or accept a raw path from the client. `POST
 * /configs/track` is the sole exception, and it delegates the actual
 * validation to `registry.track()` (registry.ts).
 *
 * `PUT /configs/:id` is the only write path in the entire API and performs
 * NO filesystem write itself — it delegates to `saveWithSnapshot`
 * (snapshot-store/save-with-snapshot.ts), which composes Phase 1's frozen
 * `saveConfig`. A `SaveResult` with `ok: false` (a schema-validation
 * failure) maps onto HTTP 422 with the Ajv field errors; the on-disk file
 * is guaranteed byte-unchanged in that case (SAVE-01, enforced inside
 * `saveConfig`, not here).
 */
import type { FastifyPluginAsync } from 'fastify';
import { load } from '../../../config-io/src/index.js';
import { getBundledSchema, getValidator } from '../schema.js';
import { saveWithSnapshot } from '../snapshot-store/save-with-snapshot.js';
import { RegistryError, type ConfigRegistry } from '../registry.js';
import type { ApiErr } from '../api-types.js';

export interface ConfigRoutesOptions {
  registry: ConfigRegistry;
  snapshotRoot?: string;
  warn?: (message: string) => void;
}

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

const TRACK_BODY_SCHEMA = {
  type: 'object',
  required: ['path'],
  properties: { path: { type: 'string' } },
} as const;

const SAVE_BODY_SCHEMA = {
  type: 'object',
  required: ['config'],
  properties: { config: { type: 'object' } },
} as const;

export const configRoutes: FastifyPluginAsync<ConfigRoutesOptions> = async (app, opts) => {
  const { registry, snapshotRoot, warn } = opts;

  app.get('/configs', async () => ({ ok: true, configs: registry.list() }));

  app.post<{ Body: { path: string } }>(
    '/configs/track',
    { schema: { body: TRACK_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = registry.track(req.body.path);
        return { ok: true, config };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>('/configs/:id', async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked) {
      return reply.code(404).send(errBody('Unknown tracked config id'));
    }

    try {
      const data = await load(tracked.path, { schema: getBundledSchema() });
      return { ok: true, data };
    } catch (err) {
      // The registry entry outlived the file on disk (deleted out from
      // under it) — surface the same 404 rather than crashing.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.code(404).send(errBody('Unknown tracked config id'));
      }
      throw err;
    }
  });

  app.put<{ Params: { id: string }; Body: { config: object } }>(
    '/configs/:id',
    { schema: { body: SAVE_BODY_SCHEMA } },
    async (req, reply) => {
      const tracked = registry.resolve(req.params.id);
      if (!tracked) {
        return reply.code(404).send(errBody('Unknown tracked config id'));
      }

      // Only `req.body.config` is ever used — any other body property
      // (e.g. a client-supplied `path`) is ignored, never read as a
      // filesystem target.
      const result = await saveWithSnapshot(tracked.path, req.body.config, getValidator(), {
        root: snapshotRoot,
        warn,
      });

      if (!result.ok) {
        return reply.code(422).send({ ok: false, errors: result.errors });
      }
      return { ok: true, snapshotId: result.snapshotId, warning: result.warning };
    },
  );
};
