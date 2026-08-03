/**
 * saveWithSnapshot() — the server-layer wrapper that composes Phase 1's
 * FROZEN `saveConfig` with the snapshot store (SAVE-04, D-10, D-11, D-12,
 * 02-RESEARCH.md § Pattern 7).
 *
 * D-10: snapshotting is a server concern, implemented purely by
 * composition. This file imports the frozen `saveConfig`/`ValidationError`
 * implementation and never modifies or reimplements them.
 *
 * Orchestration order (D-11 — pre-write snapshot of the CURRENT on-disk
 * content, taken before the write, recorded only after it succeeds):
 *   1. Read the current on-disk content. ENOENT -> prior content is `null`
 *      (first-ever save; nothing to snapshot). Any other read error
 *      rethrows.
 *   2. Call `saveConfig` UNMODIFIED. A `ValidationError` becomes
 *      `{ ok: false, errors }`; any other error rethrows (a genuine write
 *      failure is not a soft failure).
 *   3. Only after the save succeeds, attempt to record the snapshot in its
 *      own narrowly-scoped try/catch.
 *   4. On snapshot failure (D-12), the save is NOT rethrown or failed — a
 *      non-blocking warning is built from the error's `code`/`message` only
 *      (never the config content, never a stack trace — T-02-12
 *      Information Disclosure guard) and returned to the caller.
 *
 * This asymmetry — a `saveConfig` failure propagates, a `recordSnapshot`
 * failure is swallowed into a warning — mirrors how `atomic-write.ts`
 * isolates its lock-release `finally` from the validate/write logic above
 * it: one clearly-scoped try block per concern, never one blanket
 * try/catch (02-PATTERNS.md § snapshot-store/index.ts + save-with-snapshot.ts).
 *
 * `SaveResult` is a frozen contract: Plan 05's `PUT /api/configs/:id` route
 * returns it directly as the API envelope, and Phase 5's revert (which
 * re-enters through this exact function — D-10: revert-as-write, no
 * special-case path) reuses it too.
 *
 * Blocking-issue fix (Rule 3, scoped entirely to this file — `config-io` is
 * NOT touched): the frozen `saveConfig` locks via `proper-lockfile`'s
 * `lock()`, which defaults to `realpath: true` and therefore requires the
 * target file to already exist (it `lstat`s the path before creating the
 * `.lock` directory) — it cannot lock a path that has never been written.
 * For a brand-new config, this wrapper pre-touches an empty stub file
 * BEFORE delegating to `saveConfig`, strictly after `priorContent` has
 * already been captured as `null` — so D-11's "nothing to snapshot" holds
 * regardless, and `saveConfig`'s own validate -> atomic-write pipeline
 * still runs unmodified against the real target path.
 *
 * CR-03 fix (concurrent-save race, scoped entirely to this file):
 * `proper-lockfile`'s advisory lock (inside `saveConfig`) only ever covers
 * the write itself — it does NOT span this wrapper's own
 * read-prior-content -> saveConfig -> recordSnapshot sequence, and
 * `recordSnapshot`'s own `index.json` read-modify-write (snapshot-store's
 * `index.ts`) has no lock of its own. Two concurrent `saveWithSnapshot`
 * calls for the SAME resolved config path can otherwise both read the same
 * `priorContent` before either writes, or race `recordSnapshot`'s `seq`
 * computation, silently dropping a version-history entry. `withPathLock`
 * serializes callers in one helper, while `withTransactionLock` applies the
 * same resolved-path transaction boundary across independently launched
 * helpers. Together they keep every save's prior state available for history.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { lock } from 'proper-lockfile';
import { saveConfig, ValidationError } from '../../../config-io/src/atomic-write.js';
import type { ValidationResult } from '../../../config-io/src/types.js';
import { recordSnapshot, type SnapshotRecordResult, type PrunePolicy, type SnapshotWriteDeps } from './index.js';

/**
 * Per-resolved-path in-process async mutex (CR-03). Keyed by
 * `resolve(configPath)` so path-string variance (relative vs. absolute,
 * trailing separators) collapses onto the same lock, mirroring
 * `paths.ts#snapshotDirFor`'s own resolve-before-hash discipline.
 *
 * `prior.then(fn, fn)` runs `fn` only after the PRIOR queued call for this
 * key has settled — whether it resolved OR rejected — so one failed save
 * never wedges the queue for the next one. `chained` is a
 * never-rejecting view of that same settlement used purely to advance the
 * queue; `run` (the real, possibly-rejecting result) is what the caller
 * actually awaits. The map entry is deleted once this call is the last one
 * queued for its key, so the map never grows unbounded across the
 * process's lifetime.
 */
const pathLocks = new Map<string, Promise<unknown>>();

function withPathLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = pathLocks.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  const chained = run.then(
    () => undefined,
    () => undefined,
  );
  pathLocks.set(key, chained);
  void chained.finally(() => {
    if (pathLocks.get(key) === chained) pathLocks.delete(key);
  });
  return run;
}

/**
 * Cross-process transaction lock. It intentionally lives outside the target
 * config and snapshot directories: `saveConfig` owns the config-file lock and
 * `recordSnapshot` owns the index lock, so nesting either of those here could
 * self-deadlock. All helpers resolving the same config path derive this one
 * stable lock path and hold it across the whole transaction.
 */
function transactionLockPath(resolvedConfigPath: string): string {
  return join(tmpdir(), 'gsd-config-manager-save-locks', `${createHash('sha256').update(resolvedConfigPath).digest('hex')}.lock`);
}

