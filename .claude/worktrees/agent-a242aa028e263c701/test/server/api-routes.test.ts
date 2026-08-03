/**
 * Config REST API route suite (02-05-PLAN.md Task 2 — SAVE-04 end to end
 * over HTTP, the registry's path-traversal boundary, and the 422
 * validation gate).
 *
 * `configRoutes` do not exist yet at the time this file is written — this
 * suite is RED until Task 3 registers the four routes inside `buildApp()`'s
 * `/api` scope. That is the intended TDD state.
 *
 * Drives `buildApp()` purely through `app.inject()` — no real listening
 * socket, no HTTP client library — with a valid `x-gsd-token` on every
 * request. Each test gets a fresh `mkdtempSync` project dir (a copy of
 * `test/fixtures/project-config.json`, never mutated in place) and a fresh
 * `mkdtempSync` app-data root, injected into `buildApp` via the
 * `snapshotRoot` option (Task 3's extension to `BuildAppOptions`) rather
 * than mocking `env-paths`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';
import type { LaunchContext } from '../../packages/server/src/context.js';

const FAKE_PORT = 46001;
const TOKEN = '33333333-3333-4333-8333-333333333333';
const HOST = `127.0.0.1:${FAKE_PORT}`;
const CORS_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;

const FIXTURE_PATH = join(process.cwd(), 'test', 'fixtures', 'project-config.json');
const FIXTURE_RAW = readFileSync(FIXTURE_PATH, 'utf8');

function makeContext(): LaunchContext {
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
let projectDir: string;
let appDataRoot: string;
let clientRoot: string;
let configPath: string;

beforeEach(async () => {
  projectDir = mkdtempSync(join(tmpdir(), 'gsdcm-api-routes-project-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-api-routes-appdata-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-api-routes-client-'));
  configPath = join(projectDir, 'config.json');
  writeFileSync(configPath, FIXTURE_RAW, 'utf8');

  app = await buildApp({ ctx: makeContext(), clientRoot, snapshotRoot: appDataRoot, workspaceRoot: appDataRoot });
});

afterEach(async () => {
  await app.close();
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(appDataRoot, { recursive: true, force: true });
  rmSync(clientRoot, { recursive: true, force: true });
});

/** Tracks `configPath` via the real HTTP route and returns its minted id. */
async function trackConfig(path: string = configPath): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/configs/track',
    headers: authHeaders(),
    payload: { path },
  });
  const body = res.json() as { ok: boolean; config: { id: string } };
  return body.config.id;
}

describe('POST /api/configs/track — tracks an absolute config path and returns a stable id', () => {
  it('tracks an absolute config path and returns a stable id', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/configs/track',
      headers: authHeaders(),
      payload: { path: configPath },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { ok: boolean; config: { id: string; path: string; name: string } };
    expect(firstBody.ok).toBe(true);
    expect(typeof firstBody.config.id).toBe('string');
    expect(firstBody.config.id.length).toBeGreaterThan(0);

    const second = await app.inject({
      method: 'POST',
      url: '/api/configs/track',
      headers: authHeaders(),
      payload: { path: configPath },
    });
    const secondBody = second.json() as { ok: boolean; config: { id: string } };
    expect(secondBody.config.id).toBe(firstBody.config.id);

    const list = await app.inject({ method: 'GET', url: '/api/configs', headers: authHeaders() });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { ok: boolean; configs: Array<{ id: string }> };
    expect(listBody.configs).toHaveLength(1);
    expect(listBody.configs[0].id).toBe(firstBody.config.id);
  });
});

describe('POST /api/configs/track — rejects a relative path on track', () => {
  it('rejects a relative path on track', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/configs/track',
      headers: authHeaders(),
      payload: { path: 'config.json' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(res.body).not.toContain('config.json');
    expect(typeof body.errors[0].message).toBe('string');
  });
});

describe('POST /api/configs/track — rejects a traversal path on track', () => {
  it('rejects a traversal path on track', async () => {
    const traversal = await app.inject({
      method: 'POST',
      url: '/api/configs/track',
      headers: authHeaders(),
      payload: { path: join(projectDir, '..', '..', 'etc', 'passwd') },
    });
    expect(traversal.statusCode).toBe(400);

    const nonJson = await app.inject({
      method: 'POST',
      url: '/api/configs/track',
      headers: authHeaders(),
      payload: { path: join(projectDir, 'notes.txt') },
    });
    expect(nonJson.statusCode).toBe(400);
  });
});

