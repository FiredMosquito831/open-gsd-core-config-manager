/**
 * Workspace REST routes (03-02-PLAN.md).
 *
 * Additive /api/workspace/* routes for persistent tracking, folder scan, and
 * create-from-defaults. All filesystem paths are validated by the workspace
 * store, which delegates to `registry.track()` / `registry.relocate()`. The
 * routes return the frozen ApiOk/ApiErr envelopes and are registered inside
 * the `/api` plugin scope so they inherit Origin and token guards.
 */
import type { FastifyPluginAsync } from 'fastify';
import { RegistryError } from '../registry.js';
import type { ApiErr } from '../api-types.js';
import type { WorkspaceStore } from '../workspace-store.js';

export interface WorkspaceRoutesOptions {
  workspaceStore: WorkspaceStore;
}

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

const TRACK_BODY_SCHEMA = {
  type: 'object',
  required: ['path'],
  properties: { path: { type: 'string' } },
} as const;

const REORDER_BODY_SCHEMA = {
  type: 'object',
  required: ['ids'],
  properties: {
    ids: { type: 'array', items: { type: 'string' } },
  },
} as const;

const LOCATE_BODY_SCHEMA = {
  type: 'object',
  required: ['path'],
  properties: { path: { type: 'string' } },
} as const;

const SCAN_BODY_SCHEMA = {
  type: 'object',
  required: ['rootPath'],
  properties: { rootPath: { type: 'string' } },
} as const;

const CREATE_PREVIEW_BODY_SCHEMA = {
  type: 'object',
  required: ['projectDir'],
  properties: { projectDir: { type: 'string' } },
} as const;

const CREATE_BODY_SCHEMA = {
  type: 'object',
  required: ['projectDir', 'overwrite'],
  properties: {
    projectDir: { type: 'string' },
    overwrite: { type: 'boolean' },
  },
} as const;

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRoutesOptions> = async (app, opts) => {
  const { workspaceStore } = opts;

  app.get('/workspace/configs', async () => ({
    ok: true,
    configs: workspaceStore.list(),
  }));

  app.post<{ Body: { path: string } }>(
    '/workspace/configs/track',
    { schema: { body: TRACK_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = workspaceStore.add(req.body.path);
        return { ok: true, config };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/workspace/configs/:id', async (req, reply) => {
    try {
      workspaceStore.remove(req.params.id);
      return { ok: true };
    } catch (err) {
      if (err instanceof RegistryError) {
        return reply.code(400).send(errBody(err.message));
      }
      throw err;
    }
  });

  app.post<{ Body: { ids: string[] } }>(
    '/workspace/configs/reorder',
    { schema: { body: REORDER_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        workspaceStore.reorder(req.body.ids);
        return { ok: true };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { path: string } }>(
    '/workspace/configs/:id/locate',
    { schema: { body: LOCATE_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = workspaceStore.locate(req.params.id, req.body.path);
        return { ok: true, config };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.post<{ Body: { rootPath: string } }>(
    '/workspace/scan',
    { schema: { body: SCAN_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        // Asynchronous on purpose: see packages/server/src/workspace-store.ts
        // (scan()). The scan awaits fs/promises.readdir/lstat between dirs so
        // this handler does NOT block the Fastify event loop, which is what
        // previously starved /api/schema/status, /api/workspace/configs and
        // /api/health and surfaced the "vschema unavailable" sidebar brick.
        const { candidates, truncated, scannedDirs } = await workspaceStore.scan(req.body.rootPath);
        return { ok: true, candidates, ...(truncated ? { truncated: true, scannedDirs } : {}) };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.post<{ Body: { projectDir: string } }>(
    '/workspace/configs/create-preview',
    { schema: { body: CREATE_PREVIEW_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const { targetPath, exists } = workspaceStore.createPreview(req.body.projectDir);
        return { ok: true, targetPath, exists };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );

  app.post<{ Body: { projectDir: string; overwrite: boolean } }>(
    '/workspace/configs/create',
    { schema: { body: CREATE_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = await workspaceStore.create(req.body.projectDir, req.body.overwrite);
        return { ok: true, config };
      } catch (err) {
        if (err instanceof RegistryError) {
          return reply.code(400).send(errBody(err.message));
        }
        throw err;
      }
    },
  );
};
