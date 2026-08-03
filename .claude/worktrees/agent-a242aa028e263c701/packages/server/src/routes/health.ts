/**
 * `GET /api/health` (token-guarded, resolves under the `/api` plugin
 * prefix). Proves the full D-05 token flow end to end against a route with
 * no other dependencies — `web/index.html`'s bootstrap script calls exactly
 * this route. Never returns the launch token, never echoes any request
 * header.
 *
 * WR-01 fix: the version is imported as a JSON MODULE (`with { type:
 * 'json' }`), the exact bundle-safe pattern `schema.ts` already uses for
 * the bundled schema — esbuild/tsup inlines the value directly into
 * `dist/cli.js` at build time, so there is no runtime `import.meta.url`/
 * `__dirname` walk at all (the landmine `bootstrap.ts#defaultClientRoot()`
 * documents: that walk resolves correctly only under the from-source
 * layout and lands outside the installed package once bundled, silently
 * falling back to `0.0.0` on every real `npx` install).
 */
import type { FastifyInstance } from 'fastify';
import pkg from '../../../../package.json' with { type: 'json' };

const VERSION = (pkg as { version?: string }).version ?? '0.0.0';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    name: 'gsd-config-manager',
    version: VERSION,
    pid: process.pid,
  }));
}
