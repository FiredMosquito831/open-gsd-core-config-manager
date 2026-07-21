/**
 * Picker REST route suite (Symptom D — native OS file/path picker).
 *
 * The picker backend (`packages/server/src/picker.ts`) spawns real OS dialog
 * processes (powershell/osascript/zenity/kdialog) which is both non-hermetic
 * and platform-dependent. These tests exercise the `/api/picker/*` route
 * layer deterministically by mocking the picker module's three entry points,
 * covering: status reporting, a successful pick, and the cancelled/no-backend
 * (null) path. Every route is registered inside the `/api` scope by buildApp,
 * so the Origin and token guards are exercised here too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../packages/server/src/app.js';

const FAKE_PORT = 46043;
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

// Mock the picker backend so routes are exercised without spawning dialogs.
// `pickerBackendName`, `pickFile`, `pickDirectory` are the only exports the
// routes touch; mocking resolves deterministically per-test via mockResolvedValueOnce.
const pickFile = vi.fn<() => Promise<string | null>>();
const pickDirectory = vi.fn<() => Promise<string | null>>();
const pickerBackendName = vi.fn<() => Promise<string>>();

vi.mock('../../packages/server/src/picker.js', () => ({
  pickFile: (...args: unknown[]) => pickFile(...(args as [])),
  pickDirectory: (...args: unknown[]) => pickDirectory(...(args as [])),
  pickerBackendName: (...args: unknown[]) => pickerBackendName(...(args as [])),
}));

let app: FastifyInstance;
let appDataRoot: string;
let clientRoot: string;

beforeEach(async () => {
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-picker-appdata-'));
  clientRoot = mkdtempSync(join(tmpdir(), 'gsdcm-picker-client-'));
  pickFile.mockReset();
  pickDirectory.mockReset();
  pickerBackendName.mockReset();
  app = await buildApp({
    ctx: makeContext(),
    clientRoot,
    workspaceRoot: appDataRoot,
    snapshotRoot: appDataRoot,
  });
});

afterEach(async () => {
  await app.close();
  rmSync(appDataRoot, { recursive: true, force: true });
  rmSync(clientRoot, { recursive: true, force: true });
});

describe('GET /api/picker/status', () => {
  it('reports supported=true with the backend name when a backend exists', async () => {
    pickerBackendName.mockResolvedValueOnce('powershell');
    const res = await app.inject({ method: 'GET', url: '/api/picker/status', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; supported: boolean; backend: string };
    expect(body.ok).toBe(true);
    expect(body.supported).toBe(true);
    expect(body.backend).toBe('powershell');
  });

  it('reports supported=false when no backend is available', async () => {
    pickerBackendName.mockResolvedValueOnce('none');
    const res = await app.inject({ method: 'GET', url: '/api/picker/status', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; supported: boolean; backend: string };
    expect(body.supported).toBe(false);
    expect(body.backend).toBe('none');
  });
});

describe('POST /api/picker/file', () => {
  it('returns the picked absolute path when the backend resolves it', async () => {
    pickFile.mockResolvedValueOnce('/mnt/c/projects/x/.planning/config.json');
    const res = await app.inject({ method: 'POST', url: '/api/picker/file', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; path: string };
    expect(body.ok).toBe(true);
    expect(body.path).toBe('/mnt/c/projects/x/.planning/config.json');
    expect(pickFile).toHaveBeenCalledOnce();
  });

  it('returns 404 when the user cancels or no backend is available', async () => {
    pickFile.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/api/picker/file', headers: authHeaders() });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    // Static, path-free message (consistent with the T-02-19/T-02-25 info-disclosure posture).
    expect(body.errors[0].message).not.toContain('/mnt');
  });

  it('returns 500 with a static message when the picker throws', async () => {
    pickFile.mockRejectedValueOnce(new Error('boom'));
    const res = await app.inject({ method: 'POST', url: '/api/picker/file', headers: authHeaders() });
    expect(res.statusCode).toBe(500);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors[0].message).toBe('File picker failed');
  });
});

describe('POST /api/picker/directory', () => {
  it('returns the picked directory path when the backend resolves it', async () => {
    pickDirectory.mockResolvedValueOnce('/mnt/c/projects/x');
    const res = await app.inject({ method: 'POST', url: '/api/picker/directory', headers: authHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; path: string };
    expect(body.ok).toBe(true);
    expect(body.path).toBe('/mnt/c/projects/x');
    expect(pickDirectory).toHaveBeenCalledOnce();
  });

  it('returns 404 when cancelled / no backend', async () => {
    pickDirectory.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/api/picker/directory', headers: authHeaders() });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { ok: boolean; errors: Array<{ message: string }> };
    expect(body.ok).toBe(false);
  });
});
