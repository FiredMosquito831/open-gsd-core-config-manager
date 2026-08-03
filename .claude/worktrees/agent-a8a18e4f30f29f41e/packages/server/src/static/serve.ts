/**
 * Static SPA serving + not-found fallback (02-RESEARCH.md Pattern 1,
 * Pitfall 5; T-02-22 in 02-04-PLAN.md's threat model).
 *
 * Registered by `app.ts` at the ROOT scope, deliberately OUTSIDE the `/api`
 * plugin — this route must never inherit the token guard, or the browser
 * could never load `index.html` to begin with (02-RESEARCH.md Pitfall 1).
 *
 * If `clientRoot` doesn't exist on disk — the normal state in development
 * before `npm run build:client` has ever run — `@fastify/static` is skipped
 * entirely and a minimal inline dev-nudge page is served instead. A server
 * that refuses to boot just because the frontend hasn't been built yet is a
 * needless dev-experience trap, and the CLI (Plan 06) must still start.
 *
 * The not-found handler is the SPA-fallback for client-side routing, but it
 * must never swallow an unmatched `/api/*` path into an HTML response —
 * those get the same JSON error envelope every other guard rejection uses.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const NOT_FOUND_BODY = { ok: false, errors: [{ message: 'Not found' }] };

const DEV_NUDGE_HTML =
  '<!doctype html><html><body><h1>GSD Config Manager</h1>' +
  '<p>The client build has not run yet. Run <code>npm run build:client</code> and restart.</p>' +
  '</body></html>';

function isApiPath(req: FastifyRequest): boolean {
  return req.url.startsWith('/api/');
}

function sendNotFound(req: FastifyRequest, reply: FastifyReply, spaFallback: () => void): void {
  if (isApiPath(req)) {
    reply.code(404).send(NOT_FOUND_BODY);
    return;
  }
  spaFallback();
}

export async function registerStatic(app: FastifyInstance, clientRoot: string): Promise<void> {
  const indexPath = join(clientRoot, 'index.html');

  if (!existsSync(indexPath)) {
    app.get('/', async (_req, reply) => {
      reply.type('text/html').send(DEV_NUDGE_HTML);
    });
    app.setNotFoundHandler((req, reply) => {
      sendNotFound(req, reply, () => {
        reply.code(404).type('text/html').send(DEV_NUDGE_HTML);
      });
    });
    return;
  }

  await app.register(fastifyStatic, {
    root: clientRoot,
    prefix: '/',
  });

  app.setNotFoundHandler((req, reply) => {
    sendNotFound(req, reply, () => {
      reply.sendFile('index.html');
    });
  });
}
