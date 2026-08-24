/**
 * Workspace persistence route suite (03-02-PLAN.md Task 1).
 *
 * Exercises the additive /api/workspace/* routes: token-guarded list, track,
 * remove, reorder, locate, and missing-file problem states. Every mutation
 * persists in the injected app-data root so the same tracked list survives a
 * fresh buildApp() bootstrap.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createWorkspaceStore, WORKSPACE_METADATA_RECOVERY_WARNING, WorkspacePersistenceError } from '../../packages/server/src/workspace-store.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';

const FAKE_PORT = 46003;
const HOST = `127.0.0.1:${FAKE_PORT}`;
const CORS_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;

function makeContext() {
  return {
    allowedHosts: new Set([HOST, `localhost:${FAKE_PORT}`]),
    corsOrigin: CORS_ORIGIN,
  };
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { host: HOST, ...extra };
}

let app: FastifyInstance;
let projectDir: string;
let appDataRoot: string;
let clientRoot: string;
let configPath: string;
let otherConfigPath: string;

beforeEach(async () => {
  projectDir = mkdtempSync(join(tmpdir(), 'gsdcm-workspace-project-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-workspace-appdata-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-workspace-client-'));

  const planningDir = join(projectDir, '.planning');
  mkdirSync(planningDir);
  configPath = join(planningDir, 'config.json');
  writeFileSync(configPath, JSON.stringify({ mode: 'interactive' }), 'utf8');

  const otherDir = mkdtempSync(join(tmpdir(), 'gsdcm-workspace-other-'));
  mkdirSync(join(otherDir, '.planning'));
  otherConfigPath = join(otherDir, '.planning', 'config.json');
  writeFileSync(otherConfigPath, JSON.stringify({ mode: 'interactive' }), 'utf8');

  app = await buildApp({
    ctx: makeContext(),
    clientRoot,
    workspaceRoot: appDataRoot,
    snapshotRoot: appDataRoot,
  });
});

afterEach(async () => {
  await app.close();
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(appDataRoot, { recursive: true, force: true });
  rmSync(clientRoot, { recursive: true, force: true });
});

async function trackConfig(path: string): Promise<{ id: string; status: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/workspace/configs/track',
    headers: authHeaders(),
    payload: { path },
  });
  const body = res.json() as { ok: boolean; config: { id: string; status: string } };
  expect(res.statusCode).toBe(200);
  expect(body.ok).toBe(true);
  return body.config;
}

describe('workspace metadata recovery and persistence', () => {
  it('quarantines malformed metadata and exposes only a static recovery warning', async () => {
    const workspaceDir = join(appDataRoot, 'workspace');
    mkdirSync(workspaceDir, { recursive: true });
    const metadataPath = join(workspaceDir, 'configs.json');
    writeFileSync(metadataPath, '{ malformed', 'utf8');
    await app.close();

    const recovered = await buildApp({ ctx: makeContext(), clientRoot, workspaceRoot: appDataRoot, snapshotRoot: appDataRoot });
    const res = await recovered.inject({ method: 'GET', url: '/api/workspace/configs', headers: authHeaders() });
    const body = res.json() as { ok: boolean; configs: unknown[]; warning?: string };
    expect(body).toEqual({ ok: true, configs: [], warning: WORKSPACE_METADATA_RECOVERY_WARNING });
    expect(res.body).not.toContain(appDataRoot);
    expect(readdirSync(workspaceDir).some((name) => /^configs\.json\.corrupt-/.test(name))).toBe(true);
    await recovered.close();
  });

  it('keeps in-memory state unchanged when an atomic write fails', async () => {
    const store = createWorkspaceStore({ appDataRoot, write: async () => { throw new Error('disk failure'); } });
    await expect(store.add(configPath)).rejects.toBeInstanceOf(WorkspacePersistenceError);
    expect(store.list().configs).toEqual([]);
  });

  it('merges concurrent adds from independent stores through the metadata lock', async () => {
    const storeA = createWorkspaceStore({ appDataRoot });
    const storeB = createWorkspaceStore({ appDataRoot });
    await Promise.all([storeA.add(configPath), storeB.add(otherConfigPath)]);
    const persisted = JSON.parse(readFileSync(join(appDataRoot, 'workspace', 'configs.json'), 'utf8')) as { configs: Array<{ path: string }> };
    expect(persisted.configs.map((entry) => entry.path).sort()).toEqual([configPath, otherConfigPath].sort());
  });
});

describe('POST /api/workspace/configs/track', () => {
  it('validates and tracks an absolute config path', async () => {
    const config = await trackConfig(configPath);
    expect(typeof config.id).toBe('string');
    expect(config.id.length).toBeGreaterThan(0);
    expect(config.status).toBe('ok');
  });

  it('returns the same id when tracking the same path twice', async () => {
    const first = await trackConfig(configPath);
    const second = await trackConfig(configPath);
    expect(second.id).toBe(first.id);
  });

  it('rejects a relative path with a static message and does not echo the path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/track',
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

describe('GET /api/workspace/configs', () => {
  it('lists tracked configs with status and display metadata', async () => {
    const tracked = await trackConfig(configPath);

    const res = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; configs: Array<{ id: string; status: string; path: string; name: string }> };
    expect(body.ok).toBe(true);
    expect(body.configs).toHaveLength(1);
    expect(body.configs[0].id).toBe(tracked.id);
    expect(body.configs[0].status).toBe('ok');
    expect(body.configs[0].path).toBe(configPath);
    expect(body.configs[0].name).toContain('config.json');
  });

  it('persists tracked configs across a fresh app bootstrap using the same app-data root', async () => {
    const tracked = await trackConfig(configPath);
    await app.close();

    const app2 = await buildApp({
      ctx: makeContext(),
      clientRoot,
      workspaceRoot: appDataRoot,
      snapshotRoot: appDataRoot,
    });

    const res = await app2.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const body = res.json() as { ok: boolean; configs: Array<{ id: string }> };
    expect(body.ok).toBe(true);
    expect(body.configs).toHaveLength(1);
    expect(body.configs[0].id).toBe(tracked.id);

    await app2.close();
  });

  it('keeps a missing tracked file in the list with a problem status', async () => {
    const tracked = await trackConfig(configPath);
    rmSync(configPath);

    const res = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const body = res.json() as { ok: boolean; configs: Array<{ id: string; status: string; problem?: string }> };
    const config = body.configs.find((c) => c.id === tracked.id);
    expect(config).toBeTruthy();
    expect(config!.status).toBe('missing');
    expect(config!.problem).toBeTruthy();
  });
});

describe('DELETE /api/workspace/configs/:id', () => {
  it('removes a tracked config from the persisted list without deleting the file', async () => {
    const tracked = await trackConfig(configPath);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/workspace/configs/${tracked.id}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const listBody = list.json() as { ok: boolean; configs: unknown[] };
    expect(listBody.configs).toHaveLength(0);

    // File on disk is untouched.
    expect(readFileSync(configPath, 'utf8')).toBeTruthy();
  });

  it('returns success even for an unknown id (idempotent removal)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/workspace/configs/deadbeef',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/workspace/configs/reorder', () => {
  it('reorders the persisted list and rejects ids not in the list', async () => {
    const first = await trackConfig(configPath);
    const second = await trackConfig(otherConfigPath);

    const reorder = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/reorder',
      headers: authHeaders(),
      payload: { ids: [second.id, first.id] },
    });
    expect(reorder.statusCode).toBe(200);
    const reorderBody = reorder.json() as { ok: boolean };
    expect(reorderBody.ok).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const listBody = list.json() as { ok: boolean; configs: Array<{ id: string }> };
    expect(listBody.configs[0].id).toBe(second.id);
    expect(listBody.configs[1].id).toBe(first.id);
  });

  it('rejects a reorder containing an unknown id', async () => {
    await trackConfig(configPath);

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/reorder',
      headers: authHeaders(),
      payload: { ids: ['deadbeef'] },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(typeof body.errors[0].message).toBe('string');
  });
});

describe('POST /api/workspace/configs/:id/locate', () => {
  it('relinks a tracked entry to a new absolute path through registry validation', async () => {
    const tracked = await trackConfig(configPath);
    const newPath = mkdtempSync(join(tmpdir(), 'gsdcm-locate-new-'));
    mkdirSync(join(newPath, '.planning'));
    const relocatedPath = join(newPath, '.planning', 'config.json');
    writeFileSync(relocatedPath, JSON.stringify({ mode: 'interactive' }), 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: `/api/workspace/configs/${tracked.id}/locate`,
      headers: authHeaders(),
      payload: { path: relocatedPath },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; config: { id: string; path: string } };
    expect(body.ok).toBe(true);
    // Same logical id so the UI selection stays stable.
    expect(body.config.id).toBe(tracked.id);
    expect(body.config.path).toBe(relocatedPath);

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const listBody = list.json() as { ok: boolean; configs: Array<{ id: string; path: string }> };
    expect(listBody.configs[0].path).toBe(relocatedPath);
  });

  it('rejects a non-absolute relocation path without echoing it', async () => {
    const tracked = await trackConfig(configPath);

    const res = await app.inject({
      method: 'POST',
      url: `/api/workspace/configs/${tracked.id}/locate`,
      headers: authHeaders(),
      payload: { path: 'relative/config.json' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('relative/config.json');
  });
});
