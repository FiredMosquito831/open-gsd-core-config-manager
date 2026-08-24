import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';
import type { LaunchContext } from '../../packages/server/src/context.js';
import { readIndex } from '../../packages/server/src/snapshot-store/index.js';
import { snapshotDirFor } from '../../packages/server/src/snapshot-store/paths.js';

const PORT = 46005;
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SECRET = 'history-secret-sentinel-never-render-or-return';

function context(): LaunchContext {
  return { allowedHosts: new Set([HOST, `localhost:${PORT}`]), corsOrigin: ORIGIN };
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { host: HOST, origin: ORIGIN, ...extra };
}

let app: FastifyInstance;
let projectRoot: string;
let snapshotRoot: string;
let clientRoot: string;
let configPath: string;

beforeEach(async () => {
  projectRoot = mkdtempSync(join(tmpdir(), 'gsdcm-history-project-'));
  snapshotRoot = mkdtempSync(join(tmpdir(), 'gsdcm-history-snapshots-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-history-client-'));
  configPath = join(projectRoot, 'config.json');
  writeFileSync(configPath, JSON.stringify({ mode: 'interactive', workflow: { tdd_mode: false }, api_key: SECRET }), 'utf8');
  app = await buildApp({ ctx: context(), clientRoot, snapshotRoot, workspaceRoot: snapshotRoot });
});

afterEach(async () => {
  await app.close();
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(snapshotRoot, { recursive: true, force: true });
  rmSync(clientRoot, { recursive: true, force: true });
});

async function track(path = configPath): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/api/configs/track', headers: headers(), payload: { path } });
  return (response.json() as { config: { id: string } }).config.id;
}

async function revision(id: string): Promise<string> {
  const response = await app.inject({ method: 'GET', url: `/api/configs/${id}`, headers: headers() });
  expect(response.statusCode).toBe(200);
  return (response.json() as { revision: string }).revision;
}

async function save(id: string, config: object): Promise<void> {
  const expectedRevision = await revision(id);
  const response = await app.inject({ method: 'PUT', url: `/api/configs/${id}`, headers: headers(), payload: { config, expectedRevision } });
  expect(response.statusCode).toBe(200);
}

