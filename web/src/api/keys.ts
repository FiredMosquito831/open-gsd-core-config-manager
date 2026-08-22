import { apiFetch } from './client';
import type { KeyStatusDto } from '../../../packages/server/src/api-types';

export async function listKeys(): Promise<KeyStatusDto[]> {
  return apiFetch<{ keys: KeyStatusDto[] }>('/api/keys').then((r) => r.keys);
}

export async function getKey(provider: string): Promise<KeyStatusDto> {
  return apiFetch<{ status: KeyStatusDto }>(`/api/keys/${encodeURIComponent(provider)}`).then((r) => r.status);
}

export async function setKey(
  provider: string,
  value: string,
  channel: 'file' | 'env' | 'both',
): Promise<KeyStatusDto> {
  return apiFetch<{ status: KeyStatusDto }>('/api/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, value, channel }),
  }).then((r) => r.status);
}

export async function clearKey(provider: string): Promise<KeyStatusDto> {
  return apiFetch<{ status: KeyStatusDto }>(`/api/keys/${encodeURIComponent(provider)}`, { method: 'DELETE' }).then((r) => r.status);
}
