import bundledSchema from '../../../packages/schema-data/bundled-schema.json' with { type: 'json' };
import catalog from '../../../packages/schema-data/specialized-catalog.json' with { type: 'json' };
import type { SchemaEntry } from '../../../packages/config-io/src/types';

interface SpecializedCatalog {
  profiles: string[];
  agents: string[];
  sensitivePaths: string[];
  evidence: Record<string, string>;
  runtimeInstallMatrix: RuntimeInstallRule[];
}

const specializedCatalog = catalog as SpecializedCatalog; // generated from the verified Wave 1 evidence artifact.

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

const schema = bundledSchema as Record<string, SchemaEntry>;

function isSpecializedDescriptorMetadata(value: Record<string, unknown>): value is Pick<SpecializedDescriptor, 'editor' | 'editable' | 'sensitive' | 'sourceEvidence'> & { reason?: unknown } {
  return typeof value.editor === 'string'
    && typeof value.editable === 'boolean'
    && typeof value.sensitive === 'boolean'
    && Array.isArray(value.sourceEvidence)
    && value.sourceEvidence.every((source) => typeof source === 'string');
}

const schemaMetadata = (path: string): SpecializedDescriptor | undefined => {
  const metadata = schema[path]?.['x-specialized'];
  if (!metadata || !isSpecializedDescriptorMetadata(metadata)) return undefined;
  return {
    path,
    editor: metadata.editor as SpecializedEditor,
    editable: metadata.editable,
    sensitive: metadata.sensitive,
    sourceEvidence: metadata.sourceEvidence.length > 0
      ? metadata.sourceEvidence
      : specializedCatalog.evidence[path]
        ? [specializedCatalog.evidence[path]]
        : [],
    reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
  };
};

const runtimeInstallMatrix = specializedCatalog.runtimeInstallMatrix;

const descriptor = (
  path: string,
  editor: SpecializedEditor,
  options: Partial<Omit<SpecializedDescriptor, 'path' | 'editor' | 'sourceEvidence'>> & { sourceEvidence?: string[] } = {},
): SpecializedDescriptor => ({
  ...(schemaMetadata(path) ?? {
    path,
    editable: editor !== 'read-only-unsupported',
    sensitive: false,
    sourceEvidence: specializedCatalog.evidence[path] ? [specializedCatalog.evidence[path]] : [],
  }),
  path,
  editor,
  ...options,
});

const structured = (path: string, fields: SpecializedField[]) =>
  descriptor(path, 'structured-array', { fields });

export const SPECIALIZED_METADATA: SpecializedDescriptor[] = [
  descriptor('ship.pr_body_sections', 'structured-array', {
    sourceEvidence: [specializedCatalog.evidence['ship.pr_body_sections']],
    fields: [
    { path: 'heading', type: 'string', required: true },
    { path: 'body', type: 'string', required: true },
    ],
  }),
  descriptor('model_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: ['opus', 'sonnet', 'haiku', 'inherit'],
  }),
  descriptor('effort.agent_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: ['low', 'medium', 'high'],
  }),
  descriptor('fast_mode.agent_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: [true, false],
  }),
  descriptor('model_profile_overrides', 'runtime-tier-map', {
    runtimeInstall: runtimeInstallMatrix,
  }),
  descriptor('model_policy.runtime_tiers', 'runtime-tier-map', {
    fields: [
      { path: 'model', type: 'string', required: true },
      { path: 'reasoning_effort', type: 'string' },
    ],
    runtimeInstall: runtimeInstallMatrix,
  }),
  descriptor('model_profile', 'profile-select', {
    allowedValues: specializedCatalog.profiles,
  }),
  descriptor('models', 'runtime-tier-map', {
    keyCatalog: 'phaseTypes',
    allowedValues: ['opus', 'sonnet', 'haiku', 'inherit'],
  }),
  descriptor('review.reviewer_instances', 'read-only-unsupported', {
    editable: false,
    reason: 'bundled schema has no matching validation shape',
  }),
  ...specializedCatalog.sensitivePaths.map((path) =>
    descriptor(path, 'read-only-unsupported', {
      editable: false,
      sensitive: true,
      reason: 'sensitive path has no confirmed specialized editor',
    }),
  ),
  ...Object.entries(schema)
    .filter(([path, entry]) => {
      const metadata = entry['x-specialized'];
      return metadata && isSpecializedDescriptorMetadata(metadata)
        && metadata.sensitive
        && !specializedCatalog.sensitivePaths.includes(path);
    })
    .map(([path]) =>
      descriptor(path, 'read-only-unsupported', {
        editable: false,
        sensitive: true,
        reason: 'sensitive path has no confirmed specialized editor',
      }),
    ),
];

const byPath = new Map(SPECIALIZED_METADATA.map((entry) => [entry.path, entry]));

export function getSpecializedDescriptor(path: string): SpecializedDescriptor | undefined {
  return byPath.get(path);
}

export function getAgentCatalog(): string[] {
  return specializedCatalog.agents;
}

export function isSpecializedEditable(path: string): boolean {
  return getSpecializedDescriptor(path)?.editable === true;
}

export function specializedEntryMetadata(path: string): Pick<SchemaEntry, 'x-specialized'> | undefined {
  const item = getSpecializedDescriptor(path);
  return item ? { 'x-specialized': item as unknown as NonNullable<SchemaEntry['x-specialized']> } : undefined;
}