describe('GET /api/configs/:id — rejects an unknown config id', () => {
  it('rejects an unknown config id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/configs/deadbeef',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe('GET /api/configs/:id — loads a tracked config with effective values and provenance', () => {
  it('loads a tracked config with effective values and provenance', async () => {
    const id = await trackConfig();

    const res = await app.inject({ method: 'GET', url: `/api/configs/${id}`, headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      ok: boolean;
      data: { raw: { project: Record<string, unknown> }; effective: object; unknown: unknown[]; meta: object };
    };
    expect(body.ok).toBe(true);
    expect(body.data.raw.project).toBeTruthy();
    expect(body.data.raw.project.mode).toBe('interactive');
    expect(body.data.effective).toBeTruthy();
    expect(Array.isArray(body.data.unknown)).toBe(true);
    expect(body.data.meta).toBeTruthy();
  });
});

describe('PUT /api/configs/:id — saves a tracked config and records a snapshot', () => {
  it('saves a tracked config and records a snapshot', async () => {
    const id = await trackConfig();
    const original = JSON.parse(FIXTURE_RAW) as Record<string, unknown>;
    const workflow = original.workflow as Record<string, unknown>;
    const modified = { ...original, workflow: { ...workflow, tdd_mode: true } };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/configs/${id}`,
      headers: authHeaders(),
      payload: { config: modified },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; snapshotId?: string; warning?: string };
    expect(body.ok).toBe(true);
    expect(typeof body.snapshotId).toBe('string');
    expect(body.snapshotId!.length).toBeGreaterThan(0);

    const onDisk = JSON.parse(readFileSync(configPath, 'utf8')) as { workflow: { tdd_mode: boolean } };
    expect(onDisk.workflow.tdd_mode).toBe(true);

    // A snapshot of the PREVIOUS content must exist somewhere under the
    // injected app-data root (exact layout owned by snapshot-store).
    const { snapshotDirFor } = await import('../../packages/server/src/snapshot-store/paths.js');
    const dir = snapshotDirFor(configPath, appDataRoot);
    expect(existsSync(join(dir, 'index.json'))).toBe(true);
  });
});

describe('PUT /api/configs/:id — returns 422 with field errors when the saved config fails schema validation', () => {
  it('returns 422 with field errors when the saved config fails schema validation', async () => {
    const id = await trackConfig();
    const original = JSON.parse(FIXTURE_RAW) as Record<string, unknown>;
    const workflow = original.workflow as Record<string, unknown>;
    const invalid = { ...original, workflow: { ...workflow, code_review_depth: 'not-a-valid-depth' } };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/configs/${id}`,
      headers: authHeaders(),
      payload: { config: invalid },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { ok: boolean; errors: object[] };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);

    expect(readFileSync(configPath, 'utf8')).toBe(FIXTURE_RAW);
  });
});

describe('GET /api/configs/:id — a non-ENOENT read failure never leaks the absolute path (CR-01)', () => {
  it('a non-ENOENT read failure never leaks the absolute path', async () => {
    const id = await trackConfig();
    // Corrupt the tracked file so load()'s JSON.parse fails — config-io's
    // load.ts embeds the absolute path in that thrown error's message.
    writeFileSync(configPath, '{ not valid json', 'utf8');

    const res = await app.inject({ method: 'GET', url: `/api/configs/${id}`, headers: authHeaders() });
    expect(res.statusCode).toBe(500);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
    // No absolute path anywhere in the response body.
    expect(res.body).not.toContain(configPath);
    expect(res.body).not.toContain(projectDir);
  });
});

describe('GET /api/configs/:id — a tracked path replaced by a directory returns the same 404 (WR-02)', () => {
  it('a tracked path replaced by a directory returns the same 404', async () => {
    const id = await trackConfig();
    // Simulate the tracked path stopping being a regular file between
    // track() and this request — swap it for a directory.
    const { rmSync, mkdirSync } = await import('node:fs');
    rmSync(configPath, { force: true });
    mkdirSync(configPath);

    const res = await app.inject({ method: 'GET', url: `/api/configs/${id}`, headers: authHeaders() });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(res.body).not.toContain(configPath);
    expect(res.body).not.toContain(projectDir);
  });
});

describe('PUT /api/configs/:id — never accepts a filesystem path on the save route', () => {
  it('never accepts a filesystem path on the save route', async () => {
    const id = await trackConfig();
    const original = JSON.parse(FIXTURE_RAW) as Record<string, unknown>;
    const workflow = original.workflow as Record<string, unknown>;
    const modified = { ...original, workflow: { ...workflow, tdd_mode: true } };
    const sentinelPath = join(projectDir, 'sentinel-should-never-be-created.json');

    const res = await app.inject({
      method: 'PUT',
      url: `/api/configs/${id}`,
      headers: authHeaders(),
      payload: { config: modified, path: sentinelPath },
    });
    expect(res.statusCode).toBe(200);
    expect(existsSync(sentinelPath)).toBe(false);
  });
});

describe('Phase 3 regression — workspace store presence does not change frozen /api/configs contract', () => {
  it('GET /api/configs still lists only the registry entries and returns the same shape', async () => {
    const id = await trackConfig();

    const res = await app.inject({ method: 'GET', url: '/api/configs', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      ok: boolean;
      configs: Array<{ id: string; path: string; name: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.configs).toHaveLength(1);
    expect(body.configs[0].id).toBe(id);
    expect(body.configs[0].path).toBe(configPath);
    expect(typeof body.configs[0].name).toBe('string');
  });
});
