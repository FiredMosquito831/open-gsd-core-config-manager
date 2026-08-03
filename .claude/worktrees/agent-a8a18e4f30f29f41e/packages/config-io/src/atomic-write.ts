/**
 * Corruption-proof write pipeline (SAVE-02, success criterion #4) with the
 * validation-blocking save gate (SAVE-01, success criterion #3).
 *
 * Pipeline order (01-RESEARCH.md § Decision: Atomic-Write Mechanics):
 *   proper-lockfile.lock(path)
 *     -> validate(obj)  -- BLOCKS here, before any write, on failure (SAVE-01)
 *     -> writeWithRetry -- write-file-atomic@7 (temp-in-same-dir -> fsync ->
 *        rename) wrapped in an OUTER EPERM/EBUSY/EACCES retry-with-backoff
 *     -> release() in `finally`, always
 *
 * `write-file-atomic@7.0.1` (the pinned version per CLAUDE.md) has NO
 * built-in Windows rename retry as of this research — GitHub issue #227 is
 * still open. On Windows, `fs.rename(tmpfile, truename)` can transiently
 * fail with EPERM/EBUSY/EACCES when Windows Defender, the search indexer,
 * or a concurrent process briefly locks the target file. The retry wrapper
 * below is not optional hardening: it fills a real, currently-unpatched gap
 * in the pinned dependency itself (01-RESEARCH.md § Verified: write-file-
 * atomic Has No Built-In Windows Retry).
 *
 * write-file-atomic's default same-directory temp-file placement is what
 * makes the final rename atomic; this module must never override the temp
 * directory (a cross-device temp dir would turn the rename into a
 * non-atomic copy+delete and risk EXDEV).
 */
import writeFileAtomic from 'write-file-atomic';
import { lock } from 'proper-lockfile';
import type { ValidationResult } from './types.js';

/** Error codes `write-file-atomic` itself does not retry on Windows (issue #227). */
export const RETRYABLE_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Maximum write attempts before giving up and rethrowing the last error. */
export const MAX_ATTEMPTS = 5;

/** Base backoff delay in ms; actual delay is `BASE_DELAY_MS * 2 ** attempt`. */
export const BASE_DELAY_MS = 50;

/**
 * Thrown by `saveConfig` when `validate(obj)` reports `{ valid: false }`.
 * Carries only the Ajv-shaped field errors (never the config body itself —
 * an Information Disclosure guard for secret-shaped fields, T-01-InfoDisc-W).
 */
export class ValidationError extends Error {
  readonly errors: object[];

  constructor(path: string, errors: object[]) {
    super(`Validation failed for ${path}: ${errors.length} error(s)`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Writes `content` to `path` via `write-file-atomic`, retrying transient
 * Windows lock/permission errors (EPERM/EBUSY/EACCES) with exponential
 * backoff up to `MAX_ATTEMPTS`. Any other error code (e.g. EINVAL) is
 * rethrown immediately without retry. After exhausting all attempts on a
 * retryable code, the last error is rethrown.
 *
 * Never overrides write-file-atomic's temp-file directory — the library's
 * own same-directory default is required for the rename to be atomic.
 */
export async function writeWithRetry(path: string, content: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await writeFileAtomic(path, content, { fsync: true, encoding: 'utf8' });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE_CODES.has(code)) {
        throw err;
      }
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * The lock -> validate-block -> atomic-write -> unlock save pipeline.
 *
 * `validate` is dependency-injected (rather than imported directly from
 * `./validate.js`) so unit tests can supply a stub validator and the real
 * caller passes Plan 03's `createValidator(...)`-produced closure —
 * `saveConfig` itself has no opinion on which schema is being enforced.
 *
 * On validation failure: throws `ValidationError` WITHOUT ever calling
 * `writeWithRetry`/`writeFileAtomic` — no partial write on invalid input
 * (SAVE-01). The advisory lock is always released via `finally`, on both
 * the validation-failure and write-failure paths.
 */
export async function saveConfig(
  path: string,
  obj: object,
  validate: (data: unknown) => ValidationResult,
): Promise<void> {
  const release = await lock(path, {
    retries: { retries: 5, factor: 1.3 },
    stale: 10_000,
  });
  try {
    const result = validate(obj);
    if (!result.valid) {
      throw new ValidationError(path, result.errors);
    }
    await writeWithRetry(path, JSON.stringify(obj, null, 2));
  } finally {
    await release();
  }
}
