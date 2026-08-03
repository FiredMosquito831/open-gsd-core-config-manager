import { apiFetch } from './client';
import type { SchemaEntry } from '../../../packages/config-io/src/types';

export function getSchema() {
  return apiFetch<{ schema: Record<string, SchemaEntry> }>('/api/schema').then((r) => r.schema);
}
