import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBundledSchema, getBundledSchemaMetadata } from '../../packages/server/src/schema.js';
import { defaultRefreshDependencies, SchemaRefreshService, specializedOverlaysFromSchema, type RefreshDependencies } from '../../packages/server/src/schema-refresh-service.js';
import type { CanonicalSchema, ParsedSchemaSources } from '../../packages/schema-data/src/source-types.js';
import { parseCapabilityRegistryLiteral } from '../../packages/server/src/capability-registry-parser.js';
import { extractDocumentationEvidence } from '../../packages/server/src/documentation-evidence-parser.js';
import { inspectPinnedArchive } from '../../packages/server/src/upstream-archive.js';
import { diffCanonicalSchemas, reconcileSchemaSources } from '../../packages/schema-data/src/reconcile.js';
import { buildAjvSchema, createValidator } from '../../packages/config-io/src/index.js';

const fixtureRoot = new URL('../fixtures/schema-refresh/', import.meta.url);
const commit = 'a'.repeat(40);
const archive = new Uint8Array(readFileSync(new URL('official-github-archive.tar.gz', fixtureRoot)));
const sourceFiles = {
  'gsd-core/bin/shared/config-schema.manifest.json': readFileSync(new URL('valid/config-schema.manifest.json', fixtureRoot), 'utf8'),
  'gsd-core/bin/shared/config-defaults.manifest.json': readFileSync(new URL('valid/config-defaults.manifest.json', fixtureRoot), 'utf8'),
  'gsd-core/bin/lib/capability-registry.cjs': readFileSync(new URL('valid/capability-registry.cjs', fixtureRoot), 'utf8'),
  'docs/CONFIGURATION.md': readFileSync(new URL('valid/CONFIGURATION.md', fixtureRoot), 'utf8'),
};

function fixedNow() { return new Date('2026-07-20T12:00:00.000Z'); }

function dependencies(overrides: Partial<RefreshDependencies> = {}): RefreshDependencies {
  return {
    fetchJson: async (path) => {
      if (path.endsWith('/releases/latest')) return { draft: false, prerelease: false, tag_name: 'v1.8.0' };
      if (path.endsWith('/git/ref/tags/v1.8.0')) return { object: { type: 'commit', sha: commit } };
      throw new Error(`unexpected request ${path}`);
    },
    fetchBytes: async (path) => {
      expect(path).toBe(`https://api.github.com/repos/open-gsd/gsd-core/tarball/${commit}`);
      return archive;
    },
    inspectArchive: () => ({ files: Object.fromEntries(Object.entries(sourceFiles).map(([path, text]) => [path, new TextEncoder().encode(text)])), entries: 2702 }),
    parseRegistry: parseCapabilityRegistryLiteral as unknown as RefreshDependencies['parseRegistry'],
    documentation: extractDocumentationEvidence,
    reconcile: reconcileSchemaSources,
    diff: diffCanonicalSchemas,
    compile: (schema) => createValidator(buildAjvSchema(schema as unknown as Record<string, import('../../packages/config-io/src/types.js').SchemaEntry>)),
    activeSchema: () => getBundledSchema(),
    activeMetadata: () => getBundledSchemaMetadata(),
    activeGeneration: () => 0,
    overlays: () => ({
      curated: Object.fromEntries(Object.entries(getBundledSchema()).map(([key, entry]) => [key, {
        'x-description': entry['x-description'], 'x-category': entry['x-category'], 'x-options': entry['x-options'],
      }])),
      specialized: Object.create(null),
    }),
    now: fixedNow,
    randomId: () => 'opaque-proposal-id',
    ...overrides,
  };
}

