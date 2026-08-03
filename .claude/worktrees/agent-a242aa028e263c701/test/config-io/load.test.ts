import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildKnownKeySet,
  canonicalDefaultsFromSchema,
  isKnownKey,
} from '../../packages/config-io/src/known-keys.js';
import { load } from '../../packages/config-io/src/load.js';
import type { EffectiveLeaf, EffectiveNode, SchemaEntry } from '../../packages/config-io/src/types.js';

const BUNDLED_SCHEMA_PATH = path.resolve('packages/schema-data/bundled-schema.json');
const bundledSchema = JSON.parse(
  fs.readFileSync(BUNDLED_SCHEMA_PATH, 'utf8'),
) as Record<string, SchemaEntry>;

const PROJECT_FIXTURE_PATH = path.resolve('test/fixtures/project-config.json');
const FABRICATED_UNKNOWN_FIXTURE_PATH = path.resolve(
  'test/fixtures/project-config-with-fabricated-unknown-keys.json',
);
/** Self-contained fake $HOME so DISC-06 discovery tests never touch the real ~/.gsd (hermetic, matches discovery.test.ts's injectable-env pattern). */
const FAKE_HOME = path.resolve('test/fixtures/fake-home');
const NO_GLOBAL_HOME = path.resolve('test/fixtures/does-not-exist-home');

describe('buildKnownKeySet / isKnownKey (real bundled-schema.json)', () => {
  const knownSet = buildKnownKeySet(bundledSchema);

  it('classifies an exact schema key as known', () => {
    expect(isKnownKey('workflow.tdd_mode', knownSet)).toBe(true);
  });

  it('classifies a dynamic-pattern key as known (model_overrides.<agent>)', () => {
    expect(isKnownKey('model_overrides.gsd-planner', knownSet)).toBe(true);
  });

  it('classifies the fixture-observed gates.confirm_plan key as known', () => {
    expect(isKnownKey('gates.confirm_plan', knownSet)).toBe(true);
  });

  it('classifies a fabricated nested future key (workflow.x_test_unknown_toggle) as unknown', () => {
    expect(isKnownKey('workflow.x_test_unknown_toggle', knownSet)).toBe(false);
  });

  it('classifies a fabricated top-level future key (x_gsdcm_test_future_key) as unknown', () => {
    expect(isKnownKey('x_gsdcm_test_future_key', knownSet)).toBe(false);
  });

  it('classifies a bare dynamic-map container key itself as known', () => {
    expect(isKnownKey('model_overrides', knownSet)).toBe(true);
  });
});

describe('canonicalDefaultsFromSchema (real bundled-schema.json)', () => {
  it('produces a nested object whose values match the schema defaults', () => {
    const canonical = canonicalDefaultsFromSchema(bundledSchema);

    // workflow.tdd_mode declares default: false
    expect((canonical.workflow as Record<string, unknown>).tdd_mode).toBe(false);
    // gates.confirm_plan declares default: true (fixture-observed)
    expect((canonical.gates as Record<string, unknown>).confirm_plan).toBe(true);
    // top-level key with a declared default
    expect(canonical.commit_docs).toBe(bundledSchema.commit_docs.default);
  });

  it('omits keys that declare no default', () => {
    const canonical = canonicalDefaultsFromSchema(bundledSchema);
    // model_overrides is a bare dynamic-map container with no declared default.
    expect(canonical.model_overrides).toBeUndefined();
  });
});

function isLeaf(node: EffectiveNode): node is EffectiveLeaf {
  return typeof (node as EffectiveLeaf).from === 'string' && 'path' in node && 'value' in node;
}

describe('load() (DISC-06, SAVE-03)', () => {
  it('returns raw.project deep-equal to the freshly-parsed fixture (original object, unmodified)', async () => {
    const expected = JSON.parse(fs.readFileSync(PROJECT_FIXTURE_PATH, 'utf8'));
    const result = await load(PROJECT_FIXTURE_PATH, { env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv });
    expect(result.raw.project).toEqual(expected);
  });

  it('raw.project is never mutated by load() — a second load returns a fresh equal object', async () => {
    const opts = { env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv };
    const first = await load(PROJECT_FIXTURE_PATH, opts);
    const second = await load(PROJECT_FIXTURE_PATH, opts);
    expect(first.raw.project).toEqual(second.raw.project);
    expect(first.raw.project).not.toBe(second.raw.project); // distinct object identities (fresh parse each time)
  });

  it('sets meta.globalDefaultsFound=false and does not populate raw.global when the global file is absent', async () => {
    const result = await load(PROJECT_FIXTURE_PATH, { env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv });
    expect(result.meta.globalDefaultsFound).toBe(false);
    expect(result.meta.globalDefaultsPath).toBe(path.join(NO_GLOBAL_HOME, '.gsd', 'defaults.json'));
    expect(result.raw.global).toBeNull();
  });

  it('sets meta.globalDefaultsFound=true and populates raw.global when the global file exists (DISC-06)', async () => {
    const result = await load(PROJECT_FIXTURE_PATH, { env: { GSD_HOME: FAKE_HOME } as NodeJS.ProcessEnv });
    expect(result.meta.globalDefaultsFound).toBe(true);
    expect(result.meta.globalDefaultsPath).toBe(path.join(FAKE_HOME, '.gsd', 'defaults.json'));
    expect(result.raw.global).not.toBeNull();
    expect(typeof result.raw.global).toBe('object');
  });

  it('the fabricated-unknown fixture yields unknown[] containing x_gsdcm_test_future_key and workflow.x_test_unknown_toggle', async () => {
    const result = await load(FABRICATED_UNKNOWN_FIXTURE_PATH, {
      env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv,
    });

    const topLevel = result.unknown.find((u) => u.path === 'x_gsdcm_test_future_key');
    expect(topLevel).toBeDefined();
    expect(topLevel?.presentIn).toEqual(['project']);
    expect(topLevel?.value).toEqual({ nested: true });

    const nested = result.unknown.find((u) => u.path === 'workflow.x_test_unknown_toggle');
    expect(nested).toBeDefined();
    expect(nested?.presentIn).toEqual(['project']);
    expect(nested?.value).toBe(false);
  });

  it('gates.*/safety.* keys resolve as KNOWN and do not appear in unknown[] for a real fixture', async () => {
    const result = await load(PROJECT_FIXTURE_PATH, { env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv });
    const leakedGatesOrSafety = result.unknown.filter(
      (u) => u.path.startsWith('gates.') || u.path.startsWith('safety.'),
    );
    expect(leakedGatesOrSafety).toEqual([]);
  });

  it('effective tree carries at least one leaf tagged project provenance and one tagged canonical provenance', async () => {
    const result = await load(PROJECT_FIXTURE_PATH, { env: { GSD_HOME: NO_GLOBAL_HOME } as NodeJS.ProcessEnv });

    const leaves: EffectiveLeaf[] = [];
    function collect(node: EffectiveNode): void {
      if (isLeaf(node)) {
        leaves.push(node);
      } else {
        for (const child of Object.values(node)) collect(child);
      }
    }
    for (const node of Object.values(result.effective)) collect(node);

    expect(leaves.some((l) => l.from === 'project')).toBe(true);
    expect(leaves.some((l) => l.from === 'canonical')).toBe(true);

    // workflow.tdd_mode is present in the project fixture -> project provenance
    const tddMode = leaves.find((l) => l.path === 'workflow.tdd_mode');
    expect(tddMode?.from).toBe('project');
  });
});
