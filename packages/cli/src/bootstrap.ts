/**
 * bootstrap.ts — process-lifecycle orchestration (D-02, D-03, D-05;
 * 02-RESEARCH.md Pattern 2/4/5; 02-PATTERNS.md § bootstrap.ts).
 *
 * Mirrors `packages/config-io/src/atomic-write.ts`'s acquire -> use ->
 * release-in-finally discipline, applied to the process lifecycle:
 * `listen()` acquires the socket, the server runs, and `shutdown()`
 * ALWAYS `await`s `app.close()` before considering teardown complete —
 * never fire-and-forget (02-RESEARCH.md Pitfall 2 / Fastify discussion
 * #5140).
 *
 * Sequencing is load-bearing and must not be reordered:
 *   1. `createLaunchContext()` — mints the per-launch token
 *      (`crypto.randomUUID()`, D-05). Never hand-rolled.
 *   2. `buildApp({ ctx, clientRoot, warn })` — composes the guarded
 *      Fastify app (Plan 04/05). Never calls `listen()` itself.
 *   3. `await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' })` —
 *      D-02: port 0 lets the OS assign a free ephemeral port. The host is
 *      the loopback literal and nothing else — no flag or env var can
 *      change it.
 *   4. Read the assigned port back from `app.server.address()`.
 *   5. `sealLaunchContext(ctx, port)` — MUST run before any request can
 *      arrive. Requests cannot arrive before `listen()` resolves, so this
 *      ordering is safe (02-RESEARCH.md Pattern 3's "origin is a runtime
 *      value" gotcha).
 *   6. Print the banner via `out.banner(url)`.
 *   7. Auto-open the browser (or print the `--no-open` hint), with the
 *      `open()` call wrapped in its own try/catch — a headless box, WSL
 *      without interop, or no default browser must NOT kill the server.
 *
 * `bootstrap()` deliberately does NOT register process-wide signal
 * handlers — that stays in `cli.ts` (`registerSignalHandlers`) so
 * in-process tests can call `bootstrap()` repeatedly without installing a
 * process-wide handler per test.
 */
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/src/app.js';
import { createLaunchContext, sealLaunchContext, type LaunchContext } from '../../server/src/context.js';
import { createOutput, type OutputPort } from './output.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `dist/client`, resolved relative to the running module. This must handle
 * TWO different on-disk layouts, not one:
 *   - From source (tsx, tests): this file lives at `packages/cli/src/`, three
 *     directories below the repo root, which is where `dist/client` lives.
 *   - Bundled (tsup's `dist/cli.js`, the published artifact): this module's
 *     code is inlined directly into `dist/cli.js`, so `__dirname` at runtime
 *     is `dist/` itself — `dist/client` is a DIRECT SIBLING, not three
 *     levels up. Reusing the from-source math here would walk three levels
 *     above the package root and silently miss the shipped client bundle
 *     (caught by 02-07-PLAN.md Task 3's extracted-tarball smoke run, which
 *     runs the built `dist/cli.js` from a clean extraction outside the repo
 *     — a check the in-repo test suite can never exercise since `__dirname`
 *     there is always the source-layout path).
 * Try the bundled (sibling) layout first and fall back to the from-source
 * layout only if it doesn't resolve, rather than branching on how the
 * process was launched.
 */
function defaultClientRoot(): string {
  const bundledCandidate = join(__dirname, 'client');
  if (existsSync(join(bundledCandidate, 'index.html'))) {
    return bundledCandidate;
  }
  return join(__dirname, '..', '..', '..', 'dist', 'client');
}

export interface BootstrapOptions {
  /** Bind an explicit port instead of an OS-assigned one (D-02: only path where `EADDRINUSE` is reachable). */
  port?: number;
  /** Whether to auto-launch the browser after bind. */
  open: boolean;
}

export interface BootstrapDeps {
  /** Defaults to the real `open` package. Injected so tests can observe the call without really launching a browser. */
  open?: (url: string) => Promise<unknown>;
  /** Defaults to `createOutput()` (real stdout). Injected so tests never print to the real terminal. */
  out?: OutputPort;
  /** Defaults to `dist/client` resolved relative to this module. */
  clientRoot?: string;
}

export interface BootstrapHandle {
  app: FastifyInstance;
  url: string;
  port: number;
  token: string;
  ctx: LaunchContext;
  /** Awaited close — always await this, never fire-and-forget (02-RESEARCH.md Pitfall 2). */
  shutdown: () => Promise<void>;
}

export async function bootstrap(opts: BootstrapOptions, deps: BootstrapDeps = {}): Promise<BootstrapHandle> {
  const out = deps.out ?? createOutput();
  const openFn = deps.open ?? ((url: string) => open(url));
  const clientRoot = deps.clientRoot ?? defaultClientRoot();

  const ctx = createLaunchContext();
  const app = await buildApp({ ctx, clientRoot, warn: (message) => out.warnLine(message) });

  await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
  const { port } = app.server.address() as AddressInfo;

  // Must run before any request can arrive — safe because no request can
  // reach the server until listen() (above) has already resolved.
  sealLaunchContext(ctx, port);

  const url = `http://127.0.0.1:${port}/?t=${ctx.token}`;
  out.banner(url);

  if (opts.open) {
    try {
      await openFn(url);
    } catch {
      // Losing the browser must never lose the session (T-02-29).
      out.openFailed(url);
    }
  } else {
    out.noOpenHint();
  }

  let shuttingDown = false;

  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    out.shuttingDown();

    // Generous safety net (02-RESEARCH.md: close-with-grace's 500ms default
    // is flagged as dangerously aggressive) — unref'd so it never itself
    // keeps the process alive.
    const forceExit = setTimeout(() => process.exit(1), 5_000);
    forceExit.unref();

    try {
      // Always awaited: a fire-and-forget close lets process.exit() run
      // before the socket is actually released (Fastify discussion #5140),
      // which is exactly what the teardown suite's ECONNREFUSED probe
      // catches.
      await app.close();
    } finally {
      clearTimeout(forceExit);
    }

    // Printed only after close() has resolved — never before.
    out.stopped();
  }

  return { app, url, port, token: ctx.token, ctx, shutdown };
}

