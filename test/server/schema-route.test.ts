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
import { ActiveSchemaManager } from '../../packages/server/src/active-schema-manager.js';
import { SchemaOverrideStore } from '../../packages/server/src/schema-persistence.js';
import { SchemaRefreshService, type SchemaProposal } from '../../packages/server/src/schema-refresh-service.js';
import { getBundledSchema, getBundledSchemaMetadata } from '../../packages/server/src/schema.js';
import type { SchemaChangeSet } from '../../packages/schema-data/src/source-types.js';

const NO_CHANGES: SchemaChangeSet = {
  changes: [],
  byGroup: { added: [], changed: [], deprecated: [], 'documentation-drift': [] },
};

function proposal(): SchemaProposal {
  return {
    id: 'retryable-proposal',
    expiresAt: '2026-07-22T00:00:00.000Z',
    schema: structuredClone(getBundledSchema()),
    metadata: { ...getBundledSchemaMetadata(), source: 'refreshed' },
    changes: NO_CHANGES,
    documentationDiagnostics: [],
    checkedAt: '2026-07-21T00:00:00.000Z',
    basedOnGeneration: 0,
  };
}

function retainedProposalService(initial: SchemaProposal): SchemaRefreshService {
  let retained: SchemaProposal | undefined = initial;
  return {
    proposal: () => retained,
    cancelProposal: (id: string) => {
      if (!retained || retained.id !== id) return false;
      retained = undefined;
      return true;
    },
    lastChecked: () => undefined,
  } as unknown as SchemaRefreshService;
}

const FAKE_PORT = 46002;
const HOST = `127.0.0.1:${FAKE_PORT}`;
const CORS_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;

function makeContext() {
  return {
    allowedHosts: new Set([HOST, `localhost:${FAKE_PORT}`]),
    corsOrigin: CORS_ORIGIN,
  };
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { host: HOST, origin: CORS_ORIGIN, ...extra };
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
  it('returns the active schema keys on the loopback origin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; schema: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.schema)).toEqual(Object.keys(getBundledSchema()));
  });

  it('serves requests without any token header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema', headers: { host: HOST, origin: CORS_ORIGIN } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });
});

describe('schema lifecycle routes', () => {
  it.each([
    { method: 'GET' as const, url: '/api/schema/status' },
    { method: 'POST' as const, url: '/api/schema/refresh' },
    { method: 'POST' as const, url: '/api/schema/reset' },
  ])('remains Origin- and Host-guarded for $method $url', async ({ method, url }) => {
    expect((await app.inject({ method, url, headers: authHeaders({ origin: 'http://evil.invalid' }) })).statusCode).toBe(403);
    expect((await app.inject({ method, url, headers: authHeaders({ host: `evil.invalid:${FAKE_PORT}` }) })).statusCode).toBe(403);
  });

  it('reports only client-safe active status facts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: { source: 'bundled', generatedAt: expect.any(String) } });
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

  it('retains a proposal after a failed activation write so the same proposal can retry', async () => {
    let writes = 0;
    const manager = await ActiveSchemaManager.create({
      store: new SchemaOverrideStore({ write: async () => {
        writes += 1;
        if (writes === 1) throw new Error('disk unavailable');
      } }),
    });
    const refresh = retainedProposalService(proposal());
    const lifecycleApp = await buildApp({
      ctx: makeContext(), clientRoot, workspaceRoot, activeSchemaManager: manager, schemaRefreshService: refresh,
    });
    try {
      const first = await lifecycleApp.inject({ method: 'POST', url: '/api/schema/proposals/retryable-proposal/activate', headers: { ...authHeaders(), 'content-type': 'application/json' }, payload: {} });
      expect(first.statusCode).toBe(422);
      expect((await lifecycleApp.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() })).json()).toMatchObject({ proposal: { id: 'retryable-proposal' } });

      const retry = await lifecycleApp.inject({ method: 'POST', url: '/api/schema/proposals/retryable-proposal/activate', headers: { ...authHeaders(), 'content-type': 'application/json' }, payload: {} });
      expect(retry.statusCode).toBe(200);
      expect(writes).toBe(2);
      expect((await lifecycleApp.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() })).json()).not.toHaveProperty('proposal');
    } finally {
      await lifecycleApp.close();
    }
  });

  it('clears a retained proposal after reset and makes its activation unavailable', async () => {
    const manager = await ActiveSchemaManager.create({ store: new SchemaOverrideStore({ remove: async () => {} }) });
    const refresh = retainedProposalService(proposal());
    const lifecycleApp = await buildApp({
      ctx: makeContext(), clientRoot, workspaceRoot, activeSchemaManager: manager, schemaRefreshService: refresh,
    });
    try {
      expect((await lifecycleApp.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() })).json()).toMatchObject({ proposal: { id: 'retryable-proposal' } });
      expect((await lifecycleApp.inject({ method: 'POST', url: '/api/schema/reset', headers: { ...authHeaders(), 'content-type': 'application/json' }, payload: {} })).statusCode).toBe(200);
      expect((await lifecycleApp.inject({ method: 'GET', url: '/api/schema/status', headers: authHeaders() })).json()).not.toHaveProperty('proposal');
      const activation = await lifecycleApp.inject({ method: 'POST', url: '/api/schema/proposals/retryable-proposal/activate', headers: { ...authHeaders(), 'content-type': 'application/json' }, payload: {} });
      expect(activation.statusCode).toBe(404);
      expect(activation.json()).toEqual({ ok: false, errors: [{ message: 'Schema proposal is unavailable.' }] });
    } finally {
      await lifecycleApp.close();
    }
  });
});
