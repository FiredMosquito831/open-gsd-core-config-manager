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
  allowedDescriptions?: Record<string, string>;
  keyCatalog?: 'agents' | 'phaseTypes' | 'routingTiers';
  runtimeInstall?: RuntimeInstallRule[];
  reason?: string;
}

const schema = bundledSchema as Record<string, SchemaEntry>;

/**
 * Extract the fixed set of allowed dynamic-map keys for a container entry
 * (e.g. `^models\.(planning|...|completion)$` -> the six phase types) directly
 * from the bundled schema's patternProperties. Deriving the catalogs from the
 * schema (rather than hardcoding them) keeps the UI in lockstep with the
 * canonical schema when gsd-core evolves the accepted slot names.
 */
function derivePatternKeys(path: string): string[] {
  const entry = schema[path];
  const pattern = entry?.patternProperties ? Object.keys(entry.patternProperties)[0] : undefined;
  if (!pattern) return [];
  const match = pattern.match(/\\\.\(([a-z]+(?:\|[a-z]+)+)\)\$$/);
  return match ? match[1].split('|') : [];
}

const PHASE_TYPES = derivePatternKeys('models');
const ROUTING_TIERS = derivePatternKeys('effort.routing_tier_defaults');

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
    allowedDescriptions: {
      'opus': 'Use Opus (highest quality) for this agent.',
      'sonnet': 'Use Sonnet (balanced) for this agent.',
      'haiku': 'Use Haiku (fastest/lightest) for this agent.',
      'inherit': 'Inherit from the session profile instead of overriding.',
    },
  }),
  descriptor('effort.agent_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    allowedDescriptions: {
      'minimal': 'Lowest reasoning effort — fastest, least thorough.',
      'low': 'Low reasoning effort for simple tasks.',
      'medium': 'Moderate reasoning effort.',
      'high': 'High reasoning effort for substantive tasks.',
      'xhigh': 'Extra-high reasoning effort for deep reasoning.',
      'max': 'Maximum reasoning effort — slowest, most thorough.',
    },
  }),
  descriptor('effort.routing_tier_defaults', 'runtime-tier-map', {
    keyCatalog: 'routingTiers',
    allowedValues: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    allowedDescriptions: {
      'minimal': 'Lowest effort tier — fastest, least thorough.',
      'low': 'Low reasoning effort for simple routing tasks.',
      'medium': 'Moderate reasoning effort.',
      'high': 'High reasoning effort for substantive routing.',
      'xhigh': 'Extra-high reasoning effort.',
      'max': 'Maximum reasoning effort — slowest, most thorough.',
    },
    sourceEvidence: ['docs/CONFIGURATION.md#effort.routing_tier_defaults'],
  }),
  descriptor('fast_mode.agent_overrides', 'agent-map', {
    keyCatalog: 'agents',
    allowedValues: [true, false],
    allowedDescriptions: {
      'true': 'Enable Fast Mode (reduced-ceremony execution) for this agent.',
      'false': 'Keep standard execution ceremony for this agent (default).',
    },
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
    allowedDescriptions: {
      'opus': 'Opus — highest reasoning quality; use for high-stakes planning and review.',
      'sonnet': 'Sonnet — balanced quality/speed (default for execution tasks).',
      'haiku': 'Haiku — fastest, lightest reasoning; good for quick scans and routine work.',
      'inherit': 'Inherit the session-level model profile instead of overriding per phase.',
    },
  }),
  descriptor('granularities', 'runtime-tier-map', {
    keyCatalog: 'phaseTypes',
    allowedValues: ['coarse', 'standard', 'fine'],
    allowedDescriptions: {
      'coarse': 'Fewer, larger plans per milestone (2-4 phases); fastest, least detail.',
      'standard': 'One plan per phase; the balanced default.',
      'fine': 'Task-level plans with the most detail (6-10 phases per milestone).',
    },
    sourceEvidence: ['docs/CONFIGURATION.md#granularities.<phase_type>'],
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

export function getPhaseTypesCatalog(): string[] {
  return PHASE_TYPES;
}

export function getRoutingTiersCatalog(): string[] {
  return ROUTING_TIERS;
}

export function isSpecializedEditable(path: string): boolean {
  return getSpecializedDescriptor(path)?.editable === true;
}

export function specializedEntryMetadata(path: string): Pick<SchemaEntry, 'x-specialized'> | undefined {
  const item = getSpecializedDescriptor(path);
  return item ? { 'x-specialized': item as unknown as NonNullable<SchemaEntry['x-specialized']> } : undefined;
}