export interface RegisterSignalHandlersDeps {
  /** Defaults to the global `process`. Injectable for testability. */
  process?: NodeJS.Process;
}

/**
 * Wires SIGINT/SIGTERM to `handle.shutdown()` followed by `process.exit(0)`.
 * Uses `process.once` per signal so a double Ctrl-C cannot re-enter this
 * handler (the re-entrancy flag inside `shutdown()` is a second, independent
 * safety net).
 */
export function registerSignalHandlers(handle: BootstrapHandle, deps: RegisterSignalHandlersDeps = {}): void {
  const proc = deps.process ?? process;

  const onSignal = (): void => {
    void (async () => {
      await handle.shutdown();
      proc.exit(0);
    })();
  };

  proc.once('SIGINT', onSignal);
  proc.once('SIGTERM', onSignal);

  // Windows test-environment fallback (Rule 3 blocking-issue fix,
  // documented as a deviation in 02-06-SUMMARY.md): on Windows,
  // `child_process.kill()`/`process.kill()` perform an UNCONDITIONAL
  // `TerminateProcess` for every signal name — confirmed empirically,
  // matching Node's own documented behavior — so a sandboxed shell with no
  // real attached Win32 console (this repo's dev/test environment) cannot
  // deliver a genuine, catchable SIGINT/SIGTERM to a child process at all;
  // there is no pure-JS/no-new-dependency way to synthesize one (the only
  // real mechanism, `GenerateConsoleCtrlEvent`, requires a console that
  // does not exist here). When an IPC channel is present — true ONLY when
  // a parent explicitly spawns with `stdio: [..., 'ipc']`, which a real
  // `npx gsd-config-manager` launch from a shell never does — also accept
  // an IPC message equal to `'SIGINT'` or `'SIGTERM'` as an equivalent
  // trigger for the exact same `onSignal` path, so the automated teardown
  // suite can still exercise the real awaited-close/ordering/port-release
  // behavior deterministically on this platform.
  if (typeof proc.send === 'function') {
    proc.once('message', (msg: unknown) => {
      if (msg === 'SIGINT' || msg === 'SIGTERM') onSignal();
    });
  }
}
