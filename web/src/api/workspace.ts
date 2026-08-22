import { apiFetch } from './client';
import type { TrackedWorkspaceConfig } from '../../../packages/server/src/api-types';

export function listWorkspaceConfigs() {
  return apiFetch<{ configs: TrackedWorkspaceConfig[] }>('/api/workspace/configs').then((r) => r.configs);
}

export function trackWorkspace(path: string) {
  return apiFetch<{ config: TrackedWorkspaceConfig }>('/api/workspace/configs/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  }).then((r) => r.config);
}

export function removeWorkspace(id: string) {
  return apiFetch<Record<string, never>>(`/api/workspace/configs/${id}`, { method: 'DELETE' });
}

export function reorderWorkspace(ids: string[]) {
  return apiFetch<Record<string, never>>('/api/workspace/configs/reorder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export function locateWorkspace(id: string, path: string) {
  return apiFetch<{ config: TrackedWorkspaceConfig }>(`/api/workspace/configs/${id}/locate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  }).then((r) => r.config);
}

export type ScanCandidate = { projectName: string; path: string; status: 'new' | 'tracked' | 'invalid' };

export function scanWorkspace(rootPath: string) {
  return apiFetch<{ candidates: ScanCandidate[] }>('/api/workspace/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rootPath }),
  }).then((r) => r.candidates);
}

export function previewCreateConfig(projectDir: string) {
  return apiFetch<{ targetPath: string; exists: boolean }>('/api/workspace/configs/create-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectDir }),
  });
}

export function createConfig(projectDir: string, overwrite: boolean) {
  return apiFetch<{ config: TrackedWorkspaceConfig }>('/api/workspace/configs/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectDir, overwrite }),
  }).then((r) => r.config);
}

export type ConfigFileChangeEvent = {
  type: 'changed' | 'deleted' | 'renamed';
  configId: string;
  path: string;
  timestamp: string;
};

export function subscribeToFileChanges(onEvent: (event: ConfigFileChangeEvent) => void): () => void {
  const eventSource = new EventSource('/api/workspace/events');

  eventSource.addEventListener('file-change', (event) => {
    const data = JSON.parse(event.data) as ConfigFileChangeEvent;
    onEvent(data);
  });

  eventSource.addEventListener('error', () => {
    eventSource.close();
  });

  return () => eventSource.close();
}
