import type {
  CanonicalSchema,
  CanonicalSchemaEntry,
  CanonicalSchemaMetadata,
  ParsedSchemaSources,
  ReconciliationOverlays,
  ReconciliationResult,
  SchemaChange,
  SchemaChangeGroup,
  SchemaChangeSet,
  SourceIdentity,
} from './source-types.js';

const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const FIXTURE_OBSERVED_TYPES: Record<string, string> = {
  'gates.confirm_project': 'boolean', 'gates.confirm_phases': 'boolean', 'gates.confirm_roadmap': 'boolean',
  'gates.confirm_breakdown': 'boolean', 'gates.confirm_plan': 'boolean', 'gates.execute_next_plan': 'boolean',
  'gates.issues_review': 'boolean', 'gates.confirm_transition': 'boolean', 'safety.always_confirm_destructive': 'boolean',
  'safety.always_confirm_external_services': 'boolean', 'parallelization.enabled': 'boolean',
  'parallelization.plan_level': 'boolean', 'parallelization.task_level': 'boolean', 'parallelization.skip_checkpoints': 'boolean',
  'parallelization.max_concurrent_agents': 'number', 'parallelization.min_plans_for_parallel': 'number',
};

function assertSafePath(key: string): void {
  if (!key || key.split('.').some((segment) => !segment || UNSAFE_SEGMENTS.has(segment))) {
    throw new Error('Unsafe schema key');
  }
}

function getAtPath(value: unknown, key: string): unknown {
  assertSafePath(key);
  let cursor: unknown = value;
  for (const segment of key.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    const record = cursor as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) return undefined;
    cursor = record[segment];
  }
  return cursor;
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (['boolean', 'number', 'string', 'object'].includes(typeof value)) return typeof value;
  return 'string';
}

