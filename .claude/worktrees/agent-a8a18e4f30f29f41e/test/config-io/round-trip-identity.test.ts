import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildAjvSchema,
  createValidator,
  load,
  saveConfig,
} from '../../packages/config-io/src/index.js';
import type { SchemaEntry } from '../../packages/config-io/src/index.js';

/**
 * SAVE-03 / success-criterion-#1 gate: a no-op load -> save -> load cycle on
 * a real fixture must preserve every key and value with 100% fidelity.
 * Wires load() (Plan 05) through saveConfig() (Plan 06) with the REAL
 * validator built from the REAL bundled-schema.json (Plan 02, bridged
 * through schema-convert.ts's buildAjvSchema — see that module's doc
 * comment for why the bridge is necessary), so this test exercises the true
 * end-to-end pipeline, not a stubbed validator.
 *
 * Per 01-VALIDATION.md's two-part fixture strategy: the fabricated-unknown
 * fixture (Test A) is what actually exercises this tool's OWN unknown-key
 * passthrough now that SCHEMA-01 closed the real gsd-core schema gap (a
 * real, fully-reconciled config.json has almost no unknown keys left to
 * lose); the real project-config.json fixture (Test B) proves fidelity on
 * an actual hand-edited file, including its gates.* / safety.* drift keys.
 */

const BUNDLED_SCHEMA_PATH = resolve('packages/schema-data/bundled-schema.json');
const bundledSchema = JSON.parse(
  readFileSync(BUNDLED_SCHEMA_PATH, 'utf8'),
) as Record<string, SchemaEntry>;

/** The real, dependency-injected validator saveConfig() calls before every write. */
const realValidator = createValidator(buildAjvSchema(bundledSchema));

const PROJECT_FIXTURE_PATH = resolve('test/fixtures/project-config.json');
const FABRICATED_UNKNOWN_FIXTURE_PATH = resolve(
  'test/fixtures/project-config-with-fabricated-unknown-keys.json',
);
const NUMERIC_STRING_KEY_FIXTURE_PATH = resolve('test/fixtures/numeric-string-key.json');

/**
 * Captured once at module load — BEFORE any test in this file runs — so the
 * final "byte-unchanged" test compares against the true pre-test-run
 * baseline, not against itself post-run (which would be trivially true
 * regardless of whether a bug ever opened a committed fixture for writing).
 */
const ORIGINAL_FABRICATED_UNKNOWN = readFileSync(FABRICATED_UNKNOWN_FIXTURE_PATH, 'utf8');
const ORIGINAL_PROJECT_CONFIG = readFileSync(PROJECT_FIXTURE_PATH, 'utf8');
const ORIGINAL_NUMERIC_STRING_KEY = readFileSync(NUMERIC_STRING_KEY_FIXTURE_PATH, 'utf8');

