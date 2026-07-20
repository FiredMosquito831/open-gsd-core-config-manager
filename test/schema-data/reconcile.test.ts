import { describe, expect, it } from 'vitest';
import {
  diffCanonicalSchemas,
  reconcileSchemaSources,
  validateBundledSchemaMetadata,
} from '../../packages/schema-data/src/reconcile.js';
import type { ParsedSchemaSources } from '../../packages/schema-data/src/source-types.js';

const curated = {
  mode: {
    'x-category': 'Workflow',
    'x-description': 'Choose how GSD asks before continuing.',
    'x-options': { interactive: { 'x-description': 'Ask before continuing.' } },
  },
};

function sources(overrides: Partial<ParsedSchemaSources> = {}): ParsedSchemaSources {
  return {
    manifest: {
      validKeys: ['mode', 'removed'],
      runtimeStateKeys: ['workflow._auto_chain_active'],
      dynamicKeyPatterns: [{ topLevel: 'agents', source: '^agents\\.[a-z]+$', description: 'agent id' }],
    },
    defaults: { mode: 'interactive', removed: true, workflow: { _auto_chain_active: false } },
    capabilitySchema: {
      mode: { type: 'enum', default: 'interactive', description: 'Upstream mode text', values: ['interactive', 'yolo'] },
    },
    fixtureValues: [],
    upstreamDocumentationFingerprints: { mode: 'old-upstream-prose' },
    ...overrides,
  };
}

describe('reconcileSchemaSources', () => {
  it('preserves curation, specialized metadata, and dynamic shape while excluding runtime state', () => {
    const result = reconcileSchemaSources(sources(), {}, {
      curated,
      specialized: { mode: { editor: 'profile-select', sourceEvidence: ['verified'] } },
    }, { gsdCoreVersion: '1.7.0', tag: 'v1.7.0', commit: 'b1c9381' });

    expect(result.schema.mode).toMatchObject({
      type: 'string',
      enum: ['interactive', 'yolo'],
      'x-category': 'Workflow',
      'x-description': curated.mode['x-description'],
      'x-options': curated.mode['x-options'],
      'x-specialized': { editor: 'profile-select', sourceEvidence: ['verified'] },
    });
    expect(result.schema.agents).toMatchObject({ 'x-dynamic-key-hint': 'agent id' });
    expect(result.schema['workflow._auto_chain_active']).toBeUndefined();
  });

  it('retains an active key that disappeared upstream as source-evidenced deprecated', () => {
    const active = {
      removed: {
        type: 'boolean', title: 'Removed', 'x-category': 'Workflow', 'x-description': 'Curated retained explanation.', 'x-provenance': 'manifest',
      },
    };
    const result = reconcileSchemaSources(sources({ manifest: { validKeys: ['mode'], runtimeStateKeys: [], dynamicKeyPatterns: [] } }), active, { curated: {}, specialized: {} }, { gsdCoreVersion: '1.8.0', tag: 'v1.8.0', commit: 'deadbeef' });

    expect(result.schema.removed).toMatchObject({
      'x-deprecated': true,
      'x-deprecated-since': '1.8.0',
      'x-deprecation-source': { gsdCoreVersion: '1.8.0', commit: 'deadbeef' },
      'x-description': 'Curated retained explanation.',
    });
  });

  it('rejects unsafe prototype-sensitive paths', () => {
    const bad = sources({ manifest: { validKeys: ['safe.__proto__.polluted'], runtimeStateKeys: [], dynamicKeyPatterns: [] } });
    expect(() => reconcileSchemaSources(bad, {}, { curated: {}, specialized: {} }, { gsdCoreVersion: '1.7.0', tag: 'v1.7.0' })).toThrow('Unsafe schema key');
  });
});

describe('diffCanonicalSchemas', () => {
  it('ignores object insertion order, enum order, and dynamic-pattern key order', () => {
    const previous = {
      mode: { type: 'string', enum: ['interactive', 'yolo'], default: 'interactive', title: 'Mode', 'x-category': 'Workflow', 'x-description': 'Curated', 'x-provenance': 'manifest' },
      agents: { type: 'object', title: 'Agents', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest', patternProperties: { '^agents\\.[a-z]+$': { type: 'string', title: 'Agent', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest' }, '^agents\\.[0-9]+$': { type: 'string', title: 'Agent', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest' } } },
    };
    const proposed = {
      agents: { 'x-provenance': 'manifest', 'x-description': '', 'x-category': 'Workflow', title: 'Agents', type: 'object', patternProperties: { '^agents\\.[0-9]+$': { type: 'string', title: 'Agent', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest' }, '^agents\\.[a-z]+$': { type: 'string', title: 'Agent', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest' } } },
      mode: { 'x-provenance': 'manifest', 'x-description': 'Curated', 'x-category': 'Workflow', title: 'Mode', default: 'interactive', enum: ['yolo', 'interactive'], type: 'string' },
    };
    expect(diffCanonicalSchemas(previous, proposed, { previous: {}, proposed: {} }).changes).toEqual([]);
  });

  it('emits sorted, proposal-ready semantic evidence and independent prose drift', () => {
    const previous = {
      mode: { type: 'string', enum: ['interactive'], default: 'interactive', title: 'Mode', 'x-category': 'Workflow', 'x-description': 'Curated', 'x-provenance': 'manifest' },
      legacy: { type: 'boolean', title: 'Legacy', 'x-category': 'Workflow', 'x-description': 'Curated', 'x-provenance': 'manifest' },
    };
    const proposed = {
      added: { type: 'number', default: 3, title: 'Added', 'x-category': 'Workflow', 'x-description': '', 'x-provenance': 'manifest' },
      legacy: { ...previous.legacy, 'x-deprecated': true, 'x-deprecated-since': '1.8.0' },
      mode: { ...previous.mode, enum: ['interactive', 'yolo'], default: 'yolo' },
    };
    const result = diffCanonicalSchemas(previous, proposed, { previous: { mode: 'old prose' }, proposed: { mode: 'new prose' } });
    expect(result.changes.map((change) => [change.key, change.group])).toEqual([
      ['added', 'added'], ['legacy', 'deprecated'], ['mode', 'changed'], ['mode', 'documentation-drift'],
    ]);
    expect(result.changes[2]).toMatchObject({ summary: expect.any(String), previous: expect.any(Object), proposed: expect.any(Object) });
    expect(result.changes[3].previous).toEqual({ fingerprint: 'old prose' });
    expect(result.changes[3].proposed).toEqual({ fingerprint: 'new prose' });
  });
});

describe('validateBundledSchemaMetadata', () => {
  it.each([
    [{ envelopeVersion: 1, source: 'bundled', gsdCoreVersion: '1.7.0', tag: 'v1.7.0', commit: 'b1c9381', generatedAt: '2026-07-20T00:00:00.000Z' }, true],
    [{ envelopeVersion: 1, gsdCoreVersion: '1.7.0-next.1', tag: 'v1.7.0-next.1', generatedAt: '2026-07-20T00:00:00.000Z' }, false],
    [{ envelopeVersion: 1, gsdCoreVersion: 'not-a-version', tag: 'v1.7.0', generatedAt: 'bad' }, false],
  ])('accepts only stable bundled identities', (metadata, valid) => {
    expect(validateBundledSchemaMetadata(metadata)).toBe(valid);
  });
});
