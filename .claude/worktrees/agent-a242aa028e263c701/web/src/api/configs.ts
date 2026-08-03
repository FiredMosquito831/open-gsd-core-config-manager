import { apiFetch } from './client';
import type { LoadResult } from '../../../packages/config-io/src/types';
import type { TrackedConfig } from '../../../packages/server/src/api-types';

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

export function loadConfig(id: string) {
  return apiFetch<{ data: LoadResult }>(`/api/configs/${id}`).then((r) => r.data);
}

export function saveConfig(id: string, config: object) {
  return apiFetch<{ snapshotId?: string; warning?: string }>(`/api/configs/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
}
