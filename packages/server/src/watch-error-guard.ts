/**
 * Process-level guard for file-watcher errors (D-14, chokidar).
 *
 * The tracked-config file watcher is a *best-effort* change-notification
 * channel: every tracked config's status (`ok` / `missing` / `invalid`) is
 * derived on load and re-derived on every change event (workspace-store.ts),
 * so the UI is always correct whether or not the watcher is live. A path the
 * OS refuses to watch must therefore never be allowed to crash the server.
 *
 * The catch is *where* that refusal surfaces. When the OS denies a directory
 * watch, the error is thrown natively inside Node's libuv `fs.watch` callback
 * (`node:internal/fs/watchers` — `FSEvent.FSWatcher._handle.onchange`), which is
 * below chokidar's EventEmitter layer entirely. That means neither chokidar's
 * own `ignorePermissionErrors` option nor a `.on('error')` handler on the
 * chokidar FSWatcher ever sees it — it propagates as a raw uncaught exception.
 * The only mechanism that can catch it is a process-level `uncaughtException`
 * handler, which is what this module installs.
 *
 * Scope is deliberately narrow: it swallows ONLY permission/space errors whose
 * `syscall` is `watch` (EPERM, e.g. Windows without Developer Mode; ENOSPC,
 * e.g. the inotify/watcher limit hit). Every other uncaught exception is
 * logged and re-escalated to a non-zero exit — real bugs are never masked by
 * this guard.
 *
 * Idempotent: safe to call from both the production entry (cli-main.ts) and
 * from tests; the handler is installed at most once per process.
 */

let installed = false;

function isWatchPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as NodeJS.ErrnoException;
  return (
    e.syscall === 'watch' &&
    (e.code === 'EPERM' || e.code === 'ENOSPC' || e.code === 'EACCES')
  );
}

export function installWatchErrorHandler(): void {
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (err: unknown) => {
    if (isWatchPermissionError(err)) {
      const e = err as NodeJS.ErrnoException;
      console.error(
        `[gsd-config-manager] suppressed fs.watch ${e.code} (a tracked directory ` +
          `could not be watched; status is derived on load, so the UI stays correct): ${e.message}`,
      );
      return;
    }
    console.error('[gsd-config-manager] uncaught exception:', err);
    process.exit(1);
  });
}
