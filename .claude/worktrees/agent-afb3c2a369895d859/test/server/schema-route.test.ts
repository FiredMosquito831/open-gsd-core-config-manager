/**
 * Schema REST API route suite (03-02-PLAN.md Task 1).
 *
 * GET /api/schema must be token-guarded and return the bundled canonical
 * schema in the frozen ApiOk envelope. The schema is served from the
 * bundle-safe inlined copy, not from a runtime filesystem path.
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
  return { host: HOST, 'x-gsd-token': TOKEN, ...extra };
}

let app: FastifyInstance;
let clientRoot: string;

beforeEach(async () => {
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-schema-client-'));
  app = await buildApp({ ctx: makeContext(), clientRoot });
});

afterEach(async () => {
  await app.close();
  rmSync(clientRoot, { recursive: true, force: true });
});

describe('GET /api/schema', () => {
  it('requires x-gsd-token and returns the bundled schema keys', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/schema',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; schema: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.schema).length).toBeGreaterThan(0);
    expect(Object.keys(body.schema)).toEqual(Object.keys(getBundledSchema()));
  });

  it('rejects a request without the token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/schema',
      headers: { host: HOST },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});
