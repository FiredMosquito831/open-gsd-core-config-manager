/**
 * Schema REST API route suite. Schema lifecycle transitions stay within the
 * existing Host, Origin, and per-launch-token guarded `/api` boundary.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';
import { getBundledSchema } from '../../packages/server/src/schema.js';

const FAKE_PORT = 46002;
const TOKEN = '44444444-4444-4444-8444-444444444444';
const HOST = `127.0.0.1:${FAKE_PORT}`;
const CORS_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;

function makeContext() {
  return {
    token: TOKEN,
    allowedHosts: new Set([HOST, `localhost:${FAKE_PORT}`]),
    corsOrigin: CORS_ORIGIN,
  };
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { host: HOST, 'x-gsd-token': TOKEN, origin: CORS_ORIGIN, ...extra };
}

let app: FastifyInstance;
let clientRoot: string;
let workspaceRoot: string;

beforeEach(async () => {
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-schema-client-'));
  workspaceRoot = mkdtempSync(join(tmpdir(), 'gsdcm-schema-data-'));
  app = await buildApp({ ctx: makeContext(), clientRoot, workspaceRoot });
});

afterEach(async () => {
  await app.close();
  rmSync(clientRoot, { recursive: true, force: true });
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('GET /api/schema', () => {
  it('requires x-gsd-token and returns the active schema keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; schema: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.schema)).toEqual(Object.keys(getBundledSchema()));
  });

  it('rejects a request without the token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema', headers: { host: HOST, origin: CORS_ORIGIN } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ ok: false });
  });
});

describe('schema lifecycle routes', () => {
  it.each([
    { method: 'GET' as const, url: '/api/schema/status' },
    { method: 'POST' as const, url: '/api/schema/refresh' },
    { method: 'POST' as const, url: '/api/schema/reset' },
  ])('remains token, Origin, and Host guarded for $method $url', async ({ method, url }) => {
    expect((await app.inject({ method, url, headers: { host: HOST, origin: CORS_ORIGIN } })).statusCode).toBe(403);
    expect((await app.inject({ method, url, headers: authHeaders({ origin: 'http://evil.invalid' }) })).statusCode).toBe(403);
    expect((await app.inject({ method, url, headers: authHeaders({ host: `evil.invalid:${FAKE_PORT}` }) })).statusCode).toBe(403);
  });

  it('reports only client-safe active status facts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: { source: 'bundled' } });
    expect(res.body).not.toContain(workspaceRoot);
  });

  it('rejects caller-selected refresh source fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/schema/refresh',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      payload: { owner: 'evil', repo: 'fork', url: 'https://evil.invalid', ref: 'x', schema: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ ok: false, errors: [{ message: 'Invalid request body' }] });
  });

  it('accepts no body for refresh and keeps the active schema unchanged on a failed check', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/schema', headers: authHeaders() });
    const refresh = await app.inject({ method: 'POST', url: '/api/schema/refresh', headers: authHeaders() });
    const after = await app.inject({ method: 'GET', url: '/api/schema', headers: authHeaders() });
    expect(refresh.statusCode).toBeGreaterThanOrEqual(200);
    expect(after.json()).toEqual(before.json());
  });

  it('accepts only an opaque proposal identifier for activation and cancellation', async () => {
    const activate = await app.inject({
      method: 'POST', url: '/api/schema/proposals/arbitrary/activate',
      headers: { ...authHeaders(), 'content-type': 'application/json' }, payload: { schema: {}, path: '/sentinel/private' },
    });
    const cancel = await app.inject({
      method: 'DELETE', url: '/api/schema/proposals/arbitrary',
      headers: authHeaders(),
    });
    expect(activate.statusCode).toBe(400);
    expect(activate.body).not.toContain('/sentinel/private');
    expect(cancel.statusCode).toBe(404);
    expect(cancel.json()).toEqual({ ok: false, errors: [{ message: 'Schema proposal is unavailable.' }] });
  });
});
