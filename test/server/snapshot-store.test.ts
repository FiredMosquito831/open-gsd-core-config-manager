import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidationResult } from '../../packages/config-io/src/types.js';
import { saveWithSnapshot } from '../../packages/server/src/snapshot-store/save-with-snapshot.js';
import { readIndex, recordSnapshot } from '../../packages/server/src/snapshot-store/index.js';
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

describe('saveWithSnapshot — two concurrent saves to the same config both land in the index (CR-03)', () => {
  it('two concurrent saves to the same config both land in the index', async () => {
    writeFile(configPath, '{"a":0}');

    // Fire both saves concurrently (no await between them) — before the
    // CR-03 fix, both would read the same priorContent and/or race
    // recordSnapshot's seq computation, silently dropping one entry.
    const [resultA, resultB] = await Promise.all([
      saveWithSnapshot(configPath, { a: 1 }, alwaysValid, { root: appDataRoot }),
      saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot }),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    const dir = snapshotDirFor(configPath, appDataRoot);
    const index = await readIndex(dir);

    // Both concurrent saves must have recorded a snapshot — neither lost.
    expect(index.entries).toHaveLength(2);
    const seqs = index.entries.map((e) => e.seq).sort((x, y) => x - y);
    expect(seqs).toEqual([1, 2]);
    // Distinct snapshot files, no clobbering.
    expect(index.entries[0].file).not.toBe(index.entries[1].file);
  });
});

describe('saveWithSnapshot — concurrent saves never lose a distinct historical state to the read-before-lock race (CR-03, deterministic)', () => {
  it('concurrent saves never lose a distinct historical state to the read-before-lock race', async () => {
    // The unsynchronized read ("read prior content") happens BEFORE
    // saveConfig's proper-lockfile lock is even requested, so without the
    // CR-03 per-path serialization, both concurrent calls' `readFile`
    // resolve before either has written — both capture the SAME original
    // content. Whichever save's write actually lands second then records a
    // snapshot of that STALE original content instead of the OTHER call's
    // just-committed value, silently erasing that intermediate state from
    // history. This assertion is order-independent: across both recorded
    // snapshots plus the final on-disk content, all three distinct states
    // (original + both writes) must be represented exactly once — a
    // duplicate anywhere means one distinct state was never captured.
    writeFile(configPath, '{"a":0}');

    const [resultA, resultB] = await Promise.all([
      saveWithSnapshot(configPath, { a: 1 }, alwaysValid, { root: appDataRoot }),
      saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot }),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    const dir = snapshotDirFor(configPath, appDataRoot);
    const index = await readIndex(dir);
    expect(index.entries).toHaveLength(2);

    const snapshotContents = index.entries.map((e) => readFileSync(join(dir, e.file), 'utf8'));
    const finalOnDisk = readFileSync(configPath, 'utf8');
    const allStates = new Set([...snapshotContents, finalOnDisk]);

    // {"a":0} (original), plus whichever of {"a":1}/{"a":2} committed first
    // (captured as a snapshot), plus whichever committed last (the final
    // on-disk content) — three distinct states, no duplicate/lost entry.
    expect(allStates.size).toBe(3);
  });
});

async function runSnapshotWorker(content: string): Promise<void> {
  const workerPath = fileURLToPath(new URL('./helpers/snapshot-record-worker.ts', import.meta.url));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workerPath, configPath, appDataRoot, content], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`snapshot worker exited ${code}: ${stderr}`)));
  });
}

describe('saveWithSnapshot cross-process transaction serialization (CR-02)', () => {
  it('preserves original, intermediate, and final states across independent helper processes', async () => {
    writeFile(configPath, '{"a":0}');
    await Promise.all([runSnapshotWorker('{"a":1}'), runSnapshotWorker('{"a":2}')]);

    const dir = snapshotDirFor(configPath, appDataRoot);
    const index = await readIndex(dir);
    expect(index.entries.map((entry) => entry.seq).sort((left, right) => left - right)).toEqual([1, 2]);
    expect(new Set(index.entries.map((entry) => entry.file)).size).toBe(2);

    const snapshotContents = index.entries.map((entry) => readFileSync(join(dir, entry.file), 'utf8'));
    const finalOnDisk = readFileSync(configPath, 'utf8');
    expect(new Set([...snapshotContents, finalOnDisk])).toEqual(new Set(['{"a":0}', '{\n  "a": 1\n}', '{\n  "a": 2\n}']));
  });
});

describe('snapshot-store atomic index replacement (CR-03)', () => {
  it('keeps the existing index valid and removes the orphan snapshot when index replacement fails', async () => {
    writeFile(configPath, '{"a":0}');
    await recordSnapshot(configPath, '{"a":0}', appDataRoot);
    const dir = snapshotDirFor(configPath, appDataRoot);
    const previousIndex = readFileSync(join(dir, 'index.json'), 'utf8');

    await expect(recordSnapshot(configPath, '{"a":1}', appDataRoot, {
      write: async (path, content) => {
        if (path.endsWith('index.json')) throw Object.assign(new Error('simulated index replacement failure'), { code: 'EIO' });
        writeFileSync(path, content, 'utf8');
      },
    })).rejects.toThrow('simulated index replacement failure');

    expect(readFileSync(join(dir, 'index.json'), 'utf8')).toBe(previousIndex);
    expect(await readIndex(dir)).toMatchObject({ entries: [{ seq: 1 }] });
    expect(existsSync(join(dir, '2.json'))).toBe(false);
  });
});

describe('snapshot-store trusted sequence reader contract (SAVE-05, T-05-01, T-05-02)', () => {
  it('reads only indexed canonical positive safe-integer snapshot files', async () => {
    writeFile(configPath, '{"a":1}');
    await saveWithSnapshot(configPath, { a: 2 }, alwaysValid, { root: appDataRoot });

    // Phase 5 adds this trusted reader. It must accept an exact indexed safe
    // integer and reject zero, negatives, decimals, exponent strings, leading
    // zeros, unsafe integers, traversal-like filenames, and tampered index
    // entries without exposing snapshot content or filesystem paths.
    const { readSnapshotBySequence } = await import('../../packages/server/src/snapshot-store/index.js');
    await expect(readSnapshotBySequence(configPath, 1, appDataRoot)).resolves.toMatchObject({ seq: 1, content: { a: 1 } });
    for (const sequence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(readSnapshotBySequence(configPath, sequence, appDataRoot)).rejects.toThrow('Invalid snapshot sequence');
    }

    const dir = snapshotDirFor(configPath, appDataRoot);
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ entries: [{ seq: 1, file: '../secret.json' }] }));
    await expect(readSnapshotBySequence(configPath, 1, appDataRoot)).rejects.toThrow('Snapshot unavailable');
  });
});

describe('saveWithSnapshot — a failed first-ever save leaves NO stray stub file behind (CR-02)', () => {
  it('a failed first-ever save leaves NO stray stub file behind', async () => {
    expect(existsSync(configPath)).toBe(false);

    const result = await saveWithSnapshot(configPath, { a: 'bad' }, alwaysInvalid, { root: appDataRoot });

    expect(result.ok).toBe(false);
    // The pre-touch stub this call created must be rolled back — the
    // filesystem must be left exactly as it was found (no file at all).
    expect(existsSync(configPath)).toBe(false);

    const dir = snapshotDirFor(configPath, appDataRoot);
    expect(existsSync(dir)).toBe(false);
  });
});

function writeFile(path: string, content: string): void {
  writeFileSync(path, content, 'utf8');
}
