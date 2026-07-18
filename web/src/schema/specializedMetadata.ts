import catalog from '../../../test/fixtures/phase4-gsd-core-catalog.json' with { type: 'json' };
import type { SchemaEntry } from '../../../packages/config-io/src/types';

export type SpecializedEditor =
  | 'structured-array'
  | 'agent-map'
  | 'runtime-tier-map'
  | 'profile-select'
  | 'read-only-unsupported';

export interface SpecializedField {
  path: string;
  type: string | string[];
  required?: boolean;
}

export interface RuntimeInstallRule {
  runtime: string;
  path: string;
  command: string;
}

export interface SpecializedDescriptor {
  path: string;
  editor: SpecializedEditor;
  editable: boolean;
  sensitive: boolean;
  sourceEvidence: string[];
  fields?: SpecializedField[];
  allowedValues?: unknown[];
  keyCatalog?: 'agents' | 'phaseTypes';
  runtimeInstall?: RuntimeInstallRule[];
  reason?: string;
}

const sourceRefs = (path: string): string[] => {
  const descriptors = catalog.descriptors as Record<string, { evidence?: string }>;
  const direct = descriptors[path];
  if (direct?.evidence) return [direct.evidence];
  const schemaEvidence: Record<string, string> = {
    'ship.pr_body_sections': 'docs/CONFIGURATION.md#ship.pr_body_sections',
    model_profile: 'docs/CONFIGURATION.md#model_profile',
    models: 'docs/CONFIGURATION.md#models',
  };
  return schemaEvidence[path] ? [schemaEvidence[path]] : [];
};

const descriptor = (
  path: string,
  editor: SpecializedEditor,
  options: Omit<SpecializedDescriptor, 'path' | 'editor' | 'sourceEvidence'> = {},
): SpecializedDescriptor => ({
  path,
  editor,
  sourceEvidence: sourceRefs(path),
  editable: editor !== 'read-only-unsupported',
  sensitive: false,
  ...options,
});

const structured = (path: string, fields: SpecializedField[]) => descriptor(path, 'structured-array', { fields });

export const SPECIALIZED_METADATA: SpecializedDescriptor[] = [
  structured('ship.pr_body_sections', [
    { path: 'heading', type: 'string', required: true },
    { path: 'body', type: 'string', required: true },
  ]),
  descriptor('model_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: ['opus', 'sonnet', 'haiku', 'inherit'],
  }),
  descriptor('effort.agent_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: ['low', 'medium', 'high'],
  }),
  descriptor('fast_mode.agent_overrides', 'agent-map', { keyCatalog: 'agents', allowedValues: [true, false] }),
  descriptor('model_profile_overrides', 'runtime-tier-map', {
    runtimeInstall: catalog.runtimeInstallMatrix as RuntimeInstallRule[],
  }),
  descriptor('model_policy.runtime_tiers', 'runtime-tier-map', {
    fields: [
      { path: 'model', type: 'string', required: true },
      { path: 'reasoning_effort', type: 'string' },
    ],
    runtimeInstall: catalog.runtimeInstallMatrix as RuntimeInstallRule[],
  }),
  descriptor('model_profile', 'profile-select', {
    allowedValues: catalog.profiles,
  }),
  descriptor('models', 'runtime-tier-map', {
    keyCatalog: 'phaseTypes',
    allowedValues: ['opus', 'sonnet', 'haiku', 'inherit'],
  }),
  descriptor('review.reviewer_instances', 'read-only-unsupported', {
    editable: false,
    reason: 'bundled schema has no matching validation shape',
  }),
  ...catalog.sensitivePaths.map((path) => ({
    path,
    editor: 'read-only-unsupported' as const,
    editable: false,
    sensitive: true,
    sourceEvidence: sourceRefs(path),
    reason: 'sensitive path has no confirmed specialized editor',
  })),
];

const byPath = new Map(SPECIALIZED_METADATA.map((entry) => [entry.path, entry]));

export function getSpecializedDescriptor(path: string): SpecializedDescriptor | undefined {
  return byPath.get(path);
}

export function isSpecializedEditable(path: string): boolean {
  return getSpecializedDescriptor(path)?.editable === true;
}

export function specializedEntryMetadata(path: string): Pick<SchemaEntry, 'x-specialized'> | undefined {
  const item = getSpecializedDescriptor(path);
  return item ? { 'x-specialized': item } : undefined;
}
