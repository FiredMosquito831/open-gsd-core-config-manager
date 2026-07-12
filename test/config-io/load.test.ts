import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildKnownKeySet,
  canonicalDefaultsFromSchema,
  isKnownKey,
} from '../../packages/config-io/src/known-keys.js';
import type { SchemaEntry } from '../../packages/config-io/src/types.js';

const BUNDLED_SCHEMA_PATH = path.resolve('packages/schema-data/bundled-schema.json');
const bundledSchema = JSON.parse(
  fs.readFileSync(BUNDLED_SCHEMA_PATH, 'utf8'),
) as Record<string, SchemaEntry>;

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
