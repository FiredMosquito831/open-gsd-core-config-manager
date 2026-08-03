// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildSpecializedProjectDraft,
  getLayeredValue,
  materializeInheritedValue,
} from '../../web/src/schema/effective.js';
import { buildProjectSaveCandidate } from '../../web/src/schema/patchProject.js';
import { createClientValidator } from '../../web/src/schema/validation.js';
import type { LoadResult, SchemaEntry } from '../../packages/config-io/src/types.js';
import fixture from '../fixtures/phase4-specialized-config.json' with { type: 'json' };
import schema from '../../packages/schema-data/bundled-schema.json' with { type: 'json' };

function loadResult(): LoadResult {
  return {
    raw: { project: fixture.raw as Record<string, unknown>, global: null },
    effective: {
      model_profile: { path: 'model_profile', value: fixture.effective.model_profile, from: 'global' },
      model_overrides: { path: 'model_overrides', value: fixture.effective.model_overrides, from: 'global' },
    },
    unknown: [],
    meta: { globalDefaultsPath: '', globalDefaultsFound: false },
  };
}

describe('specialized layered draft helpers', () => {
  it('reads raw project, global, and effective values without merging a save payload', () => {
    const result = loadResult();
    expect(getLayeredValue(result, 'model_overrides')).toEqual({
      project: fixture.raw.model_overrides,
      effective: fixture.effective.model_overrides,
      global: undefined,
    });
    expect(buildSpecializedProjectDraft(result, ['model_overrides', 'model_policy'])).toEqual({
      model_overrides: fixture.raw.model_overrides,
      model_policy: fixture.raw.model_policy,
    });
  });

  it('deep-copies an inherited complex value into raw.project only', () => {
    const result = loadResult();
    const inherited = { sonnet: 'provider/sonnet', nested: { keep: true } };
    materializeInheritedValue(result, 'model_profile_overrides', inherited);
    expect(result.raw.project.model_profile_overrides).toEqual(inherited);
    expect(result.raw.project.model_profile_overrides).not.toBe(inherited);
    expect(result.effective.model_profile_overrides).toBeUndefined();
  });

  it('patches specialized containers while preserving unrelated and unknown members', () => {
    const candidate = buildProjectSaveCandidate(loadResult(), [
      { path: 'model_policy.runtime_tiers.opencode.sonnet', value: { model: 'new/model' } },
    ], []);
    expect(candidate.model_policy).toMatchObject({
      provider: 'openai',
      runtime_tiers: { opencode: { sonnet: { model: 'new/model' } } },
    });
    expect(candidate.integration).toEqual({ api_key: 'PHASE4_SENTINEL_API_KEY' });
    expect(() => buildProjectSaveCandidate(loadResult(), [
      { path: 'model_policy.__proto__.bad', value: true },
    ], [])).toThrow(/unsafe/);
  });

  it('validates the full candidate and reports paths without candidate values', () => {
    const entries = schema as Record<string, SchemaEntry>;
    const validate = createClientValidator(entries);
    const result = validate({ model_profile: 'not-a-profile' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path === '/model_profile')).toBe(true);
    expect(JSON.stringify(result.errors)).not.toContain('not-a-profile');
  });
});
