import { readFile } from 'node:fs/promises';
import type { FastifyPluginAsync } from 'fastify';
import type { ApiErr, HistoryRestoreResult, HistorySnapshotDetail, HistorySnapshotMeta } from '../api-types.js';
import { isRegularFileOrMissing, type ConfigRegistry } from '../registry.js';
import type { ActiveSchemaManager } from '../active-schema-manager.js';
import {
  listSnapshots,
  readSnapshotBySequence,
  SnapshotReadError,
  type SnapshotMetadata,
} from '../snapshot-store/index.js';
import { configRevision, saveWithSnapshot } from '../snapshot-store/save-with-snapshot.js';

export interface HistoryRoutesOptions {
  registry: ConfigRegistry;
  activeSchemaManager: ActiveSchemaManager;
  snapshotRoot?: string;
  warn?: (message: string) => void;
}

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

function parseSequence(raw: string): number | undefined {
  if (!/^(?:[1-9]\d*)$/.test(raw)) return undefined;
  const seq = Number(raw);
  return Number.isSafeInteger(seq) && seq > 0 ? seq : undefined;
}

function isProjectDocument(value: unknown): value is object {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function publicMetadata(metadata: SnapshotMetadata): HistorySnapshotMeta {
  return { seq: metadata.seq, timestamp: metadata.timestamp, contentHash: metadata.contentHash };
}

function snapshotError(reply: { code: (status: number) => { send: (body: ApiErr) => unknown } }, error: unknown) {
  if (error instanceof SnapshotReadError) {
    if (error.code === 'NOT_FOUND') return reply.code(404).send(errBody('Snapshot not found'));
    if (error.code === 'INVALID_SEQUENCE') return reply.code(400).send(errBody('Invalid snapshot sequence'));
    return reply.code(422).send(errBody('Snapshot unavailable'));
  }
  return reply.code(500).send(errBody('Internal error'));
}

async function currentProjectDocument(path: string): Promise<{ document: object; revision: string }> {
  const raw = await readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isProjectDocument(parsed)) throw new Error('Invalid project document');
  return { document: parsed, revision: configRevision(raw) };
}

const RESTORE_BODY_SCHEMA = {
  type: 'object',
  required: ['expectedRevision'],
  properties: { expectedRevision: { type: 'string', minLength: 1 } },
} as const;

export const historyRoutes: FastifyPluginAsync<HistoryRoutesOptions> = async (app, opts) => {
  const { registry, activeSchemaManager, snapshotRoot, warn } = opts;

  app.get<{ Params: { id: string } }>('/configs/:id/history', async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked || !isRegularFileOrMissing(tracked.path)) {
      return reply.code(404).send(errBody('Unknown tracked config id'));
    }
    try {
      const snapshots = await listSnapshots(tracked.path, snapshotRoot);
      return { ok: true, snapshots };
    } catch {
      return reply.code(422).send(errBody('Snapshot unavailable'));
    }
  });

  app.get<{ Params: { id: string; seq: string } }>('/configs/:id/history/:seq', async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked || !isRegularFileOrMissing(tracked.path)) {
      return reply.code(404).send(errBody('Unknown tracked config id'));
    }
    const seq = parseSequence(req.params.seq);
    if (seq === undefined) return reply.code(400).send(errBody('Invalid snapshot sequence'));

    try {
      const snapshot = await readSnapshotBySequence(tracked.path, seq, snapshotRoot);
      if (!isProjectDocument(snapshot.document)) return reply.code(422).send(errBody('Snapshot unavailable'));
      const current = await currentProjectDocument(tracked.path);
      const detail: HistorySnapshotDetail = { snapshot: { ...publicMetadata(snapshot), document: snapshot.document }, current: current.document, currentRevision: current.revision };
      return { ok: true, ...detail };
    } catch (error) {
      return snapshotError(reply, error);
    }
  });

  app.post<{ Params: { id: string; seq: string }; Body: { expectedRevision: string } }>('/configs/:id/history/:seq/restore', { schema: { body: RESTORE_BODY_SCHEMA } }, async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked || !isRegularFileOrMissing(tracked.path)) {
      return reply.code(404).send(errBody('Unknown tracked config id'));
    }
    const seq = parseSequence(req.params.seq);
    if (seq === undefined) return reply.code(400).send(errBody('Invalid snapshot sequence'));

    try {
      const snapshot = await readSnapshotBySequence(tracked.path, seq, snapshotRoot);
      if (!isProjectDocument(snapshot.document)) return reply.code(422).send(errBody('Snapshot unavailable'));
      const active = activeSchemaManager.snapshot();
      const result = await saveWithSnapshot(tracked.path, snapshot.document, active.validator, req.body.expectedRevision, { root: snapshotRoot, warn });
      if (!result.ok) {
        if ('conflict' in result) return reply.code(409).send(errBody('This configuration changed on disk. Review the current file before restoring.'));
        return reply.code(422).send({ ok: false, errors: result.errors });
      }
      const restore: HistoryRestoreResult = { snapshotId: result.snapshotId, warning: result.warning };
      return { ok: true, ...restore };
    } catch (error) {
      return snapshotError(reply, error);
    }
  });
};
