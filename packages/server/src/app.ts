/**
 * `buildApp()` — the Fastify composition root (02-RESEARCH.md Pattern 1).
 *
 * Registration order is load-bearing:
 *   1. Host allowlist (`host-guard.ts`) at the ROOT scope, first — the
 *      cheapest check, and a browser cannot forge `Host`, so it must cover
 *      static assets too (DNS-rebinding defense for the whole app, not
 *      just `/api`).
 *   2. Static serving (`static/serve.ts`) at the ROOT scope, deliberately
 *      OUTSIDE any `/api` plugin — this is the single most important
 *      structural decision in this file. If the token guard were ever
 *      registered here instead of inside the `/api` plugin, the browser
 *      could never load `index.html` to get the token in the first place
 *      (02-RESEARCH.md Pitfall 1).
 *   3. An encapsulated `/api`-prefixed plugin registering, IN ORDER:
 *      `@fastify/cors` (so its own preflight `OPTIONS` handling
 *      short-circuits before any guard hook runs) -> origin-guard ->
 *      token-guard -> the health route. Fastify's plugin encapsulation is
 *      what scopes both hooks to `/api/*` only — nothing inside this
 *      plugin can affect the static routes registered in step 2.
 *
 * The logger defaults to OFF: the CLI's own stdout banner (02-UI-SPEC.md)
 * is the user-facing channel, and a quiet-by-default logger keeps request
 * noise out of the terminal.
 *
 * `buildApp()` never calls `listen()` — the CLI (Plan 06) owns the socket
 * lifecycle.
 */
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import type { LaunchContext } from './context.js';
import { registerHostGuard } from './plugins/host-guard.js';
import { registerOriginGuard } from './plugins/origin-guard.js';
import { buildCorsOptions } from './plugins/cors.js';
import { registerStatic } from './static/serve.js';
import { healthRoutes } from './routes/health.js';
import { configRoutes } from './routes/configs.js';
import { historyRoutes } from './routes/history.js';
import { schemaRoutes } from './routes/schema.js';
import { workspaceRoutes } from './routes/workspace.js';
import { pickerRoutes } from './routes/picker.js';
import { keysRoutes } from './routes/keys.js';
import { createRegistry, type ConfigRegistry } from './registry.js';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store.js';
import { ActiveSchemaManager } from './active-schema-manager.js';
import { defaultRefreshDependencies, SchemaRefreshService } from './schema-refresh-service.js';

// Exposes the tracked-config registry on the built FastifyInstance (Plan 05)
// so the CLI (Plan 06) can reach the same registry instance `buildApp`
// constructed, without changing `buildApp`'s return type.
declare module 'fastify' {
  interface FastifyInstance {
    configRegistry: ConfigRegistry;
  }
}

export interface BuildAppOptions {
  ctx: LaunchContext;
  clientRoot: string;
  logger?: boolean | object;
  /** Pre-existing registry to reuse (defaults to a fresh `createRegistry()`). */
  registry?: ConfigRegistry;
  /** Pre-existing workspace store to reuse. */
  workspaceStore?: WorkspaceStore;
  /** Injected app-data root for workspace persistence and snapshot store (test seam). */
  workspaceRoot?: string;
  /** Injected app-data root for `saveWithSnapshot` (test seam — see snapshot-store/paths.ts). */
  snapshotRoot?: string;
  /** Sink for saveWithSnapshot's D-12 non-fatal snapshot-failure warning (defaults to console.warn). */
  warn?: (message: string) => void;
  /** One injected authoritative schema manager shared by every schema-sensitive operation. */
  activeSchemaManager?: ActiveSchemaManager;
  /** One injected fixed-source refresh transaction service. */
  schemaRefreshService?: SchemaRefreshService;
  /** Test seam for deterministic lifecycle timestamps. */
  now?: () => Date;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const warn = opts.warn ?? console.warn;
  const activeSchemaManager = opts.activeSchemaManager ?? await ActiveSchemaManager.create({ appDataRoot: opts.workspaceRoot, now: opts.now, warn });
  const workspaceStore = opts.workspaceStore ?? createWorkspaceStore({ appDataRoot: opts.workspaceRoot, activeSchemaManager });
  const registry = opts.registry ?? workspaceStore.registry;
  app.decorate('configRegistry', registry);

  // Start file watching for external config changes
  workspaceStore.startWatching();
  const schemaRefreshService = opts.schemaRefreshService ?? new SchemaRefreshService({
    ...defaultRefreshDependencies(),
    activeSchema: () => activeSchemaManager.snapshot().schema,
    activeMetadata: () => activeSchemaManager.snapshot().metadata,
    activeGeneration: () => activeSchemaManager.currentGeneration(),
    now: opts.now ?? (() => new Date()),
  });

  // Project-wide error handler (CR-01 fix): every guard above sends its own
  // `reply.code(403).send(...)` directly rather than throwing, so this
  // handler never sees — and never overrides — the guards' 403 envelopes.
  // It only ever catches a genuinely UNEXPECTED thrown error (e.g. a
  // non-ENOENT filesystem error or a JSON-parse failure from `load()`,
  // which embeds the absolute config path in `err.message` — see
  // config-io/src/load.ts). The real error is logged server-side only; the
  // client always gets a fixed, static, path-free message (T-02-19/T-02-25
  // Information Disclosure guard).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.validation) {
      return reply.code(400).send({ ok: false, errors: [{ message: 'Invalid request body' }] });
    }
    warn(`Unhandled error on ${req.method} ${req.url}: ${err.message}`);
    return reply.code(500).send({ ok: false, errors: [{ message: 'Internal error' }] });
  });

  // 1. Root-scope Host allowlist — covers every route, including static.
  registerHostGuard(app, opts.ctx);

  // 2. Static SPA serving — deliberately OUTSIDE the /api plugin (Pitfall 1).
  await registerStatic(app, opts.clientRoot);

  // 3. Encapsulated /api scope: CORS lock -> Origin guard -> routes.
  //    No per-launch token guard: the server binds 127.0.0.1 only and the
  //    Host + Origin guards already cover cross-origin/cross-host callers.
  await app.register(
    async (api) => {
      await api.register(fastifyCors, buildCorsOptions(opts.ctx));
      registerOriginGuard(api, opts.ctx);
      await api.register(healthRoutes);
      await api.register(schemaRoutes, { activeSchemaManager, schemaRefreshService });
      await api.register(configRoutes, { registry, activeSchemaManager, snapshotRoot: opts.snapshotRoot, warn: opts.warn });
      await api.register(historyRoutes, { registry, activeSchemaManager, snapshotRoot: opts.snapshotRoot, warn: opts.warn });
      await api.register(workspaceRoutes, { workspaceStore });
      await api.register(pickerRoutes, { warn });
      await api.register(keysRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