function inferValue(sources: ParsedSchemaSources, key: string): unknown {
  for (const source of [sources.defaults, ...sources.fixtureValues]) {
    const value = getAtPath(source, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

function inferType(sources: ParsedSchemaSources, key: string): string | string[] {
  const value = inferValue(sources, key);
  if (value !== undefined) return value === null ? ['string', 'null'] : valueType(value);
  return 'string';
}

function titleCase(value: string): string {
  return value.split(/[_-]/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' ');
}

function titleFor(key: string): string { return titleCase(key.split('.').at(-1) ?? key); }

function categoryFor(key: string): string {
  if (key.startsWith('gates.')) return 'Gates';
  if (key.startsWith('safety.') || key.startsWith('security.')) return 'Security';
  if (key.startsWith('git.')) return 'Git';
  if (key.startsWith('planning.')) return 'Planning';
  if (key.startsWith('review.') || key.startsWith('plan_review')) return 'Review';
  if (key.startsWith('ship.')) return 'Ship';
  if (key.startsWith('effort.') || key.startsWith('fast_mode.')) return 'Effort';
  if (key.startsWith('model_') || key.startsWith('models') || key.startsWith('agent_skills')) return 'Model & Routing';
  if (key.startsWith('workflow.') || key === 'mode' || key === 'granularity') return 'Workflow';
  return 'General';
}

function dynamicContainer(source: string): string {
  const literal: string[] = [];
  for (const part of source.replace(/^\^/, '').replace(/\$$/, '').split('\\.')) {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) break;
    literal.push(part);
  }
  return literal.join('.');
}

function dynamicLeafType(container: string): string | string[] {
  return ({ model_overrides: 'string', model_profile_overrides: 'string', 'model_policy.runtime_tiers': 'string',
    'effort.routing_tier_defaults': 'string', 'effort.agent_overrides': 'string', 'fast_mode.routing_tier_defaults': 'boolean',
    'fast_mode.agent_overrides': 'boolean', 'review.max_prompt_tokens_per_reviewer': 'number', review: 'string',
    granularities: 'string', models: 'string', features: 'boolean', agent_skills: ['object', 'null'],
    dynamic_routing: ['string', 'number', 'boolean', 'null'] } as Record<string, string | string[]>)[container] ?? 'string';
}

function sortSchema(schema: CanonicalSchema): CanonicalSchema {
  return Object.fromEntries(Object.keys(schema).sort().map((key) => [key, schema[key]!])) as CanonicalSchema;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function semanticProjection(entry: CanonicalSchemaEntry | undefined): Record<string, unknown> | null {
  if (!entry) return null;
  return {
    type: Array.isArray(entry.type) ? [...entry.type].sort() : entry.type,
    enum: entry.enum ? [...entry.enum].sort((a, b) => stable(a).localeCompare(stable(b))) : undefined,
    default: entry.default,
    patternProperties: entry.patternProperties ? Object.fromEntries(Object.keys(entry.patternProperties).sort().map((key) => [key, semanticProjection(entry.patternProperties![key])])) : undefined,
    dynamicKeyHint: entry['x-dynamic-key-hint'],
    deprecated: entry['x-deprecated'] === true,
  };
}

export function reconcileSchemaSources(
  sources: ParsedSchemaSources,
  activeSchema: CanonicalSchema,
  overlays: ReconciliationOverlays,
  identity: SourceIdentity,
): ReconciliationResult {
  const entries: CanonicalSchema = {};
  const runtime = new Set(sources.manifest.runtimeStateKeys);
  const add = (key: string, entry: CanonicalSchemaEntry) => {
    assertSafePath(key);
    if (!runtime.has(key)) entries[key] = entry;
  };

  for (const key of sources.manifest.validKeys) add(key, { type: inferType(sources, key), default: inferValue(sources, key), title: titleFor(key), 'x-category': categoryFor(key), 'x-description': '', 'x-provenance': 'manifest' });
  for (const [key, capability] of Object.entries(sources.capabilitySchema)) {
    const enumValues = capability.type === 'enum' ? capability.values : undefined;
    add(key, { type: capability.type === 'enum' ? 'string' : capability.type, default: capability.default, enum: enumValues, title: titleFor(key), 'x-category': categoryFor(key), 'x-description': capability.description ?? '', 'x-provenance': 'capability-registry' });
  }
  for (const pattern of sources.manifest.dynamicKeyPatterns) {
    const container = dynamicContainer(pattern.source);
    if (!container) continue;
    add(container, { type: ['object', 'null'], title: titleFor(container), 'x-category': categoryFor(container), 'x-description': '', 'x-provenance': `dynamicKeyPattern:${pattern.topLevel}`, 'x-dynamic-key-hint': pattern.description, patternProperties: { [pattern.source]: { type: dynamicLeafType(container), title: `${titleFor(container)} Entry`, 'x-category': categoryFor(container), 'x-description': `See ${container} — ${pattern.description}`, 'x-provenance': `dynamicKeyPattern:${pattern.topLevel}` } } });
  }
  for (const [key, type] of Object.entries(FIXTURE_OBSERVED_TYPES)) add(key, { type, default: inferValue(sources, key), title: titleFor(key), 'x-category': categoryFor(key), 'x-description': '', 'x-provenance': 'fixture-observed' });
  if (entries.parallelization) entries.parallelization.type = ['boolean', 'object'];

  for (const [key, curated] of Object.entries(overlays.curated)) {
    assertSafePath(key);
    const fallback: CanonicalSchemaEntry = {
      type: 'string', title: titleFor(key), 'x-category': categoryFor(key),
      'x-description': '', 'x-provenance': 'curated-docs-only',
    };
    entries[key] = { ...fallback, ...entries[key], ...curated };
  }
  for (const entry of Object.values(entries)) {
    if (!entry.enum) continue;
    const options = entry['x-options'] ?? {};
    for (const option of entry.enum) options[String(option)] ??= { 'x-description': '' };
    entry['x-options'] = options;
  }
  if (entries.model_profile) entries.model_profile.enum = ['quality', 'balanced', 'budget', 'adaptive', 'inherit'];
  for (const [key, specialized] of Object.entries(overlays.specialized)) if (entries[key]) entries[key]['x-specialized'] = specialized;

  for (const [key, active] of Object.entries(activeSchema)) {
    assertSafePath(key);
    if (entries[key] || runtime.has(key)) continue;
    entries[key] = { ...active, 'x-deprecated': true, 'x-deprecated-since': identity.gsdCoreVersion, 'x-deprecation-source': { gsdCoreVersion: identity.gsdCoreVersion, tag: identity.tag, ...(identity.commit ? { commit: identity.commit } : {}) } };
  }

  return { schema: sortSchema(entries), metadata: { envelopeVersion: 1, source: 'refreshed', ...identity } };
}

export function diffCanonicalSchemas(previous: CanonicalSchema, proposed: CanonicalSchema, documentationFingerprints: { previous: Record<string, string>; proposed: Record<string, string> }): SchemaChangeSet {
  const changes: SchemaChange[] = [];
  const groups: Record<SchemaChangeGroup, SchemaChange[]> = { added: [], changed: [], deprecated: [], 'documentation-drift': [] };
  for (const key of [...new Set([...Object.keys(previous), ...Object.keys(proposed)])].sort()) {
    const oldEntry = previous[key]; const newEntry = proposed[key];
    const oldProjection = semanticProjection(oldEntry); const newProjection = semanticProjection(newEntry);
    const addChange = (group: SchemaChangeGroup, summary: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) => {
      const change = { key, group, summary, previous: oldValue, proposed: newValue };
      changes.push(change); groups[group].push(change);
    };
    if (!oldEntry && newEntry) addChange('added', 'Key added by upstream structural evidence.', null, newProjection);
    else if (oldEntry && !newEntry) addChange('changed', 'Key no longer appears in the proposed schema.', oldProjection, null);
    else if (oldEntry && newEntry) {
      if (!oldEntry['x-deprecated'] && newEntry['x-deprecated']) addChange('deprecated', 'Key retained for compatibility after removal from upstream evidence.', oldProjection, newProjection);
      else if (stable(oldProjection) !== stable(newProjection)) addChange('changed', 'Structural schema evidence changed.', oldProjection, newProjection);
    }
    const oldDoc = documentationFingerprints.previous[key]; const newDoc = documentationFingerprints.proposed[key];
    if (oldDoc !== undefined && newDoc !== undefined && oldDoc !== newDoc) addChange('documentation-drift', 'Upstream documentation changed; curated explanation remains authoritative.', { fingerprint: oldDoc }, { fingerprint: newDoc });
  }
  return { changes, byGroup: groups };
}

export function validateBundledSchemaMetadata(value: unknown): value is CanonicalSchemaMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Record<string, unknown>;
  const version = metadata.gsdCoreVersion;
  const tag = metadata.tag;
  const generatedAt = metadata.generatedAt;
  return metadata.envelopeVersion === 1 && metadata.source === 'bundled' &&
    typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) &&
    typeof tag === 'string' && tag === `v${version}` &&
    typeof generatedAt === 'string' && !Number.isNaN(Date.parse(generatedAt));
}
