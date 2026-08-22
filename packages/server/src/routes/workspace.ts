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
import { WorkspacePersistenceError } from '../workspace-store.js';
import type { ApiErr } from '../api-types.js';
import type { WorkspaceStore, ConfigFileChangeEvent } from '../workspace-store.js';

export interface WorkspaceRoutesOptions {
  workspaceStore: WorkspaceStore;
}

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

function safeWorkspaceError(err: unknown, reply: { code: (status: number) => { send: (body: ApiErr) => unknown } }) {
  if (err instanceof RegistryError) return reply.code(400).send(errBody(err.message));
  if (err instanceof WorkspacePersistenceError) return reply.code(500).send(errBody(err.message));
  throw err;
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

  // SSE endpoint for config file change events
  app.get('/workspace/events', async function (request, reply) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('\n');

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    const close = () => {
      closed = true;
      request.raw.destroy();
    };
    request.raw.on('close', close);
    request.raw.on('error', close);

    // Send initial connected event
    sendEvent('connected', { timestamp: new Date().toISOString() });

    // Subscribe to file change events
    const unsubscribe = workspaceStore.subscribe((event) => {
      if (closed) return;
      sendEvent('file-change', {
        type: event.type,
        configId: event.configId,
        path: event.path,
        timestamp: event.timestamp.toISOString(),
      });
    });

    // Cleanup on close
    request.raw.on('close', () => {
      unsubscribe();
      close();
    });
  });

  app.get('/workspace/configs', async () => {
    const { configs, warning } = workspaceStore.list();
    return { ok: true, configs, ...(warning ? { warning } : {}) };
  });

  app.post<{ Body: { path: string } }>(
    '/workspace/configs/track',
    { schema: { body: TRACK_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = await workspaceStore.add(req.body.path);
        return { ok: true, config };
      } catch (err) {
        return safeWorkspaceError(err, reply);
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/workspace/configs/:id', async (req, reply) => {
    try {
      await workspaceStore.remove(req.params.id);
      return { ok: true };
    } catch (err) {
      return safeWorkspaceError(err, reply);
    }
  });

  app.post<{ Body: { ids: string[] } }>(
    '/workspace/configs/reorder',
    { schema: { body: REORDER_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        await workspaceStore.reorder(req.body.ids);
        return { ok: true };
      } catch (err) {
        return safeWorkspaceError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { path: string } }>(
    '/workspace/configs/:id/locate',
    { schema: { body: LOCATE_BODY_SCHEMA } },
    async (req, reply) => {
      try {
        const config = await workspaceStore.locate(req.params.id, req.body.path);
        return { ok: true, config };
      } catch (err) {
        return safeWorkspaceError(err, reply);
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
