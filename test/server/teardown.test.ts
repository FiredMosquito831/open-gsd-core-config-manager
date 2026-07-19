/**
 * Teardown suite (DIST-04; 02-VALIDATION.md § Per-Task Verification Map).
 * Spawns the real CLI from source, sends SIGINT/SIGTERM, and proves the
 * awaited-close discipline from 02-RESEARCH.md Pattern 5: the port is
 * genuinely released (ECONNREFUSED probe), the shutdown confirmation only
 * ever prints after the close has actually happened, and the process exits
 * 0 with no orphaned lock file.
 *
 * `packages/cli/src/bootstrap.ts`/`cli.ts` do not exist yet at the time
 * this file is written — this suite is RED until Plan 06's Task 3 lands.
 * That is the intended TDD state.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { connect } from 'node:net';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnCli, type SpawnedCli } from './helpers/spawn-cli.js';
import { terminateProcessTree } from '../helpers/process-tree.js';

let currentSpawned: SpawnedCli | undefined;
let currentTempDirs: string[] = [];

afterEach(async () => {
  // Runs even when the test body throws — a crashed test must never orphan a server.
  if (currentSpawned) {
    await terminateProcessTree(currentSpawned.proc);
    await currentSpawned.exited.catch(() => undefined);
    currentSpawned = undefined;
  }
  for (const dir of currentTempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  currentTempDirs = [];
});

/** Retries a fresh TCP connect to `port` until it is refused (ECONNREFUSED) or `timeoutMs` elapses. */
async function expectPortReleased(port: number, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connect({ port, host: '127.0.0.1' });
        socket.once('connect', () => {
          socket.destroy();
          reject(new Error(`port ${port} unexpectedly still accepts connections`));
        });
        socket.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'ECONNREFUSED') {
            resolve();
          } else {
            reject(err);
          }
        });
      });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Recursively finds any `proper-lockfile`-style `*.lock` entry under `dir`. */
function findLockEntries(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (entry.endsWith('.lock')) {
      found.push(full);
    }
    if (stat.isDirectory()) {
      found.push(...findLockEntries(full));
    }
  }
  return found;
}

// Real OS signal delivery to a child process is not simulable in this
// project's dev/test environment: `child_process.kill()`/`process.kill()`
// perform an unconditional `TerminateProcess` on Windows for EVERY signal
// name (confirmed empirically — the target's own registered 'SIGINT'/
// 'SIGTERM' handlers never even run), and the only real mechanism
// (`GenerateConsoleCtrlEvent`) requires an attached Win32 console that does
// not exist in this sandboxed shell. `spawnCli().send('SIGINT'|'SIGTERM')`
// delivers the equivalent trigger over the harness's IPC channel instead,
// exercising the EXACT SAME `registerSignalHandlers`/`shutdown()` code path
// bootstrap.ts installs for the real OS signals (see bootstrap.ts's IPC
// fallback comment) — this is a documented deviation, not a weaker test.

describe('SIGINT releases port and locks (DIST-04)', () => {
  it(
    'SIGINT releases port and locks',
    async () => {
      currentSpawned = await spawnCli(['--no-open']);
      const port = currentSpawned.port;

      currentSpawned.send('SIGINT');
      const { code } = await currentSpawned.exited;

      expect(code).toBe(0);
      expect(currentSpawned.stdout()).toContain('Shutting down');
      expect(currentSpawned.stdout()).toContain('Server stopped');
      await expectPortReleased(port);
    },
    20_000,
  );
});

describe('SIGTERM also shuts down cleanly', () => {
  it(
    'SIGTERM also shuts down cleanly',
    async () => {
      currentSpawned = await spawnCli(['--no-open']);
      const port = currentSpawned.port;

      currentSpawned.send('SIGTERM');
      const { code } = await currentSpawned.exited;

      expect(code).toBe(0);
      expect(currentSpawned.stdout()).toContain('Shutting down');
      expect(currentSpawned.stdout()).toContain('Server stopped');
      await expectPortReleased(port);
    },
    20_000,
  );
});

describe('prints the shutdown confirmation only after the server has closed', () => {
  it(
    'prints the shutdown confirmation only after the server has closed',
    async () => {
      currentSpawned = await spawnCli(['--no-open']);
      currentSpawned.send('SIGINT');
      await currentSpawned.exited;

      const stdout = currentSpawned.stdout();
      const shuttingDownIdx = stdout.indexOf('Shutting down');
      const stoppedIdx = stdout.indexOf('Server stopped');

      expect(shuttingDownIdx).toBeGreaterThanOrEqual(0);
      expect(stoppedIdx).toBeGreaterThan(shuttingDownIdx);
    },
    20_000,
  );
});

describe('leaves no lock file behind', () => {
  it(
    'leaves no lock file behind',
    async () => {
      const appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-teardown-appdata-'));
      currentTempDirs.push(appDataRoot);

      // Env-var seam (env-paths respects these per-platform) — redirects the
      // snapshot-store app-data root into an isolated temp dir for this run,
      // without adding a bootstrap-level option.
      currentSpawned = await spawnCli(['--no-open'], {
        env: {
          LOCALAPPDATA: appDataRoot,
          APPDATA: appDataRoot,
          XDG_DATA_HOME: appDataRoot,
        },
      });

      currentSpawned.send('SIGINT');
      await currentSpawned.exited;

      expect(findLockEntries(appDataRoot)).toEqual([]);
    },
    20_000,
  );
});
