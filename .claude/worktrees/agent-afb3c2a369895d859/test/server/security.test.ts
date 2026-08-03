/**
 * SEC-01/SEC-02/D-04 security suite (02-VALIDATION.md Wave 0 gap,
 * 02-04-PLAN.md Task 1). Drives `buildApp()` purely through
 * `app.inject()` — no real listening socket, no `supertest`/`undici`.
 *
 * `buildApp`/`LaunchContext` do not exist yet at the time this file is
 * written — this suite is RED until Task 2 (context + plugins) and Task 3
 * (app composition) land. That is the intended TDD state.
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
const FAKE_TOKEN = '11111111-1111-4111-8111-111111111111';
const WRONG_TOKEN = '22222222-2222-4222-8222-222222222222';
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
    token: FAKE_TOKEN,
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
      headers: { host: 'evil.example.com', 'x-gsd-token': FAKE_TOKEN },
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
      headers: { host: HOST, 'x-gsd-token': FAKE_TOKEN, origin: 'https://attacker.example' },
    });
    expectForbiddenShape(res);
    expect(res.body).not.toContain('attacker.example');
  });
});

describe('token guard — rejects missing token on reads (SEC-02, D-04)', () => {
  it('rejects missing token on reads', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST },
    });
    expectForbiddenShape(res);
  });
});

describe('token guard — rejects wrong token (SEC-02, D-04)', () => {
  it('rejects wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST, 'x-gsd-token': WRONG_TOKEN },
    });
    expectForbiddenShape(res);
    expect(res.body).not.toContain(WRONG_TOKEN);
  });
});

describe('token guard — accepts a valid token on an allowlisted host (SEC-02)', () => {
  it('accepts a valid token on an allowlisted host', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: HOST, 'x-gsd-token': FAKE_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('static assets — unguarded by token (SEC-02, D-04, Pitfall 1 regression guard)', () => {
  it('serves static assets without a token', async () => {
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

describe('token guard — rejects missing token on the mutation route (SEC-02, literal requirement)', () => {
  it('rejects missing token', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/configs/00000000000000000000000000000000',
      headers: { host: HOST },
      payload: { config: { a: 1 } },
    });
    expectForbiddenShape(res);
  });
});
