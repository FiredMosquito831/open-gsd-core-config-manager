/**
 * Shared spawned-process test harness for Phase 2's CLI-launch and teardown
 * suites (02-VALIDATION.md §Wave 0 Requirements). Spawns the CLI from
 * source via `tsx` (no build step — Plan 07 separately smoke-tests the
 * built/packaged CLI artifact) and resolves the assigned port + launch token by
 * parsing the plain-ASCII launch banner (02-UI-SPEC.md §Copywriting
 * Contract, degrade rule: `NO_COLOR=1` forces the ASCII/no-color path so
 * output is deterministic and never needs ANSI-stripping here).
 *
 * `parseBannerUrl` is kept pure and exported on its own so the banner
 * parsing logic is unit-testable without spawning a real process (the CLI
 * does not exist yet when this file is first written).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root, resolved relative to this file (test/server/helpers/). */
const REPO_ROOT = join(__dirname, '..', '..', '..');

/** tsx's ESM CLI entry, resolved as a file path — avoids the Windows `.cmd`
 * shim entirely by running `process.execPath` directly against it (no
 * `shell: true` needed, so no shell-quoting/injection surface). */
const TSX_CLI_ENTRY = join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/** The CLI entry point this harness spawns, run from source (no build). */
const CLI_ENTRY = join(REPO_ROOT, 'packages', 'cli', 'src', 'cli.ts');

/**
 * Matches the frozen launch-banner URL shape from 02-UI-SPEC.md:
 * `http://127.0.0.1:<port>/?t=<token>` where `<token>` is a
 * `crypto.randomUUID()` (36-char lowercase hex + hyphens). Anchored to the
 * loopback host only — a URL with any other host must not match.
 */
const BANNER_URL_PATTERN =
  /http:\/\/127\.0\.0\.1:(\d+)\/\?t=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

/** Pure parser: scans a stdout chunk for the launch-banner URL. */
export function parseBannerUrl(chunk: string): { url: string; port: number; token: string } | null {
  const match = BANNER_URL_PATTERN.exec(chunk);
  if (!match) return null;
  const [url, portStr, token] = match;
  return { url, port: Number(portStr), token };
}

export interface SpawnedCli {
  proc: ChildProcess;
  port: number;
  token: string;
  url: string;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  kill: (signal?: NodeJS.Signals) => void;
}

export interface SpawnCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/**
 * Spawns the CLI from source via `tsx` against `packages/cli/src/cli.ts`,
 * resolving as soon as the launch banner's URL appears in stdout. Rejects
 * with the accumulated stderr if the process exits first, or after
 * `timeoutMs` (default 20000) elapses without a banner.
 */
export async function spawnCli(args: string[], opts: SpawnCliOptions = {}): Promise<SpawnedCli> {
  const timeoutMs = opts.timeoutMs ?? 20_000;

  const proc = spawn(process.execPath, [TSX_CLI_ENTRY, CLI_ENTRY, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    env: { ...process.env, NO_COLOR: '1', ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8');
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf8');
  });

  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    proc.on('exit', (code, signal) => resolve({ code, signal }));
  });

  const banner = await new Promise<{ url: string; port: number; token: string }>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`spawnCli: timed out after ${timeoutMs}ms waiting for launch banner. stderr:\n${stderrBuf}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      proc.stdout?.off('data', onStdout);
      proc.off('exit', onExit);
    }

    function onStdout(chunk: Buffer) {
      if (settled) return;
      const parsed = parseBannerUrl(chunk.toString('utf8')) ?? parseBannerUrl(stdoutBuf);
      if (parsed) {
        settled = true;
        cleanup();
        resolve(parsed);
      }
    }

    function onExit(code: number | null, signal: NodeJS.Signals | null) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `spawnCli: process exited before printing a launch banner (code=${code}, signal=${signal}). stderr:\n${stderrBuf}`,
        ),
      );
    }

    proc.stdout?.on('data', onStdout);
    proc.on('exit', onExit);
  });

  return {
    proc,
    port: banner.port,
    token: banner.token,
    url: banner.url,
    stdout: () => stdoutBuf,
    stderr: () => stderrBuf,
    exited,
    kill: (signal: NodeJS.Signals = 'SIGINT') => {
      proc.kill(signal);
    },
  };
}