describe('SchemaRefreshService', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses production overlays to retain bundled curation and specialized metadata in a refreshed candidate', async () => {
    const production = new SchemaRefreshService({
      ...dependencies(),
      overlays: defaultRefreshDependencies().overlays,
    });

    const result = await production.refresh();

    expect(result.kind).toBe('proposal');
    if (result.kind !== 'proposal') return;
    const bundled = getBundledSchema();
    expect(result.proposal.schema.mode['x-description']).toBe(bundled.mode['x-description']);
    expect(result.proposal.schema.mode['x-category']).toBe(bundled.mode['x-category']);
    expect(result.proposal.schema.mode['x-options']).toEqual(bundled.mode['x-options']);
    const specializedEntry = Object.entries(bundled).find(([, entry]) => entry['x-specialized'] && typeof entry['x-specialized'] === 'object');
    expect(specializedEntry).toBeDefined();
    if (!specializedEntry) return;
    expect(result.proposal.schema[specializedEntry[0]]?.['x-specialized']).toEqual(specializedEntry[1]['x-specialized']);
  });

  it('rejects an oversized compressed response while reading the production stream', async () => {
    const chunks = [new Uint8Array(8 * 1024 * 1024), new Uint8Array([1])];
    let cancelled = false;
    const reader = {
      read: vi.fn(async () => chunks.length ? { done: false as const, value: chunks.shift()! } : { done: true as const, value: undefined }),
      cancel: vi.fn(async () => { cancelled = true; }),
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: { getReader: () => reader } })));

    await expect(defaultRefreshDependencies().fetchBytes('https://api.github.com/repos/open-gsd/gsd-core/tarball/' + commit)).rejects.toThrow();
    expect(cancelled).toBe(true);
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('ignores non-object catalog entries while retaining object-valued specialized metadata', () => {
    const overlays = specializedOverlaysFromSchema({
      profiles: ['quality'],
      model_profile: { 'x-specialized': { editor: 'profile-select', sourceEvidence: ['verified'] } },
      mode: { 'x-specialized': ['not-descriptor-metadata'] },
    });

    expect(overlays).toEqual({ model_profile: { editor: 'profile-select', sourceEvidence: ['verified'] } });
  });

  it('uses only fixed latest/tag/archive endpoints, creates an opaque compiled inert proposal, and never activates', async () => {
    let activeCalls = 0;
    const service = new SchemaRefreshService(dependencies({ activate: () => { activeCalls += 1; } }));

    const result = await service.refresh();

    expect(result).toMatchObject({ kind: 'proposal', proposal: { id: 'opaque-proposal-id', metadata: { gsdCoreVersion: '1.8.0', tag: 'v1.8.0', commit, archiveSha256: createHash('sha256').update(archive).digest('hex') } } });
    expect(activeCalls).toBe(0);
    expect(service.stage()).toBe('proposal');
    expect(service.proposal()).toMatchObject({ id: 'opaque-proposal-id', expiresAt: '2026-07-20T12:05:00.000Z' });
  });

  it.each([
    [{ draft: true, prerelease: false, tag_name: 'v1.8.0' }],
    [{ draft: false, prerelease: true, tag_name: 'v1.8.0' }],
    [{ draft: false, prerelease: false, tag_name: 'next' }],
  ])('rejects an invalid latest release without archive acquisition', async (release) => {
    let archiveCalls = 0;
    const service = new SchemaRefreshService(dependencies({ fetchJson: async () => release, fetchBytes: async () => { archiveCalls += 1; return archive; } }));

    await expect(service.refresh()).resolves.toEqual({ kind: 'failure', error: 'Unable to verify the latest stable schema release.' });
    expect(archiveCalls).toBe(0);
    expect(service.proposal()).toBeUndefined();
  });

  it('dereferences an annotated tag only to a bounded immutable commit and fails closed on a malformed object', async () => {
    const service = new SchemaRefreshService(dependencies({
      fetchJson: async (path) => {
        if (path.endsWith('/releases/latest')) return { draft: false, prerelease: false, tag_name: 'v1.8.0' };
        if (path.endsWith('/git/ref/tags/v1.8.0')) return { object: { type: 'tag', sha: 'b'.repeat(40) } };
        if (path.endsWith(`/git/tags/${'b'.repeat(40)}`)) return { object: { type: 'commit', sha: commit } };
        throw new Error('unexpected request');
      },
    }));
    expect((await service.refresh()).kind).toBe('proposal');

    const failed = new SchemaRefreshService(dependencies({ fetchJson: async () => ({ draft: false, prerelease: false, tag_name: 'v1.8.0', object: { type: 'blob' } }) }));
    await expect(failed.refresh()).resolves.toEqual({ kind: 'failure', error: 'Unable to verify the latest stable schema release.' });
  });

  it('fails closed on same-version different immutable identity, parser failure, and compile failure without changing active state', async () => {
    const snapshot = structuredClone(getBundledSchema());
    for (const deps of [
      dependencies({ activeMetadata: () => ({ ...getBundledSchemaMetadata(), gsdCoreVersion: '1.8.0', tag: 'v1.8.0', commit: 'c'.repeat(40) }) }),
      dependencies({ inspectArchive: () => { throw new Error('bad archive'); } }),
      dependencies({ compile: () => { throw new Error('bad schema'); } }),
    ]) {
      const service = new SchemaRefreshService(deps);
      await expect(service.refresh()).resolves.toMatchObject({ kind: 'failure' });
      expect(getBundledSchema()).toEqual(snapshot);
      expect(service.proposal()).toBeUndefined();
    }
  });

  it('passes deterministic per-key documentation fingerprints into reconciliation, preserving curated prose while creating one documentation note', async () => {
    let received: ParsedSchemaSources['upstreamDocumentationFingerprints'] = Object.create(null);
    const service = new SchemaRefreshService(dependencies({
      inspectArchive: () => ({
        files: Object.fromEntries(Object.entries(sourceFiles).map(([path, text]) => [path, new TextEncoder().encode(path === 'docs/CONFIGURATION.md' ? '## mode\nRemote prose changed.\n' : text)])),
        entries: 2702,
      }),
      reconcile: (sources, active, overlays, identity) => {
        received = sources.upstreamDocumentationFingerprints;
        return dependencies().reconcile!(sources, active, overlays, identity);
      },
      diff: (previous, proposed, fingerprints) => {
        const output = dependencies().diff!(previous, proposed, { previous: { ...fingerprints.proposed, mode: 'before' }, proposed: fingerprints.proposed });
        return output;
      },
    }));

    const result = await service.refresh();
    expect(result.kind).toBe('proposal');
    expect(received.mode).toMatch(/^[a-f0-9]{64}$/);
    expect(result.kind === 'proposal' && result.proposal.documentationDiagnostics).not.toContainEqual(expect.objectContaining({ key: 'mode' }));
    expect(result.kind === 'proposal' && result.proposal.changes.byGroup['documentation-drift']).toHaveLength(1);
    expect(result.kind === 'proposal' && result.proposal.schema.mode['x-description']).toBe(getBundledSchema().mode['x-description']);
  });

  it('reports prose drift through the production diff after a refreshed generation is activated', async () => {
    let activeSchema = getBundledSchema();
    let activeMetadata = getBundledSchemaMetadata();
    let documentationText = '## mode\nThe first upstream explanation.\n';
    const service = new SchemaRefreshService(dependencies({
      activeSchema: () => activeSchema,
      activeMetadata: () => activeMetadata,
      inspectArchive: () => ({
        files: Object.fromEntries(Object.entries(sourceFiles).map(([path, value]) => [path, new TextEncoder().encode(path === 'docs/CONFIGURATION.md' ? documentationText : value)])),
        entries: 2702,
      }),
    }));

    const first = await service.refresh();
    expect(first.kind).toBe('proposal');
    if (first.kind !== 'proposal') return;
    activeSchema = first.proposal.schema;
    activeMetadata = first.proposal.metadata;
    documentationText = '## mode\nThe upstream explanation changed after activation.\n';

    const second = await service.refresh();
    expect(second.kind).toBe('proposal');
    expect(second.kind === 'proposal' && second.proposal.changes.byGroup['documentation-drift']).toEqual([
      expect.objectContaining({ key: 'mode', group: 'documentation-drift' }),
    ]);
    expect(second.kind === 'proposal' && second.proposal.schema.mode['x-description']).toBe(getBundledSchema().mode['x-description']);
  });

  it('does not invent documentation fingerprints when source evidence is unavailable', async () => {
    const service = new SchemaRefreshService(dependencies({
      documentation: () => ({ fingerprints: Object.create(null), diagnostics: [{ key: 'mode', status: 'unavailable', reason: 'missing' }] }),
    }));
    const result = await service.refresh();
    expect(result.kind).toBe('proposal');
    expect(result.kind === 'proposal' && result.proposal.documentationDiagnostics).toEqual([{ key: 'mode', status: 'unavailable', reason: 'missing' }]);
  });

  it('returns no-change with lastChecked only, cancels only the matching proposal, and expires source-backed proposals', async () => {
    const noChange = new SchemaRefreshService(dependencies({ diff: () => ({ changes: [], byGroup: { added: [], changed: [], deprecated: [], 'documentation-drift': [] } }) }));
    await expect(noChange.refresh()).resolves.toEqual({ kind: 'no-change', checkedAt: '2026-07-20T12:00:00.000Z', gsdCoreVersion: '1.8.0' });
    expect(noChange.lastChecked()).toBe('2026-07-20T12:00:00.000Z');
    expect(noChange.proposal()).toBeUndefined();

    let now = fixedNow();
    const service = new SchemaRefreshService(dependencies({ now: () => now }));
    const proposal = await service.refresh();
    expect(proposal.kind).toBe('proposal');
    expect(service.cancelProposal('wrong-id')).toBe(false);
    expect(service.cancelProposal('opaque-proposal-id')).toBe(true);
    expect(service.proposal()).toBeUndefined();
    await service.refresh();
    now = new Date('2026-07-20T12:06:00.000Z');
    expect(service.proposal()).toBeUndefined();
  });
});
