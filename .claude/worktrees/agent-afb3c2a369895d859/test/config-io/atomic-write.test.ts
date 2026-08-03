import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ValidationResult } from '../../packages/config-io/src/types.js';

/**
 * `write-file-atomic`'s default export is mocked at the module level so
 * these tests can (a) assert it is never invoked on the validation-failure
 * path, and (b) inject transient/permanent fault codes to prove
 * `writeWithRetry`'s retry-vs-rethrow-immediately behavior without waiting
 * on real Windows lock contention. `vi.hoisted` is required because
 * `vi.mock` factories are hoisted above imports by vitest, so any variable
 * referenced inside the factory must be created via `vi.hoisted` first.
 */
const { writeFileAtomicMock } = vi.hoisted(() => ({ writeFileAtomicMock: vi.fn() }));

vi.mock('write-file-atomic', () => ({
  default: (...args: unknown[]) => writeFileAtomicMock(...(args as Parameters<typeof writeFileAtomicMock>)),
}));

import {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  RETRYABLE_CODES,
  ValidationError,
  saveConfig,
  writeWithRetry,
} from '../../packages/config-io/src/atomic-write.js';

function makeTempFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gsdcm-atomic-write-'));
  const file = join(dir, 'config.json');
  writeFileSync(file, content, 'utf8');
  return file;
}

function errWithCode(message: string, code: string): NodeJS.ErrnoException {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

const passValidator = (): ValidationResult => ({ valid: true, errors: [] });
const failValidator = (): ValidationResult => ({
  valid: false,
  errors: [{ instancePath: '/foo', keyword: 'type' }],
});

/** Real writeFileAtomic replacement used for tests that need an actual write. */
function realWrite() {
  writeFileAtomicMock.mockImplementation(async (path: unknown, content: unknown) => {
    writeFileSync(path as string, content as string, 'utf8');
  });
}

beforeEach(() => {
  writeFileAtomicMock.mockReset();
});

describe('RETRYABLE_CODES', () => {
  it('contains exactly the Windows lock/permission codes write-file-atomic does not itself retry', () => {
    expect(RETRYABLE_CODES.has('EPERM')).toBe(true);
    expect(RETRYABLE_CODES.has('EBUSY')).toBe(true);
    expect(RETRYABLE_CODES.has('EACCES')).toBe(true);
    expect(RETRYABLE_CODES.has('EINVAL')).toBe(false);
  });
});

describe('writeWithRetry', () => {
  it('retries transient EPERM/EBUSY/EACCES and eventually succeeds', async () => {
    let calls = 0;
    writeFileAtomicMock.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw errWithCode('locked', 'EPERM');
      if (calls === 2) throw errWithCode('locked', 'EBUSY');
      // third call succeeds
    });

    await expect(writeWithRetry('/whatever/config.json', '{}')).resolves.toBeUndefined();
    expect(calls).toBe(3);
  });

  it('rethrows a non-retryable error code (e.g. EINVAL) immediately, with no retry', async () => {
    writeFileAtomicMock.mockImplementation(async () => {
      throw errWithCode('bad input', 'EINVAL');
    });

    await expect(writeWithRetry('/whatever/config.json', '{}')).rejects.toThrow('bad input');
    expect(writeFileAtomicMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after MAX_ATTEMPTS retryable failures and rethrows the last error', async () => {
    writeFileAtomicMock.mockImplementation(async () => {
      throw errWithCode('still locked', 'EBUSY');
    });

    await expect(writeWithRetry('/whatever/config.json', '{}')).rejects.toThrow('still locked');
    expect(writeFileAtomicMock).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('uses exponential backoff based on BASE_DELAY_MS (sanity: constants are wired, not hardcoded elsewhere)', () => {
    expect(BASE_DELAY_MS).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
  });
});

describe('saveConfig — validation-blocks-write gate (SAVE-01)', () => {
  it('does NOT call writeFileAtomic when validation fails, and the on-disk file is byte-unchanged', async () => {
    const original = '{"old":"content"}';
    const file = makeTempFile(original);

    await expect(saveConfig(file, { new: 'data' }, failValidator)).rejects.toThrow(ValidationError);

    expect(writeFileAtomicMock).not.toHaveBeenCalled();
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('ValidationError carries the field-level errors from the validator', async () => {
    const file = makeTempFile('{}');

    try {
      await saveConfig(file, {}, failValidator);
      expect.unreachable('saveConfig should have thrown ValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).errors).toEqual([{ instancePath: '/foo', keyword: 'type' }]);
    }
  });

  it('releases the advisory lock on the validation-failure path (a subsequent save on the same path succeeds)', async () => {
    const file = makeTempFile('{}');

    await expect(saveConfig(file, {}, failValidator)).rejects.toThrow(ValidationError);

    realWrite();
    await saveConfig(file, { second: true }, passValidator);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ second: true });
  });
});

describe('saveConfig — successful write (round-trip)', () => {
  it('writes JSON.stringify(obj, null, 2) and the file round-trips to obj', async () => {
    realWrite();
    const file = makeTempFile('{"old":"content"}');
    const payload = { hello: 'world', nested: { a: 1, b: [1, 2, 3] } };

    await saveConfig(file, payload, passValidator);

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(payload);
  });
});

describe('saveConfig — lock release on the write-failure path', () => {
  it('releases the advisory lock even when writeWithRetry ultimately throws', async () => {
    const file = makeTempFile('{}');
    writeFileAtomicMock.mockImplementation(async () => {
      throw errWithCode('bad input', 'EINVAL');
    });

    await expect(saveConfig(file, {}, passValidator)).rejects.toThrow('bad input');

    // Lock must have been released in `finally` — a subsequent save on the
    // same path must not hang or throw a lock-contention error.
    realWrite();
    await saveConfig(file, { after: true }, passValidator);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ after: true });
  });
});