async function withTransactionLock<T>(resolvedConfigPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = transactionLockPath(resolvedConfigPath);
  await mkdir(join(tmpdir(), 'gsd-config-manager-save-locks'), { recursive: true });
  await writeFile(lockPath, '', { flag: 'a' });
  const release = await lock(lockPath, { retries: { retries: 50, factor: 1.2, minTimeout: 10, maxTimeout: 250 }, stale: 30_000 });
  try {
    return await fn();
  } finally {
    await release();
  }
}

/** Opaque revision of the exact on-disk document bytes. */
export function configRevision(content: string | null): string {
  return createHash('sha256').update(content === null ? 'gsd-config-manager:missing' : `gsd-config-manager:content:${content}`).digest('hex');
}

/** The frozen server-layer save-result envelope (D-10). */
export type SaveResult =
  | { ok: true; snapshotId?: string; warning?: string; revision: string }
  | { ok: false; errors: object[] }
  | { ok: false; conflict: true };

/** Injectable dependencies for `saveWithSnapshot`, enabling fault injection without module mocking. */
export interface SaveDeps {
  recordDeps?: SnapshotWriteDeps;
  root?: string;
  warn?: (message: string) => void;
  prunePolicy?: PrunePolicy;
}

/**
 * Composes Phase 1's frozen `saveConfig` with a pre-write snapshot of the
 * config's current on-disk content. See module header for the full
 * orchestration order (D-11) and the non-fatal snapshot-failure contract
 * (D-12).
 */
export async function saveWithSnapshot(
  configPath: string,
  nextConfig: object,
  validate: (data: unknown) => ValidationResult,
  expectedRevisionOrDeps: string | SaveDeps | undefined = undefined,
  suppliedDeps: SaveDeps = {},
): Promise<SaveResult> {
  const expectedRevision = typeof expectedRevisionOrDeps === 'string' ? expectedRevisionOrDeps : undefined;
  const deps = typeof expectedRevisionOrDeps === 'string' ? suppliedDeps : expectedRevisionOrDeps ?? suppliedDeps;
  // Serialize the ENTIRE read-prior -> safe config write -> committed index
  // sequence per resolved config path in both this process and peer helpers.
  const resolvedConfigPath = resolvePath(configPath);
  return withPathLock(resolvedConfigPath, () => withTransactionLock(
    resolvedConfigPath,
    () => saveWithSnapshotUnlocked(configPath, nextConfig, validate, expectedRevision, deps),
  ));
}

async function saveWithSnapshotUnlocked(
  configPath: string,
  nextConfig: object,
  validate: (data: unknown) => ValidationResult,
  expectedRevision: string | undefined,
  deps: SaveDeps,
): Promise<SaveResult> {
  const warn = deps.warn ?? console.warn;

  // 1. Read current on-disk content (for the pre-write snapshot). D-11:
  //    ENOENT means this is a brand-new file — nothing to snapshot.
  let priorContent: string | null;
  // CR-02 fix: tracks whether THIS call created the pre-touch stub, so a
  // subsequent saveConfig failure can roll it back and leave the
  // filesystem exactly as it was found — never unlinking a pre-existing
  // user file.
  let stubCreated = false;
  try {
    priorContent = await readFile(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      priorContent = null;
      // proper-lockfile's lock() (inside saveConfig) requires the target
      // file to already exist — pre-touch an empty stub so the frozen
      // pipeline can lock a brand-new path. Safe: priorContent is already
      // captured as null above, so the snapshot skip (D-11) is unaffected.
      await writeFile(configPath, '', { flag: 'wx' }).then(
        () => {
          stubCreated = true;
        },
        (touchErr) => {
          if ((touchErr as NodeJS.ErrnoException).code !== 'EEXIST') throw touchErr;
        },
      );
    } else {
      throw err;
    }
  }

  if (expectedRevision !== undefined && configRevision(priorContent) !== expectedRevision) {
    return { ok: false, conflict: true };
  }

  // 2. Call the frozen saveConfig UNMODIFIED. A validation failure is a
  //    soft failure surfaced to the caller; any other error is a genuine
  //    write failure and must propagate (the user must know their save did
  //    not happen). CR-02: if THIS call created the pre-touch stub above
  //    and the save did not succeed, unlink it so a brand-new path's
  //    failed first save leaves no file behind — matching the pre-existing
  //    file behavior of "on-disk file guaranteed byte-unchanged".
  try {
    await saveConfig(configPath, nextConfig, validate);
  } catch (err) {
    if (stubCreated) {
      await unlink(configPath).catch(() => undefined);
    }
    if (err instanceof ValidationError) {
      return { ok: false, errors: err.errors };
    }
    throw err;
  }

  const revision = configRevision(await readFile(configPath, 'utf8'));

  // 3. Only after the save succeeds, attempt to record the snapshot in its
  //    own narrowly-scoped try/catch (D-12: a recording failure must never
  //    fail the save, which has already committed).
  let snapshotRecord: SnapshotRecordResult | undefined;
  try {
    snapshotRecord = await recordSnapshot(configPath, priorContent, deps.root, deps.recordDeps, deps.prunePolicy);
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code ?? (err as Error).message ?? 'unknown error';
    const warning = `Saved successfully, but history was not recorded (${reason}). Your changes are safe; version history for this save is unavailable.`;
    warn(warning);
    return { ok: true, warning, revision };
  }

  return { ok: true, snapshotId: snapshotRecord?.snapshotId, revision };
}
