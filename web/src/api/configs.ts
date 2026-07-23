import { apiFetch } from './client';
import type { LoadResult } from '../../../packages/config-io/src/types';
import type {
  HistoryRestoreResult,
  HistorySnapshotDetail,
  HistorySnapshotMeta,
  TrackedConfig,
} from '../../../packages/server/src/api-types';

function historyPath(id: string, seq?: number): string {
  const encodedId = encodeURIComponent(id);
  if (seq === undefined) return `/api/configs/${encodedId}/history`;
  if (!Number.isSafeInteger(seq) || seq <= 0) throw new TypeError('History sequence must be a positive safe integer');
  return `/api/configs/${encodedId}/history/${seq}`;
}

export function listConfigs() {
  return apiFetch<{ configs: TrackedConfig[] }>('/api/configs').then((r) => r.configs);
}

export function trackConfig(path: string) {
  return apiFetch<{ config: TrackedConfig }>('/api/configs/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  }).then((r) => r.config);
}

export type LoadedConfig = LoadResult & { revision?: string };

export function loadConfig(id: string): Promise<LoadedConfig> {
  return apiFetch<{ data: LoadResult; revision: string }>(`/api/configs/${id}`)
    .then(({ data, revision }) => ({ ...data, revision }));
}

export function saveConfig(id: string, config: object, expectedRevision = '') {
  return apiFetch<{ snapshotId?: string; warning?: string; revision?: string }>(`/api/configs/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config, expectedRevision }),
  });
}

/** Lists safe metadata for one opaque tracked configuration. */
export function listConfigHistory(id: string) {
  return apiFetch<{ snapshots: HistorySnapshotMeta[] }>(historyPath(id)).then((result) => result.snapshots);
}

/** Loads the selected snapshot plus the current persisted project document. */
export function loadHistoryComparison(id: string, seq: number) {
  return apiFetch<HistorySnapshotDetail>(historyPath(id, seq));
}

/** Restores a selected snapshot without ever accepting browser-supplied document content. */
export function restoreConfigSnapshot(id: string, seq: number, expectedRevision = '') {
  return apiFetch<HistoryRestoreResult>(`${historyPath(id, seq)}/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision }),
  });
}

export const listHistory = listConfigHistory;
export const getHistorySnapshot = loadHistoryComparison;
export const restoreHistorySnapshot = restoreConfigSnapshot;
