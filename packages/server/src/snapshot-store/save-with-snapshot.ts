/**
 * saveWithSnapshot() — the server-layer wrapper that composes Phase 1's
 * FROZEN `saveConfig` with the snapshot store (SAVE-04, D-10, D-11, D-12,
 * 02-RESEARCH.md § Pattern 7).
 *
 * D-10: snapshotting is a server concern, implemented purely by
 * composition. This file imports `saveConfig`/`ValidationError` from the
 * frozen `config-io` barrel and never modifies or reimplements them.
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
 */
import { readFile, writeFile } from 'node:fs/promises';
import { saveConfig, ValidationError } from '../../../config-io/src/index.js';
import type { ValidationResult } from '../../../config-io/src/types.js';
import { recordSnapshot } from './index.js';

/** The frozen server-layer save-result envelope (D-10). */
export type SaveResult =
  | { ok: true; snapshotId?: string; warning?: string }
  | { ok: false; errors: object[] };

/** Injectable dependencies for `saveWithSnapshot`, enabling fault injection without module mocking. */
export interface SaveDeps {
  record?: typeof recordSnapshot;
  root?: string;
  warn?: (message: string) => void;
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
  deps: SaveDeps = {},
): Promise<SaveResult> {
  const record = deps.record ?? recordSnapshot;
  const warn = deps.warn ?? console.warn;

  // 1. Read current on-disk content (for the pre-write snapshot). D-11:
  //    ENOENT means this is a brand-new file — nothing to snapshot.
  let priorContent: string | null;
  try {
    priorContent = await readFile(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      priorContent = null;
      // proper-lockfile's lock() (inside saveConfig) requires the target
      // file to already exist — pre-touch an empty stub so the frozen
      // pipeline can lock a brand-new path. Safe: priorContent is already
      // captured as null above, so the snapshot skip (D-11) is unaffected.
      await writeFile(configPath, '', { flag: 'wx' }).catch((touchErr) => {
        if ((touchErr as NodeJS.ErrnoException).code !== 'EEXIST') throw touchErr;
      });
    } else {
      throw err;
    }
  }

  // 2. Call the frozen saveConfig UNMODIFIED. A validation failure is a
  //    soft failure surfaced to the caller; any other error is a genuine
  //    write failure and must propagate (the user must know their save did
  //    not happen).
  try {
    await saveConfig(configPath, nextConfig, validate);
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, errors: err.errors };
    }
    throw err;
  }

  // 3. Only after the save succeeds, attempt to record the snapshot in its
  //    own narrowly-scoped try/catch (D-12: a recording failure must never
  //    fail the save, which has already committed).
  let snapshotId: string | undefined;
  try {
    snapshotId = await record(configPath, priorContent, deps.root);
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code ?? (err as Error).message ?? 'unknown error';
    const warning = `Saved successfully, but history was not recorded (${reason}). Your changes are safe; version history for this save is unavailable.`;
    warn(warning);
    return { ok: true, warning };
  }

  return { ok: true, snapshotId };
}
