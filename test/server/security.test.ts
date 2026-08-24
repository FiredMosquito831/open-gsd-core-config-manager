/**
 * SEC-01/D-06 security suite (02-VALIDATION.md Wave 0 gap, 02-04-PLAN.md
 * Task 1). Drives `buildApp()` purely through `app.inject()` — no real
 * listening socket, no `supertest`/`undici`.
 *
 * The per-launch token guard was removed by owner decision: the server
 * binds loopback only, and the Host allowlist + exact-string Origin guard
 * remain the enforcement boundary. These tests keep guarding THAT boundary.
 *
 * Test titles are load-bearing: 02-VALIDATION.md's Per-Task Verification
 * Map references several of them by `-t "<title>"`, so they are named
 * exactly per 02-04-PLAN.md Task 1's `<behavior>` block.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';
import type { LaunchContext } from '../../packages/server/src/context.js';

const FAKE_PORT = 45999;
const HOST = `127.0.0.1:${FAKE_PORT}`;
const CORS_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;
const FIXTURE_MARKER = 'gsdcm-security-test-fixture';
const FIXTURE_HTML = `<!doctype html><html><body>${FIXTURE_MARKER}</body></html>`;

/** Fresh mkdtempSync fixture dir per test file run — never depends on `dist/client` existing. */
function makeClientRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gsdcm-security-'));
  writeFileSync(join(dir, 'index.html'), FIXTURE_HTML, 'utf8');
  return dir;
}

function makeContext(): LaunchContext {
  return {
    allowedHosts: new Set([HOST, `localhost:${FAKE_PORT}`]),
    corsOrigin: CORS_ORIGIN,
  };
}

/** Every 403 rejection must use this exact envelope shape, per 02-04-PLAN.md must_haves. */
function expectForbiddenShape(res: LightMyRequestResponse): void {
  expect(res.statusCode).toBe(403);
  const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
  expect(body.ok).toBe(false);
  expect(Array.isArray(body.errors)).toBe(true);
  expect(body.errors.length).toBeGreaterThan(0);
  expect(typeof body.errors[0].message).toBe('string');
}

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ ctx: makeContext(), clientRoot: makeClientRoot() });
});

afterEach(async () => {
  await app.close();
});

describe('host guard — rejects bad Host header (SEC-01)', () => {
  it('rejects bad Host header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: 'evil.example.com' },
    });
    expectForbiddenShape(res);
    expect(res.body).not.toContain('evil.example.com');
  });
});

describe('origin guard — rejects cross-origin (SEC-01, D-06)', () => {
  it('rejects cross-origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST, origin: 'https://attacker.example' },
    });
    expectForbiddenShape(res);
    expect(res.body).not.toContain('attacker.example');
  });
});

describe('api reads — served on the loopback host without a launch token', () => {
  it('serves /api/health with no token header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('ignores a stale x-gsd-token header from older clients', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST, 'x-gsd-token': 'stale-token' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('static assets — unguarded (Pitfall 1 regression guard)', () => {
  it('serves static assets', async () => {
    const resRoot = await app.inject({ method: 'GET', url: '/', headers: { host: HOST } });
    expect(resRoot.statusCode).toBe(200);
    expect(resRoot.body).toContain(FIXTURE_MARKER);

    const resIndex = await app.inject({ method: 'GET', url: '/index.html', headers: { host: HOST } });
    expect(resIndex.statusCode).toBe(200);
    expect(resIndex.body).toContain(FIXTURE_MARKER);
  });
});

describe('host guard — protects static assets too (SEC-01, root-scope regression guard)', () => {
  it('rejects bad Host header on static assets too', async () => {
    const res = await app.inject({ method: 'GET', url: '/', headers: { host: 'evil.example.com' } });
    expectForbiddenShape(res);
    expect(res.body).not.toContain('evil.example.com');
  });
});

describe('SPA fallback — unknown non-API route (T-02-22 regression guard)', () => {
  it('unknown non-API path falls back to the SPA shell', async () => {
    const res = await app.inject({ method: 'GET', url: '/some/deep/route', headers: { host: HOST } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(FIXTURE_MARKER);
  });
});

describe('mutation route — reachable on the loopback host', () => {
  it('routes a PUT past the guards to route-level validation', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/configs/00000000000000000000000000000000',
      headers: { host: HOST },
      payload: { config: { a: 1 } },
    });
    // No token guard upstream anymore: whatever comes back comes from the
    // route itself (404 unknown id), NOT a guard-level 403 envelope.
    expect(res.statusCode).not.toBe(403);
  });
});
