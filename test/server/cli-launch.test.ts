/**
 * CLI launch suite (DIST-01, DIST-02; 02-VALIDATION.md § Per-Task
 * Verification Map). Two of the five behaviors below spawn the real CLI
 * from source via `spawnCli()` (Plan 01's harness) and drive it over a
 * real HTTP socket — proving the whole stack end to end, not
 * `fastify.inject()`. The other three call `bootstrap()` in-process with
 * an injected fake `open` dependency, since observing the `open` call is
 * only possible in-process (a spawned child would really launch a
 * browser).
 *
 * `bootstrap`/`packages/cli/src/bootstrap.ts` does not exist yet at the
 * time this file is written — this suite is RED until Plan 06's Task 3
 * implements it. That is the intended TDD state.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { spawnCli, type SpawnedCli } from './helpers/spawn-cli.js';
import { terminateProcessTree } from '../helpers/process-tree.js';
import { bootstrap } from '../../packages/cli/src/bootstrap.js';
import { createOutput } from '../../packages/cli/src/output.js';

/** A no-op writable stream stub so in-process bootstrap() tests never print to the real terminal. */
function silentOutput() {
  return createOutput({ isTTY: false, write: () => true } as unknown as NodeJS.WritableStream & { isTTY?: boolean }, {});
}

let currentSpawned: SpawnedCli | undefined;

afterEach(async () => {
  // Runs even when the test body throws — a crashed test must never orphan a server.
  if (currentSpawned) {
    await terminateProcessTree(currentSpawned.proc);
    await currentSpawned.exited.catch(() => undefined);
    currentSpawned = undefined;
  }
});

describe('starts and serves (DIST-01)', () => {
  it(
    'starts and serves',
    async () => {
      currentSpawned = await spawnCli(['--no-open']);
      expect(currentSpawned.port).toBeGreaterThan(0);
      expect(currentSpawned.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      const authed = await fetch(`http://127.0.0.1:${currentSpawned.port}/api/health`, {
        headers: { 'x-gsd-token': currentSpawned.token },
      });
      expect(authed.status).toBe(200);
      const body = (await authed.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      const unauthed = await fetch(`http://127.0.0.1:${currentSpawned.port}/api/health`);
      expect(unauthed.status).toBe(403);
    },
    20_000,
  );
});

describe('opens browser with token (DIST-02)', () => {
  it(
    'opens browser with token',
    async () => {
      const calls: string[] = [];
      const fakeOpen = async (url: string): Promise<void> => {
        calls.push(url);
      };

      const handle = await bootstrap({ port: 0, open: true }, { open: fakeOpen, out: silentOutput() });
      try {
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatch(
          /^http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
        const token = new URL(calls[0]).searchParams.get('t');
        expect(token).toBe(handle.token);
        const addr = handle.app.server.address() as AddressInfo;
        expect(addr.address).toBe('127.0.0.1');
      } finally {
        await handle.shutdown();
      }
    },
    20_000,
  );
});

describe('does not open the browser when --no-open is passed', () => {
  it(
    'does not open the browser when --no-open is passed',
    async () => {
      const calls: string[] = [];
      const fakeOpen = async (url: string): Promise<void> => {
        calls.push(url);
      };

      const handle = await bootstrap({ port: 0, open: false }, { open: fakeOpen, out: silentOutput() });
      try {
        expect(calls).toHaveLength(0);
      } finally {
        await handle.shutdown();
      }
    },
    20_000,
  );
});

describe('binds only to the loopback interface', () => {
  it(
    'binds only to the loopback interface',
    async () => {
      const handle = await bootstrap(
        { port: 0, open: false },
        { open: async () => undefined, out: silentOutput() },
      );
      try {
        const addr = handle.app.server.address() as AddressInfo;
        expect(addr.address).toBe('127.0.0.1');
        expect(addr.address).not.toBe('0.0.0.0');
        expect(addr.address).not.toBe('::');
      } finally {
        await handle.shutdown();
      }
    },
    20_000,
  );
});

describe('serves the SPA shell without a token', () => {
  it(
    'serves the SPA shell without a token',
    async () => {
      currentSpawned = await spawnCli(['--no-open']);
      const res = await fetch(`http://127.0.0.1:${currentSpawned.port}/`);
      expect(res.status).toBe(200);
    },
    20_000,
  );
});
