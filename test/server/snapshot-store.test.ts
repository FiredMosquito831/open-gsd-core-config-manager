import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ValidationResult } from '../../packages/config-io/src/types.js';
import { saveWithSnapshot } from '../../packages/server/src/snapshot-store/save-with-snapshot.js';
import { readIndex } from '../../packages/server/src/snapshot-store/index.js';
import { snapshotDirFor } from '../../packages/server/src/snapshot-store/paths.js';

/**
 * SAVE-04 (D-10/D-11/D-12) — saveWithSnapshot orchestration tests.
 *
 * Follows test/config-io/atomic-write.test.ts's house style: real
 * saveConfig, real filesystem, `mkdtempSync(join(tmpdir(), 'gsdcm-<feature>-'))`
 * temp dirs. Two SEPARATE temp dirs are used per test — one standing in for
 * the user's project (holding config.json) and one standing in for the
 * app-data root — passed as the injectable `root` parameter so the store is
 * redirected without mocking `env-paths` (per the plan's acceptance
 * criteria).
 */

const alwaysValid = (): ValidationResult => ({ valid: true, errors: [] });
const alwaysInvalid = (): ValidationResult => ({
  valid: false,
  errors: [{ instancePath: '/foo', keyword: 'type' }],
});

let projectDir: string;
let appDataRoot: string;
let configPath: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'gsdcm-snapshot-store-project-'));
  appDataRoot = mkdtempSync(join(tmpdir(), 'gsdcm-snapshot-store-appdata-'));
  configPath = join(projectDir, 'config.json');
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(appDataRoot, { recursive: true, force: true });
});

describe('saveWithSnapshot — records snapshot before overwrite (SAVE-04, D-11)', () => {
  it('records snapshot before overwrite', async () => {
    const priorContent = '{"a":1}';
    writeFile(configPath, priorContent);

    const result = await saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot });

    expect(result.ok).toBe(true);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ a: 2 });

    const dir = snapshotDirFor(configPath, appDataRoot);
    const index = await readIndex(dir);
    expect(index.entries).toHaveLength(1);
    const entry = index.entries[0];
    expect(entry.seq).toBe(1);
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    expect(entry.contentHash).toBe(createHash('sha256').update(priorContent).digest('hex'));
    expect(typeof entry.file).toBe('string');

    const snapshotContent = readFileSync(join(dir, entry.file), 'utf8');
    expect(snapshotContent).toBe(priorContent);
  });
});

describe('saveWithSnapshot — first-ever save skips gracefully (SAVE-04, D-11)', () => {
  it('skips snapshot on first save', async () => {
    expect(existsSync(configPath)).toBe(false);

    const result = await saveWithSnapshot(configPath, { fresh: true }, alwaysValid, { root: appDataRoot });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshotId).toBeUndefined();
    }
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ fresh: true });

    const dir = snapshotDirFor(configPath, appDataRoot);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(dir, 'index.json'))).toBe(false);
  });
});

describe('saveWithSnapshot — snapshot-recording failure is non-fatal (SAVE-04, D-12)', () => {
  it('save succeeds even if snapshot recording fails', async () => {
    const priorContent = '{"secretApiKey":"sk-super-secret-value"}';
    writeFile(configPath, priorContent);

    const failingRecord = async (): Promise<string | undefined> => {
      throw new Error('disk full');
    };

    const result = await saveWithSnapshot(configPath, { replaced: true }, alwaysValid, {
      root: appDataRoot,
      record: failingRecord,
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ replaced: true });
    if (result.ok) {
      expect(result.snapshotId).toBeUndefined();
      expect(typeof result.warning).toBe('string');
      expect(result.warning).not.toContain('secretApiKey');
      expect(result.warning).not.toContain('sk-super-secret-value');
    }
  });
});

describe('saveWithSnapshot — snapshot is stored outside the tracked project directory (SAVE-04, D-07, T-02-06)', () => {
  it('snapshot is stored outside the tracked project directory', async () => {
    writeFile(configPath, '{"a":1}');

    await saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot });

    const dir = snapshotDirFor(configPath, appDataRoot);
    const resolvedProjectDir = join(projectDir);
    expect(dir.startsWith(resolvedProjectDir)).toBe(false);
    expect(dir.split(/[\\/]/)).not.toContain('.git');
  });
});

describe('saveWithSnapshot — second save increments seq (SAVE-04, D-09)', () => {
  it('second save increments seq', async () => {
    writeFile(configPath, '{"a":1}');

    await saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot });
    await saveWithSnapshot(configPath, { a: 3 }, alwaysValid, { root: appDataRoot });

    const dir = snapshotDirFor(configPath, appDataRoot);
    const index = await readIndex(dir);
    expect(index.entries).toHaveLength(2);
    expect(index.entries[0].seq).toBe(1);
    expect(index.entries[1].seq).toBe(2);
    expect(index.entries[0].file).not.toBe(index.entries[1].file);
  });
});

describe('saveWithSnapshot — validation failure blocks the write and records no snapshot (SAVE-01 through the wrapper)', () => {
  it('validation failure blocks the write and records no snapshot', async () => {
    const original = '{"a":1}';
    writeFile(configPath, original);

    const result = await saveWithSnapshot(configPath, { a: 'bad' }, alwaysInvalid, { root: appDataRoot });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ instancePath: '/foo', keyword: 'type' }]);
    }
    expect(readFileSync(configPath, 'utf8')).toBe(original);

    const dir = snapshotDirFor(configPath, appDataRoot);
    expect(existsSync(dir)).toBe(false);
  });
});

function writeFile(path: string, content: string): void {
  writeFileSync(path, content, 'utf8');
}
