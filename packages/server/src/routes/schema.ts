/**
 * Schema REST route (03-02-PLAN.md).
 *
 * GET /api/schema returns the bundle-safe inlined canonical schema in the
 * frozen ApiOk envelope. The route is registered inside the `/api` plugin
 * scope so it inherits the Origin and token guards.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiErr, SchemaProposalDto, SchemaStatusDto } from '../api-types.js';
import type { ActiveSchemaManager } from '../active-schema-manager.js';
import type { SchemaRefreshService } from '../schema-refresh-service.js';

export interface SchemaRoutesOptions {
  activeSchemaManager: ActiveSchemaManager;
  schemaRefreshService: SchemaRefreshService;
}

const EMPTY_BODY_SCHEMA = { type: 'object', additionalProperties: false, maxProperties: 0 } as const;
const OPAQUE_ID = { type: 'string', minLength: 1, maxLength: 256 } as const;

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

function statusDto(manager: ActiveSchemaManager, refresh: SchemaRefreshService): SchemaStatusDto {
  const snapshot = manager.snapshot();
  return {
    ...snapshot.status,
    lastChecked: refresh.lastChecked(),
    ...(snapshot.metadata.commit ? { commitPrefix: snapshot.metadata.commit.slice(0, 12) } : {}),
    ...(snapshot.metadata.archiveSha256 ? { archiveSha256Prefix: snapshot.metadata.archiveSha256.slice(0, 12) } : {}),
  };
}

function proposalDto(proposal: ReturnType<SchemaRefreshService['proposal']>): SchemaProposalDto | undefined {
  if (!proposal) return undefined;
  return {
    id: proposal.id,
    expiresAt: proposal.expiresAt,
    checkedAt: proposal.checkedAt,
    gsdCoreVersion: proposal.metadata.gsdCoreVersion,
    changes: proposal.changes.changes.map((change) => ({ path: change.key, kind: change.group, before: change.previous, after: change.proposed })),
    documentationDiagnostics: proposal.documentationDiagnostics,
  };
}

export const schemaRoutes: FastifyPluginAsync<SchemaRoutesOptions> = async (app, opts) => {
  const { activeSchemaManager: manager, schemaRefreshService: refresh } = opts;
  let lifecycleTail = Promise.resolve();
  const serializeLifecycle = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = lifecycleTail;
    let release!: () => void;
    lifecycleTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  };

  app.get('/schema', async () => ({ ok: true, schema: manager.snapshot().schema }));
  app.get('/schema/status', async () => ({ ok: true, status: statusDto(manager, refresh), proposal: proposalDto(refresh.proposal()) }));

  app.post('/schema/refresh', { schema: { body: EMPTY_BODY_SCHEMA } }, async (_req, reply) => serializeLifecycle(async () => {
    const result = await refresh.refresh();
    if (result.kind === 'failure') return reply.code(422).send(errBody(result.error));
    return {
      ok: true,
      status: statusDto(manager, refresh),
      ...(result.kind === 'proposal' ? { proposal: proposalDto(result.proposal) } : { noChange: true }),
    };
  }));

  app.post<{ Params: { id: string } }>('/schema/proposals/:id/activate', { schema: { params: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: OPAQUE_ID } }, body: EMPTY_BODY_SCHEMA } }, async (req, reply) => serializeLifecycle(async () => {
    const proposal = refresh.proposal();
    if (!proposal || proposal.id !== req.params.id || proposal.basedOnGeneration !== manager.currentGeneration()) return reply.code(404).send(errBody('Schema proposal is unavailable.'));
    try {
      await manager.activateValidatedProposal(proposal as unknown as Parameters<ActiveSchemaManager['activateValidatedProposal']>[0]);
      // Lifecycle operations remain serialized until this succeeds, so retaining
      // the proposal across a persistence failure permits a safe retry.
      refresh.cancelProposal(proposal.id);
      return { ok: true, status: statusDto(manager, refresh) };
    } catch (error) {
      app.log.warn(error, 'Schema proposal activation failed');
      return reply.code(422).send(errBody('Unable to activate the schema proposal.'));
    }
  }));

  app.delete<{ Params: { id: string } }>('/schema/proposals/:id', { schema: { params: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: OPAQUE_ID } } } }, async (req, reply) => serializeLifecycle(async () => {
    if (!refresh.cancelProposal(req.params.id)) return reply.code(404).send(errBody('Schema proposal is unavailable.'));
    return { ok: true, cancelled: true };
  }));

  app.post('/schema/reset', { schema: { body: EMPTY_BODY_SCHEMA } }, async (_req, reply) => serializeLifecycle(async () => {
    try {
      await manager.resetToBundled();
      const proposal = refresh.proposal();
      if (proposal) refresh.cancelProposal(proposal.id);
      return { ok: true, status: statusDto(manager, refresh) };
    } catch (error) {
      app.log.warn(error, 'Schema reset failed');
      return reply.code(422).send(errBody('Unable to reset the active schema.'));
    }
  }));
};