/** Hermetic fake $HOME so these tests never touch the real machine's ~/.gsd (matches load.test.ts's pattern). */
const NO_GLOBAL_HOME = resolve('test/fixtures/does-not-exist-home');
const NO_GLOBAL_ENV = { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv;

/**
 * Copies `sourceFixturePath` into a fresh temp directory as `config.json`
 * and returns the temp path. The committed fixture under test/fixtures/ is
 * NEVER opened for writing by this test file — only read (to seed the copy)
 * — so a full test run leaves every committed fixture byte-unchanged.
 */
function copyFixtureToTemp(sourceFixturePath: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gsdcm-round-trip-'));
  const tmpPath = join(dir, 'config.json');
  copyFileSync(sourceFixturePath, tmpPath);
  return tmpPath;
}

describe('round-trip identity (SAVE-03, success criterion #1)', () => {
  it('Test A: a no-op save on the fabricated-unknown fixture preserves unknown[] and raw.project with 100% fidelity', async () => {
    const tmpPath = copyFixtureToTemp(FABRICATED_UNKNOWN_FIXTURE_PATH);

    const before = await load(tmpPath, { env: NO_GLOBAL_ENV });

    // Sanity: the fixture actually carries unknowns, or this test would
    // trivially pass with nothing exercised.
    expect(before.unknown.length).toBeGreaterThan(0);
    expect(before.unknown.some((u) => u.path === 'x_gsdcm_test_future_key')).toBe(true);
    expect(before.unknown.some((u) => u.path === 'workflow.x_test_unknown_toggle')).toBe(true);

    // No-op save: write the ORIGINAL raw object straight back, unmodified —
    // the exact SAVE-03 patch-in-place invariant types.ts's LoadResult doc
    // comment describes.
    await saveConfig(tmpPath, before.raw.project, realValidator);

    const after = await load(tmpPath, { env: NO_GLOBAL_ENV });

    expect(after.unknown).toEqual(before.unknown);
    expect(after.raw.project).toEqual(before.raw.project);

    // Fabricated future keys specifically survive the round-trip.
    expect(after.raw.project.x_gsdcm_test_future_key).toEqual({ nested: true });
    expect((after.raw.project.workflow as Record<string, unknown>).x_test_unknown_toggle).toBe(false);
  });

  it('Test B: a no-op save on the real project-config.json fixture preserves raw.project with 100% fidelity, including gates.*/safety.* drift keys', async () => {
    const tmpPath = copyFixtureToTemp(PROJECT_FIXTURE_PATH);

    const before = await load(tmpPath, { env: NO_GLOBAL_ENV });

    await saveConfig(tmpPath, before.raw.project, realValidator);

    const after = await load(tmpPath, { env: NO_GLOBAL_ENV });

    expect(after.raw.project).toEqual(before.raw.project);
    expect(after.unknown).toEqual(before.unknown);

    // The real fixture's gates.*/safety.* keys (known, per 01-02's
    // fixture-observed modeling) survive byte-for-byte.
    expect(after.raw.project.gates).toEqual(before.raw.project.gates);
    expect(after.raw.project.safety).toEqual(before.raw.project.safety);
  });

  it('Test C: integer-like string keys are serialized in ascending numeric order — the documented V8 [[OwnPropertyKeys]] behavior, asserted rather than silently surprising', async () => {
    const tmpPath = copyFixtureToTemp(NUMERIC_STRING_KEY_FIXTURE_PATH);

    const before = await load(tmpPath, { env: NO_GLOBAL_ENV });
    const modelsBefore = (before.raw.project.review as Record<string, unknown>).models as Record<
      string,
      unknown
    >;

    // The fixture's own on-disk order is already ascending-numeric; confirm
    // the freshly-parsed object reflects V8's key ordering, not raw
    // insertion/file order.
    expect(Object.keys(modelsBefore)).toEqual(['0', '10', 'gsd-code-reviewer']);

    // Sanity check independent of this fixture's on-disk order: even when
    // integer-like string keys are INSERTED in a deliberately scrambled
    // (non-numeric) order on a plain object literal, V8's own
    // [[OwnPropertyKeys]] ordering places them first, ascending — this is
    // the underlying JS engine behavior the round-trip below relies on,
    // not an accident of how the fixture happens to be formatted on disk.
    const scrambled: Record<string, string> = {};
    scrambled['gsd-code-reviewer'] = 'claude-opus';
    scrambled['10'] = 'claude-sonnet';
    scrambled['0'] = 'gpt-5';
    expect(Object.keys(scrambled)).toEqual(['0', '10', 'gsd-code-reviewer']);

    await saveConfig(tmpPath, before.raw.project, realValidator);

    const after = await load(tmpPath, { env: NO_GLOBAL_ENV });
    const modelsAfter = (after.raw.project.review as Record<string, unknown>).models as Record<
      string,
      unknown
    >;

    expect(Object.keys(modelsAfter)).toEqual(['0', '10', 'gsd-code-reviewer']);
    expect(modelsAfter).toEqual(modelsBefore);
  });

  it('committed fixtures are byte-unchanged after the full test run (operates on temp copies only)', () => {
    // Compared against the module-load-time baseline captured above — proves
    // no test in this file ever opened a committed fixture path for writing;
    // every save() call above targeted a temp copy only.
    expect(readFileSync(FABRICATED_UNKNOWN_FIXTURE_PATH, 'utf8')).toBe(ORIGINAL_FABRICATED_UNKNOWN);
    expect(readFileSync(PROJECT_FIXTURE_PATH, 'utf8')).toBe(ORIGINAL_PROJECT_CONFIG);
    expect(readFileSync(NUMERIC_STRING_KEY_FIXTURE_PATH, 'utf8')).toBe(ORIGINAL_NUMERIC_STRING_KEY);
  });
});
