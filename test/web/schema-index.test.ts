// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { indexSchema } from '../../web/src/schema/indexSchema.js';
import { getEffectiveLeaf, provenanceLabel } from '../../web/src/schema/effective.js';
import { useUiStore } from '../../web/src/state/uiStore.js';
import type { SchemaEntry, EffectiveNode } from '../../packages/config-io/src/types.js';
import bundledSchema from '../../packages/schema-data/bundled-schema.json' with { type: 'json' };

const minimalSchema: Record<string, SchemaEntry> = {
  'workflow.tdd_mode': {
    type: 'boolean',
    title: 'TDD Mode',
    'x-category': 'Workflow',
    'x-description': 'Require tests before implementation.',
    'x-provenance': 'config-defaults',
  },
  mode: {
    type: 'string',
    enum: ['interactive', 'autonomous'],
    title: 'Mode',
    'x-category': 'Core',
    'x-description': 'Default agent behavior.',
    'x-provenance': 'config-defaults',
    'x-options': {
      interactive: { 'x-description': 'Human-in-the-loop' },
      autonomous: { 'x-description': 'Agent decides' },
    },
  },
  'review.strategy': {
    type: 'string',
    enum: ['strict', 'loose'],
    title: 'Review Strategy',
    'x-category': 'Review',
    'x-description': 'How thoroughly to review changes.',
    'x-provenance': 'config-defaults',
  },
  model_overrides: {
    type: 'object',
    title: 'Model Overrides',
    'x-category': 'Model & Routing',
    'x-description': 'Per-agent model overrides.',
    'x-provenance': 'dynamicKeyPattern:model_overrides',
    patternProperties: {
      '^model_overrides\\.[a-zA-Z0-9_-]+$': {
        type: 'string',
        title: 'Model override',
        'x-category': 'Model & Routing',
        'x-description': 'Model for this agent.',
        'x-provenance': 'dynamicKeyPattern:model_overrides',
      },
    },
    'x-dynamic-key-hint': 'agent-id',
  },
  'ship.pr_body_sections': {
    type: 'array',
    title: 'PR Body Sections',
    'x-category': 'Ship',
    'x-description': 'Sections to include in PR body.',
    'x-provenance': 'config-defaults',
  },
};

describe('indexSchema', () => {
  it('groups fields by x-category in stable order', () => {
    const index = indexSchema(minimalSchema);
    expect(index.categories).toEqual(['Core', 'Model & Routing', 'Review', 'Ship', 'Workflow']);
    expect(index.fieldsByCategory.get('Core')?.map((f) => f.path)).toEqual(['mode']);
  });

  it('exposes title, description, enum, and option meanings', () => {
    const index = indexSchema(minimalSchema);
    const mode = index.fieldsByPath.get('mode')!;
    expect(mode.title).toBe('Mode');
    expect(mode.description).toBe('Default agent behavior.');
    expect(mode.enumValues).toEqual(['interactive', 'autonomous']);
    expect(mode.optionMeanings).toEqual({
      interactive: 'Human-in-the-loop',
      autonomous: 'Agent decides',
    });
  });

  it('flags array, object, and dynamic-map entries as handoff fields', () => {
    const index = indexSchema(minimalSchema);
    expect(index.fieldsByPath.get('ship.pr_body_sections')?.isHandoff).toBe(true);
    expect(index.fieldsByPath.get('model_overrides')?.isHandoff).toBe(true);
    expect(index.fieldsByPath.get('workflow.tdd_mode')?.isHandoff).toBe(false);
  });

  it('includes handoff reasons for specialized controls', () => {
    const index = indexSchema(minimalSchema);
    expect(index.fieldsByPath.get('ship.pr_body_sections')?.handoffReason).toBe('array');
    expect(index.fieldsByPath.get('model_overrides')?.handoffReason).toBe('dynamic-map');
    expect(index.fieldsByPath.get('workflow.tdd_mode')?.handoffReason).toBeUndefined();
  });

  it('builds searchable text from path, title, description, and options', () => {
    const index = indexSchema(minimalSchema);
    const mode = index.fieldsByPath.get('mode')!;
    expect(mode.searchableText).toContain('mode');
    expect(mode.searchableText).toContain('default agent behavior');
    expect(mode.searchableText).toContain('human-in-the-loop');
  });

  it('reports content gaps for enum entries missing x-options', () => {
    const index = indexSchema(minimalSchema);
    const gaps = index.contentGaps;
    const reviewGap = gaps.find((g) => g.path === 'review.strategy');
    expect(reviewGap).toBeDefined();
    expect(reviewGap?.missingOptions).toEqual(['strict', 'loose']);

    const modeGap = gaps.find((g) => g.path === 'mode');
    expect(modeGap).toBeUndefined();
    const tddGap = gaps.find((g) => g.path === 'workflow.tdd_mode');
    expect(tddGap).toBeUndefined();
  });

  it('indexes the real bundled schema without errors', () => {
    const index = indexSchema(bundledSchema as Record<string, SchemaEntry>);
    expect(index.categories.length).toBeGreaterThan(0);
    expect(index.fieldsByPath.size).toBeGreaterThan(0);
  });
});

describe('effective.ts', () => {
  const effective: Record<string, EffectiveNode> = {
    workflow: {
      tdd_mode: { path: 'workflow.tdd_mode', value: true, from: 'project' },
    } as unknown as EffectiveNode,
    mode: { path: 'mode', value: 'interactive', from: 'canonical' } as unknown as EffectiveNode,
  };

  it('resolves a dot path to an EffectiveLeaf', () => {
    const leaf = getEffectiveLeaf(effective, 'workflow.tdd_mode');
    expect(leaf).toEqual({ path: 'workflow.tdd_mode', value: true, from: 'project' });
  });

  it('returns null for unknown paths', () => {
    expect(getEffectiveLeaf(effective, 'unknown.key')).toBeNull();
  });

  it('maps provenance to labels', () => {
    expect(provenanceLabel('project')).toBe('Project override');
    expect(provenanceLabel('global')).toBe('Global default');
    expect(provenanceLabel('canonical')).toBe('Canonical default');
  });
});

describe('uiStore', () => {
  it('holds active config, chapter, pane state, search, and highlight target', () => {
    const store = useUiStore.getState();
    store.setActiveConfigId('cfg-1');
    store.setActiveChapter('Workflow');
    store.toggleLeftPane();
    store.setSearchQuery('tdd');
    store.setHighlightTarget('workflow.tdd_mode');
    const next = useUiStore.getState();
    expect(next.activeConfigId).toBe('cfg-1');
    expect(next.activeChapter).toBe('Workflow');
    expect(next.leftPaneOpen).toBe(false);
    expect(next.searchQuery).toBe('tdd');
    expect(next.highlightTarget).toBe('workflow.tdd_mode');
  });
});
