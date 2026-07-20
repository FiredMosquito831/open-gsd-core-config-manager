import { describe, expect, it } from 'vitest';
import { getBundledSchema, getBundledSchemaMetadata } from '../../packages/server/src/schema.js';
import { defaultRefreshDependencies, SchemaRefreshService } from '../../packages/server/src/schema-refresh-service.js';

const LIVE_COMPATIBILITY = process.env.GSD_LIVE_SCHEMA_COMPAT === '1';

/**
 * This is intentionally separate from ordinary CI. It reads only the fixed
 * latest-stable GitHub endpoints through the production refresh service and
 * never receives an ActiveSchemaManager or activation capability.
 */
describe.skipIf(!LIVE_COMPATIBILITY)('live latest-stable schema compatibility', () => {
  it('prepares a compiled inert proposal or a valid no-change result without activation', async () => {
    let activationAttempts = 0;
    const bundledSchema = getBundledSchema();
    const bundledMetadata = getBundledSchemaMetadata();
    const service = new SchemaRefreshService({
      ...defaultRefreshDependencies(),
      activeSchema: () => bundledSchema,
      activeMetadata: () => bundledMetadata,
      overlays: () => ({
        curated: Object.fromEntries(Object.entries(bundledSchema).map(([key, entry]) => [key, {
          'x-description': entry['x-description'],
          'x-category': entry['x-category'],
          'x-options': entry['x-options'],
        }])),
        specialized: Object.create(null),
      }),
      activate: () => { activationAttempts += 1; },
    });

    const result = await service.refresh();

    expect(activationAttempts).toBe(0);
    expect(result.kind).not.toBe('failure');
    if (result.kind === 'proposal') {
      expect(result.proposal.id).toMatch(/^[a-z0-9-]+$/i);
      expect(result.proposal.metadata).toMatchObject({
        source: 'refreshed',
        tag: expect.stringMatching(/^v\d+\.\d+\.\d+$/),
        commit: expect.stringMatching(/^[a-f0-9]{40}$/),
        archiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(result.proposal.schema).toBeTypeOf('object');
    } else {
      expect(result.gsdCoreVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Date.parse(result.checkedAt)).not.toBeNaN();
    }
  }, 60_000);
});