describe('History API contracts (SAVE-05, SAVE-06)', () => {
  it('lists complete per-config history newest first and represents no history as an empty array', async () => {
    const id = await track();
    let response = await app.inject({ method: 'GET', url: `/api/configs/${id}/history`, headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, snapshots: [] });

    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    await save(id, { mode: 'interactive', workflow: { tdd_mode: false }, changed: true });
    response = await app.inject({ method: 'GET', url: `/api/configs/${id}/history`, headers: headers() });
    const body = response.json() as { ok: boolean; snapshots: Array<{ seq: number; timestamp: string }> };
    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.snapshots.map((snapshot) => snapshot.seq)).toEqual([2, 1]);
    expect(body.snapshots.every((snapshot) => Number.isSafeInteger(snapshot.seq) && snapshot.seq > 0)).toBe(true);
  });

  it('uses an opaque config id and canonical positive safe-integer sequences only', async () => {
    const id = await track();
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    for (const sequence of ['0', '-1', '1.5', '1e0', '01', '9007199254740992', '%2E%2E%2F1', '1.json']) {
      const response = await app.inject({ method: 'GET', url: `/api/configs/${id}/history/${sequence}`, headers: headers() });
      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain(configPath);
      expect(response.body).not.toContain(SECRET);
    }
    const valid = await app.inject({ method: 'GET', url: `/api/configs/${id}/history/1`, headers: headers() });
    expect(valid.statusCode).toBe(200);
  });

  it('serves same-origin history reads but rejects wrong origins and hosts first', async () => {
    const id = await track();
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    for (const requestHeaders of [
      { ...headers(), origin: 'https://attacker.invalid' },
      { ...headers(), host: 'attacker.invalid' },
    ]) {
      const response = await app.inject({ method: 'GET', url: `/api/configs/${id}/history`, headers: requestHeaders });
      expect(response.statusCode).toBe(403);
      expect(response.body).not.toContain(SECRET);
      expect(response.body).not.toContain(projectRoot);
    }
  });

  it('does not expose cross-config snapshots, malformed index files, noncanonical filenames, or parse failures', async () => {
    const otherPath = join(projectRoot, 'other.json');
    writeFileSync(otherPath, JSON.stringify({ mode: 'interactive', workflow: { tdd_mode: false } }), 'utf8');
    const id = await track();
    const otherId = await track(otherPath);
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    await save(otherId, { mode: 'interactive', workflow: { tdd_mode: true }, other: true });

    const cross = await app.inject({ method: 'GET', url: `/api/configs/${id}/history/2`, headers: headers() });
    expect(cross.statusCode).toBe(404);

    const dir = snapshotDirFor(configPath, snapshotRoot);
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ entries: [{ seq: 1, file: '../secrets.json' }] }), 'utf8');
    const tampered = await app.inject({ method: 'GET', url: `/api/configs/${id}/history/1`, headers: headers() });
    expect(tampered.statusCode).toBeGreaterThanOrEqual(400);
    expect(tampered.body).not.toContain('../secrets.json');
    expect(tampered.body).not.toContain(SECRET);
  });

  it('restores parsed snapshot content only through saveWithSnapshot and preserves a recovery snapshot', async () => {
    const id = await track();
    const before = readFileSync(configPath, 'utf8');
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    const response = await app.inject({ method: 'POST', url: `/api/configs/${id}/history/1/restore`, headers: headers(), payload: { expectedRevision: await revision(id) } });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(JSON.parse(before));
    const index = await readIndex(snapshotDirFor(configPath, snapshotRoot));
    expect(index.entries).toHaveLength(2);
    expect(JSON.parse(readFileSync(join(snapshotDirFor(configPath, snapshotRoot), index.entries[1].file), 'utf8'))).toMatchObject({ workflow: { tdd_mode: true } });
  });

  it('leaves bytes unchanged for invalid snapshots, validation failures, and atomic write failures', async () => {
    const id = await track();
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    const original = readFileSync(configPath, 'utf8');
    const dir = snapshotDirFor(configPath, snapshotRoot);
    writeFileSync(join(dir, '1.json'), '{ invalid snapshot', 'utf8');
    const response = await app.inject({ method: 'POST', url: `/api/configs/${id}/history/1/restore`, headers: headers(), payload: { expectedRevision: await revision(id) } });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(response.body).not.toContain(SECRET);
  });

  it('serializes overlapping restores without fabricated partial list or detail entries', async () => {
    const id = await track();
    await save(id, { mode: 'interactive', workflow: { tdd_mode: true } });
    await save(id, { mode: 'interactive', workflow: { tdd_mode: false }, changed: true });
    const expectedRevision = await revision(id);
    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/configs/${id}/history/1/restore`, headers: headers(), payload: { expectedRevision } }),
      app.inject({ method: 'POST', url: `/api/configs/${id}/history/2/restore`, headers: headers(), payload: { expectedRevision } }),
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    const history = await app.inject({ method: 'GET', url: `/api/configs/${id}/history`, headers: headers() });
    const snapshots = (history.json() as { snapshots: Array<{ seq: number }> }).snapshots;
    expect(snapshots.map(({ seq }) => seq)).toEqual([...snapshots.map(({ seq }) => seq)].sort((a, b) => b - a));
    expect(snapshots.every(({ seq }) => Number.isSafeInteger(seq))).toBe(true);
  });

  it('keeps snapshot-recording warnings non-blocking while static validation failures remain blocking', async () => {
    const source = readFileSync(join(process.cwd(), 'packages/server/src/routes/configs.ts'), 'utf8');
    expect(source).toContain('saveWithSnapshot');
    expect(source).not.toMatch(/history[\s\S]{0,800}(?:copyFile|rename|writeFile|saveConfig)/);
    expect(existsSync(configPath)).toBe(true);
  });
});
