/**
 * `GET /api/health` (token-guarded, resolves under the `/api` plugin
 * prefix). Proves the full D-05 token flow end to end against a route with
 * no other dependencies — `web/index.html`'s bootstrap script calls exactly
 * this route. Never returns the launch token, never echoes any request
 * header.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Best-effort read of the root package.json's version; never throws. */
function readPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = readPackageVersion();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    name: 'gsd-config-manager',
    version: VERSION,
    pid: process.pid,
  }));
}
