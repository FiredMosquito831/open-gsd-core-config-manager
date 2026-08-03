// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import bundledSchema from '../../packages/schema-data/bundled-schema.json' with { type: 'json' };
import {
  SPECIALIZED_METADATA,
  getSpecializedDescriptor,
  isSpecializedEditable,
  type SpecializedDescriptor,
} from '../../web/src/schema/specializedMetadata.js';

const descriptor = (path: string) => getSpecializedDescriptor(path);

describe('specialized metadata', () => {
  it('catalogues source-confirmed structured editors and constrained choices', () => {
    expect(descriptor('ship.pr_body_sections')).toMatchObject({
      editor: 'structured-array',
      sensitive: false,
      fields: [
        { path: 'heading', type: 'string', required: true },
        { path: 'body', type: 'string', required: true },
      ],
    });
    expect(descriptor('model_overrides')).toMatchObject({
      editor: 'agent-map',
      allowedValues: ['opus', 'sonnet', 'haiku', 'inherit'],
      keyCatalog: 'agents',
    });
    expect(descriptor('model_profile')).toMatchObject({
      editor: 'profile-select',
      allowedValues: ['quality', 'balanced', 'budget', 'adaptive', 'inherit'],
    });
  });

  it('marks every confirmed sensitive path and never infers unknown sensitivity', () => {
    for (const path of ['brave_search', 'firecrawl', 'exa_search', 'tavily_search', 'ref_search', 'perplexity', 'jina']) {
      expect(descriptor(path)?.sensitive).toBe(true);
    }
    expect(descriptor('integration.api_key')).toBeUndefined();
    expect(isSpecializedEditable('review.reviewer_instances')).toBe(false);
    expect(isSpecializedEditable('unknown_future_pool')).toBe(false);
  });

  it('keeps reviewer instances read-only because bundled validation has no shape', () => {
    const reviewer = SPECIALIZED_METADATA.find((item) => item.path === 'review.reviewer_instances');
    expect(reviewer).toMatchObject({ editor: 'read-only-unsupported', editable: false });
  });

  it('does not depend on test fixtures at runtime', () => {
    expect(JSON.stringify(SPECIALIZED_METADATA)).not.toContain('phase4-gsd-core-catalog');
    expect(bundledSchema.model_profile['x-specialized']?.sourceEvidence).toContain('docs/CONFIGURATION.md#model_profile');
  });

  it('uses typed descriptors so unsupported paths cannot masquerade as editors', () => {
    const editable = SPECIALIZED_METADATA.filter((item) => item.editable);
    expect(editable.every((item: SpecializedDescriptor) => item.sourceEvidence.length > 0)).toBe(true);
    expect(descriptor('model_policy.runtime_tiers')?.editor).toBe('runtime-tier-map');
    expect(descriptor('model_profile_overrides')?.runtimeInstall?.length).toBeGreaterThan(0);
  });
});
