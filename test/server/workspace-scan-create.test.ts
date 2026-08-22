/**
 * Scan and create route suite (03-02-PLAN.md Task 1).
 *
 * Folder scanning returns review candidates without mutating the persisted
 * workspace. Create preview and create compute the target path server-side,
 * refuse to overwrite without confirmation, and route the actual write through
 * the same validate/atomic/snapshot pipeline as PUT /api/configs/:id.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';

const FAKE_PORT = 46004;
const TOKEN = '66666666-6666-6666-8666-666666666666';
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
let scanRoot: string;
let appDataRoot: string;
let clientRoot: string;

beforeEach(async () => {
  scanRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scan-root-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scan-appdata-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scan-client-'));

  app = await buildApp({
    ctx: makeContext(),
    clientRoot,
    workspaceRoot: appDataRoot,
    snapshotRoot: appDataRoot,
  });
});

afterEach(async () => {
  await app.close();
  rmSync(scanRoot, { recursive: true, force: true });
  rmSync(appDataRoot, { recursive: true, force: true });
  rmSync(clientRoot, { recursive: true, force: true });
});

// Directory symlinks require OS privileges Windows does not grant by default
// (Developer Mode / SeCreateSymbolicLinkPrivilege). Probe once so the symlink
// safety test can skip cleanly on locked-down boxes instead of false-failing —
// the scan route's symlink guards (workspace-store.ts isSymbolicLink) are the
// real behavior under test here.
function supportsDirectorySymlinks(): boolean {
  const probe = mkdtempSync(join(tmpdir(), 'gsdcm-symlink-probe-'));
  const link = join(tmpdir(), `gsdcm-symlink-link-${probe.slice(-6)}`);
  try {
    symlinkSync(probe, link, 'dir');
    return true;
  } catch {
    return false;
  } finally {
    try {
      rmSync(link, { force: true });
    } catch {
      /* ignore */
    }
    try {
      rmSync(probe, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

const itIfSymlinks = supportsDirectorySymlinks() ? it : it.skip;

function makeProject(dir: string, name: string): string {
  const projectDir = join(dir, name);
  const planningDir = join(projectDir, '.planning');
  mkdirSync(planningDir, { recursive: true });
  writeFileSync(join(planningDir, 'config.json'), JSON.stringify({ mode: 'interactive' }), 'utf8');
  return planningDir;
}

describe('POST /api/workspace/scan', () => {
  it('discovers .planning/config.json files under a chosen root', async () => {
    makeProject(scanRoot, 'alpha');
    makeProject(scanRoot, 'beta');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; candidates: Array<{ path: string; status: string }> };
    expect(body.ok).toBe(true);
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates.every((c) => c.status === 'new' || c.status === 'tracked')).toBe(true);
  });

  it('skips node_modules, .git, and dist directories', async () => {
    makeProject(scanRoot, 'valid');
    makeProject(join(scanRoot, 'node_modules', 'some-pkg'), 'ignored-nm');
    mkdirSync(join(scanRoot, '.git'), { recursive: true });
    writeFileSync(join(scanRoot, '.git', 'config.json'), '{}', 'utf8');
    makeProject(join(scanRoot, 'dist', 'bundle'), 'ignored-dist');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    const body = res.json() as { ok: boolean; candidates: Array<{ path: string }> };
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].path).toContain('valid');
  });

  it('marks non-file .planning/config.json as invalid', async () => {
    const projectDir = join(scanRoot, 'invalid');
    mkdirSync(join(projectDir, '.planning'), { recursive: true });
    mkdirSync(join(projectDir, '.planning', 'config.json'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    const body = res.json() as { ok: boolean; candidates: Array<{ path: string; status: string }> };
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].status).toBe('invalid');
  });

  itIfSymlinks('does not follow directory symlinks outside the selected root', async () => {
    const outsideRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scan-outside-'));
    try {
      makeProject(outsideRoot, 'outside-project');
      symlinkSync(outsideRoot, join(scanRoot, 'outside-link'), 'dir');

      const res = await app.inject({
        method: 'POST',
        url: '/api/workspace/scan',
        headers: authHeaders(),
        payload: { rootPath: scanRoot },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { candidates: Array<{ path: string }> };
      expect(body.candidates).toHaveLength(0);
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('does not mutate the persisted workspace list', async () => {
    makeProject(scanRoot, 'alpha');

    const scan = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    expect(scan.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const listBody = list.json() as { ok: boolean; configs: unknown[] };
    expect(listBody.configs).toHaveLength(0);
  });

  it('marks already-tracked paths as tracked', async () => {
    const planningDir = makeProject(scanRoot, 'alpha');
    const configPath = join(planningDir, 'config.json');

    const track = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/track',
      headers: authHeaders(),
      payload: { path: configPath },
    });
    expect(track.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    const body = res.json() as { ok: boolean; candidates: Array<{ path: string; status: string }> };
    const candidate = body.candidates.find((c: { path: string; status: string }) => c.path === configPath);
    expect(candidate).toBeTruthy();
    expect(candidate!.status).toBe('tracked');
  });

  it('rejects a non-absolute scan root without echoing the path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: 'relative/dir' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('relative/dir');
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(typeof body.errors[0].message).toBe('string');
  });
});

describe('POST /api/workspace/configs/create-preview', () => {
  it('computes the target path and reports whether it exists', async () => {
    const projectDir = join(scanRoot, 'new-project');
    mkdirSync(projectDir, { recursive: true });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create-preview',
      headers: authHeaders(),
      payload: { projectDir },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; targetPath: string; exists: boolean };
    expect(body.ok).toBe(true);
    expect(body.targetPath).toBe(join(projectDir, '.planning', 'config.json'));
    expect(body.exists).toBe(false);
  });

  it('reports an existing target', async () => {
    const projectDir = join(scanRoot, 'existing-project');
    const planningDir = join(projectDir, '.planning');
    mkdirSync(planningDir, { recursive: true });
    const targetPath = join(planningDir, 'config.json');
    writeFileSync(targetPath, JSON.stringify({ mode: 'interactive' }), 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create-preview',
      headers: authHeaders(),
      payload: { projectDir },
    });
    const body = res.json() as { ok: boolean; targetPath: string; exists: boolean };
    expect(body.ok).toBe(true);
    expect(body.targetPath).toBe(targetPath);
    expect(body.exists).toBe(true);
  });

  it('rejects a non-absolute project directory', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create-preview',
      headers: authHeaders(),
      payload: { projectDir: 'relative/project' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/workspace/configs/create', () => {
  it('creates a new config file, tracks it, and writes a minimal project config', async () => {
    const projectDir = join(scanRoot, 'new-project');
    mkdirSync(projectDir, { recursive: true });
    const targetPath = join(projectDir, '.planning', 'config.json');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create',
      headers: authHeaders(),
      payload: { projectDir, overwrite: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; config: { id: string; path: string } };
    expect(body.ok).toBe(true);
    expect(body.config.path).toBe(targetPath);
    expect(existsSync(targetPath)).toBe(true);

    const written = JSON.parse(readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
    expect(written).toBeTruthy();

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspace/configs',
      headers: authHeaders(),
    });
    const listBody = list.json() as { ok: boolean; configs: Array<{ id: string }> };
    expect(listBody.configs).toHaveLength(1);
    expect(listBody.configs[0].id).toBe(body.config.id);
  });

  it('allows only one simultaneous no-overwrite create for a target', async () => {
    const projectDir = join(scanRoot, 'simultaneous-project');
    mkdirSync(projectDir, { recursive: true });

    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/workspace/configs/create', headers: authHeaders(), payload: { projectDir, overwrite: false } }),
      app.inject({ method: 'POST', url: '/api/workspace/configs/create', headers: authHeaders(), payload: { projectDir, overwrite: false } }),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 400]);
  });

  it('refuses to overwrite an existing config without overwrite=true', async () => {
    const projectDir = join(scanRoot, 'existing-project');
    const planningDir = join(projectDir, '.planning');
    mkdirSync(planningDir, { recursive: true });
    const targetPath = join(planningDir, 'config.json');
    const originalContent = JSON.stringify({ mode: 'interactive' });
    writeFileSync(targetPath, originalContent, 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create',
      headers: authHeaders(),
      payload: { projectDir, overwrite: false },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(readFileSync(targetPath, 'utf8')).toBe(originalContent);
  });

  it('overwrites an existing config when overwrite=true and records a snapshot', async () => {
    const projectDir = join(scanRoot, 'existing-project');
    const planningDir = join(projectDir, '.planning');
    mkdirSync(planningDir, { recursive: true });
    const targetPath = join(planningDir, 'config.json');
    writeFileSync(targetPath, JSON.stringify({ mode: 'interactive' }), 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create',
      headers: authHeaders(),
      payload: { projectDir, overwrite: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; config: { id: string } };
    expect(body.ok).toBe(true);
    expect(existsSync(targetPath)).toBe(true);
  });

  it('rejects a non-absolute project directory', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/configs/create',
      headers: authHeaders(),
      payload: { projectDir: 'relative/project', overwrite: false },
    });
    expect(res.statusCode).toBe(400);
  });
});
