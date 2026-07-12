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
 * is the user-facing channel, and a quiet-by-default logger is the
 * simplest way to guarantee the one-time `?t=` query-string page load
 * never gets printed to a request log (T-02-20).
 *
 * `buildApp()` never calls `listen()` — the CLI (Plan 06) owns the socket
 * lifecycle.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import type { LaunchContext } from './context.js';
import { registerHostGuard } from './plugins/host-guard.js';
import { registerOriginGuard } from './plugins/origin-guard.js';
import { registerTokenGuard } from './plugins/token-guard.js';
import { buildCorsOptions } from './plugins/cors.js';
import { registerStatic } from './static/serve.js';
import { healthRoutes } from './routes/health.js';

export interface BuildAppOptions {
  ctx: LaunchContext;
  clientRoot: string;
  logger?: boolean | object;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  // 1. Root-scope Host allowlist — covers every route, including static.
  registerHostGuard(app, opts.ctx);

  // 2. Static SPA serving — deliberately OUTSIDE the /api plugin (Pitfall 1).
  await registerStatic(app, opts.clientRoot);

  // 3. Encapsulated /api scope: CORS lock -> Origin guard -> token guard -> routes.
  await app.register(
    async (api) => {
      await api.register(fastifyCors, buildCorsOptions(opts.ctx));
      registerOriginGuard(api, opts.ctx);
      registerTokenGuard(api, opts.ctx);
      await api.register(healthRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
