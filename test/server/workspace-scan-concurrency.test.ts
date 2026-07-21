/**
 * Scan concurrency / event-loop-liveness regression suite.
 *
 * The original "Bundled · gsd-core vschema unavailable" / "Failed to load
 * tracked configs" sidebar brick (debug session auto-detect-schema-unavailable-brick)
 * was caused by `workspaceStore.scan()` performing a fully SYNCHRONOUS
 * recursive walk of the chosen root: it consumed the single-threaded Fastify
 * event loop for minutes on a root containing a bulky tree (`.claude/worktrees`),
 * starving every other `/api` request — `/api/schema/status`, `/api/workspace/configs`,
 * `/api/health` — so the browser rendered fallback text and the helper appeared inert.
 *
 * These tests pin the two parts of the fix so the brick cannot silently return:
 *   1. `.claude` (and its `worktrees/agent-*` children) is excluded from the walk,
 *      so scanning a repo root no longer clone-sprays redundant candidates.
 *   2. A concurrent `/api/health` probe resolves while a scan of a wide tree is
 *      mid-flight — the event loop stays live because `scan()` is async and
 *      yields `fs/promises` ops between directories. On the old synchronous
 *      implementation the health probe would queue for the full walk duration.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';

const FAKE_PORT = 46044;
const TOKEN = '77777777-7777-7777-8777-777777777777';
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
  scanRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scanconcurrency-root-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scanconcurrency-appdata-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-scanconcurrency-client-'));
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

function makeProject(parent: string, name: string): string {
  const planningDir = join(parent, name, '.planning');
  mkdirSync(planningDir, { recursive: true });
  writeFileSync(join(planningDir, 'config.json'), JSON.stringify({ mode: 'interactive' }), 'utf8');
  return planningDir;
}

describe('POST /api/workspace/scan', () => {
  it('excludes .claude/worktrees so a repo root scan surfaces only real candidates', async () => {
    // The real candidate living at the repo root.
    makeProject(scanRoot, 'my-project');
    // Simulate a `.claude/worktrees/agent-*/` forest — each a separate "project"
    // whose config would have been clone-sprayed as a noise candidate before the
    // exclude-list fix. Creating 12 worktree-shaped dirs is enough to prove the
    // exclude path; the concurrency test below builds a wider tree.
    const worktreesRoot = join(scanRoot, '.claude', 'worktrees');
    mkdirSync(worktreesRoot, { recursive: true });
    for (let i = 0; i < 12; i++) {
      makeProject(worktreesRoot, `agent-clone-${i}`);
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/scan',
      headers: authHeaders(),
      payload: { rootPath: scanRoot },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; candidates: Array<{ projectName: string; path: string }> };
    expect(body.ok).toBe(true);

    const projectNames = body.candidates.map((c) => c.projectName);
    expect(projectNames).toContain('my-project');
    // None of the `.claude/worktrees/agent-clone-*` pseudo-projects survived the walk.
    expect(body.candidates.some((c) => c.projectName.startsWith('agent-clone-'))).toBe(false);
    expect(projectNames).toHaveLength(1);
  });

  it('keeps /api/health responsive while a wide scan is mid-flight', async () => {
    // Build ONE real candidate at the root, plus a plain (config-free) wide
    // subtree so the recursive walk has many directories to visit. This makes
    // a synchronous scan observable: it would hold the event loop for the whole
    // walk, queueing the health probe behind it. The async scan yields between
    // directories, so the health probe interleaves immediately.
    makeProject(scanRoot, 'real-project');
    const wideRoot = join(scanRoot, 'wide-tree');
    mkdirSync(wideRoot, { recursive: true });
    for (let d = 0; d < 30; d++) {
      const dir = join(wideRoot, `dir-${d}`);
      mkdirSync(dir, { recursive: true });
      for (let s = 0; s < 50; s++) {
        mkdirSync(join(dir, `sub-${s}`), { recursive: true });
      }
    }
    // ~1530 directories for the walker to visit.

    // Fire BOTH requests without awaiting, recording the resolve order. The
    // distinguishing property is ORDERING, not wall-time:
    //   - Async scan: the handler `await`s `readdir` and yields the event loop,
    //     so Fastify starts and completes `/api/health` mid-walk → health
    //     resolves FIRST.
    //   - Sync scan (the old brick): the handler runs the whole walk on one
    //     tick and does not yield, so `/api/health` cannot start until the walk
    //     finishes → scan resolves FIRST.
    const resolveOrder: string[] = [];
    const scanP = app
      .inject({ method: 'POST', url: '/api/workspace/scan', headers: authHeaders(), payload: { rootPath: scanRoot } })
      .then((res) => { resolveOrder.push('scan'); return res; });
    const healthP = app
      .inject({ method: 'GET', url: '/api/health', headers: authHeaders() })
      .then((res) => { resolveOrder.push('health'); return res; });

    const healthRes = await healthP;
    // Sanity ceiling: a wedged/blocked event loop would hang here past 30s.
    // The async scan fails this only if it regressed to a long synchronous hold,
    // which is exactly the brick we are guarding against.
    const [scanRes] = await Promise.all([scanP, Promise.resolve(healthRes)]);

    expect(healthRes.statusCode).toBe(200);
    expect(scanRes.statusCode).toBe(200);
    // The load-bearing assertion: health resolved before the scan. On the old
    // synchronous `scan()` these resolved scan-then-health (or health never
    // interleaved), so this fails on a sync walk regardless of machine speed.
    expect(resolveOrder[0]).toBe('health');

    const scanBody = scanRes.json() as { ok: boolean; candidates: Array<{ projectName: string }> };
    expect(scanBody.ok).toBe(true);
    expect(scanBody.candidates.map((c) => c.projectName)).toContain('real-project');
  });
});
