import { apiFetch } from './client';
import type { SchemaEntry } from '../../../packages/config-io/src/types';
import type { SchemaProposalDto, SchemaStatusDto } from '../../../packages/server/src/api-types';

export type SchemaRefreshResult = { status: SchemaStatusDto; proposal?: SchemaProposalDto; noChange?: true };

export function getSchema() {
  return apiFetch<{ schema: Record<string, SchemaEntry> }>('/api/schema').then((r) => r.schema);
}

/** Server-owned schema lifecycle calls accept no source selectors or schema content. */
export type SchemaStatusResult = SchemaStatusDto & { proposal?: SchemaProposalDto };

export function getSchemaStatus() {
  return apiFetch<{ status: SchemaStatusDto; proposal?: SchemaProposalDto }>('/api/schema/status')
    .then(({ status, proposal }) => ({ ...status, ...(proposal ? { proposal } : {}) }));
}

export function refreshSchema() {
  return apiFetch<SchemaRefreshResult>('/api/schema/refresh', { method: 'POST' });
}

export function activateSchemaProposal(proposalId: string) {
  return apiFetch<{ status: SchemaStatusDto }>(`/api/schema/proposals/${encodeURIComponent(proposalId)}/activate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
  }).then((response) => response.status);
}

export function cancelSchemaProposal(proposalId: string) {
  return apiFetch<{ cancelled: true }>(`/api/schema/proposals/${encodeURIComponent(proposalId)}`, {
    method: 'DELETE',
  }).then(() => undefined);
}

export function resetSchemaToBundled() {
  return apiFetch<{ status: SchemaStatusDto }>('/api/schema/reset', { method: 'POST' }).then((response) => response.status);
}
