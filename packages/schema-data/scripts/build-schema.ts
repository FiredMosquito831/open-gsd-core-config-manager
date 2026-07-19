/**
 * build-schema.ts — 4-source schema reconciliation script (D-02, D-03).
 *
 * Maintainer tool, run via `npm run build:schema`. Produces
 * `packages/schema-data/bundled-schema.json`: a flat, dot-path-keyed map of
 * every known GSD config key to a SchemaEntry-shaped descriptor (JSON Schema
 * 2020-12 primitives + `x-*` vendor extensions).
 *
 * Reconciles FOUR sources, read as DATA only (never eval'd as untrusted
 * remote code — see 01-02-PLAN.md <threat_model> T-01-RCE):
 *   1. config-schema.manifest.json  `validKeys`        — PRIMARY authority (D-03)
 *   2. config-schema.manifest.json  `dynamicKeyPatterns` — pool/agent-map shapes (D-03)
 *   3. capability-registry.cjs      `configSchema`     — federated per-capability keys + prose
 *   4. config-defaults.manifest.json `CONFIG_DEFAULTS` — default values (nested)
 *
 * Plus a fixture-observed fifth input: `gates.*` (8 booleans) and `safety.*`
 * (2 booleans), present and consistent across all three real fixtures but
 * declared in none of the four sources above (RESEARCH.md § Critical Finding,
 * USER DECISION). Modeled here, tagged `x-provenance: "fixture-observed"`.
 *
 * `runtimeStateKeys` (e.g. `workflow._auto_chain_active`) are internal
 * runtime state, not user config — explicitly excluded.
 *
 * `planning.granularity` is present in CONFIG_DEFAULTS but absent from
 * `validKeys` and unused by any real fixture — RESEARCH.md's Open Question 2
 * resolved to omit it from known-keys (it still surfaces in the `unknown[]`
 * bucket at runtime via the open-`additionalProperties` design, per that
 * resolution — no special-casing needed downstream).
 *
 * On each run, if `packages/schema-data/curated-docs.json` exists, its
 * hand-authored `x-description` / `x-category` / `x-options` prose is merged
 * OVER the generated structural skeleton (curated prose wins), so this
 * script is idempotent and Phase-6-reconcile-safe.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DATA_DIR = path.resolve(SCRIPT_DIR, '..'); // packages/schema-data
const REPO_ROOT = path.resolve(SCHEMA_DATA_DIR, '..', '..');

const GSD_HOME = process.env.GSD_HOME || os.homedir();
const GSD_CORE_BIN = path.join(GSD_HOME, '.claude', 'gsd-core', 'bin');

const MANIFEST_PATH = path.join(GSD_CORE_BIN, 'shared', 'config-schema.manifest.json');
const DEFAULTS_PATH = path.join(GSD_CORE_BIN, 'shared', 'config-defaults.manifest.json');
const CAPABILITY_REGISTRY_PATH = path.join(GSD_CORE_BIN, 'lib', 'capability-registry.cjs');

const CURATED_DOCS_PATH = path.join(SCHEMA_DATA_DIR, 'curated-docs.json');
const OUTPUT_PATH = path.join(SCHEMA_DATA_DIR, 'bundled-schema.json');
const EXISTING_SCHEMA_PATH = OUTPUT_PATH;

const PROJECT_FIXTURE_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'project-config.json');
const GLOBAL_FIXTURE_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'global-defaults.json');
const CLAUDE_API_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'global-defaults-claude-api.json',
);

// ---------------------------------------------------------------------------
// Types (loose — this is a build-time JSON producer, not a strict consumer
// of packages/config-io/src/types.ts's SchemaEntry; the emitted shape is a
// superset-compatible match)
// ---------------------------------------------------------------------------

interface Entry {
  type: string | string[];
  enum?: unknown[];
  default?: unknown;
  title: string;
  'x-category': string;
  'x-description': string;
  'x-provenance': string;
  patternProperties?: Record<string, Entry>;
  'x-dynamic-key-hint'?: string;
  'x-options'?: Record<string, { 'x-description': string }>;
  'x-specialized'?: SpecializedMetadata;
}

interface SpecializedMetadata {
  path: string;
  editor: 'structured-array' | 'agent-map' | 'runtime-tier-map' | 'profile-select' | 'read-only-unsupported';
  editable: boolean;
  sensitive: boolean;
  sourceEvidence: string[];
}

interface Manifest {
  validKeys: string[];
  runtimeStateKeys: string[];
  dynamicKeyPatterns: Array<{ topLevel: string; source: string; description: string }>;
}

interface CapabilitySchemaEntry {
  owner: string;
  type: 'boolean' | 'number' | 'string' | 'enum';
  default?: unknown;
  description: string;
  values?: string[];
}

// ---------------------------------------------------------------------------
// Load the four sources as data
// ---------------------------------------------------------------------------

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const manifest = readJson<Manifest>(MANIFEST_PATH);
const configDefaults = readJson<Record<string, unknown>>(DEFAULTS_PATH);
const existingSpecializedMetadata = fs.existsSync(EXISTING_SCHEMA_PATH)
  ? Object.fromEntries(
      Object.entries(readJson<Record<string, Entry>>(EXISTING_SCHEMA_PATH))
        .filter(([, entry]) => entry['x-specialized'])
        .map(([path, entry]) => [path, entry['x-specialized']!]),
    ) as Record<string, SpecializedMetadata>
  : {};

// The source manifests describe config structure, while this separate map
// records Phase 4's source-confirmed editor contracts. Keep it in the builder
// so refreshing live schema sources cannot silently erase those contracts.
const SOURCE_CONFIRMED_SPECIALIZED_METADATA: Record<string, SpecializedMetadata> = {
  brave_search: { path: 'brave_search', editor: 'read-only-unsupported', editable: false, sensitive: true, sourceEvidence: [] },
  'effort.agent_overrides': { path: 'effort.agent_overrides', editor: 'agent-map', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#effort.agent_overrides'] },
  exa_search: { path: 'exa_search', editor: 'read-only-unsupported', editable: false, sensitive: true, sourceEvidence: [] },
  'fast_mode.agent_overrides': { path: 'fast_mode.agent_overrides', editor: 'agent-map', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#fast_mode.agent_overrides'] },
  firecrawl: { path: 'firecrawl', editor: 'read-only-unsupported', editable: false, sensitive: true, sourceEvidence: [] },
  model_overrides: { path: 'model_overrides', editor: 'agent-map', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#model_overrides'] },
  'model_policy.runtime_tiers': { path: 'model_policy.runtime_tiers', editor: 'runtime-tier-map', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#model_policy.runtime_tiers.<runtime>.<tier>'] },
  model_profile: { path: 'model_profile', editor: 'profile-select', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#model_profile'] },
  model_profile_overrides: { path: 'model_profile_overrides', editor: 'runtime-tier-map', editable: true, sensitive: false, sourceEvidence: ['docs/CONFIGURATION.md#model_profile_overrides.<runtime>.<tier>'] },
};
const specializedMetadata = { ...SOURCE_CONFIRMED_SPECIALIZED_METADATA, ...existingSpecializedMetadata };

// The .cjs capability-registry is scoped-`require()`d — acceptable ONLY for
// the locally-installed, trusted gsd-core copy (never remote content); see
// <threat_model> T-01-RCE. It is read purely for its exported `configSchema`
// data object, never executed as a code-generation step.
const capabilityRegistry = require(CAPABILITY_REGISTRY_PATH) as {
  configSchema: Record<string, CapabilitySchemaEntry>;
};

const projectFixture = readJson<Record<string, unknown>>(PROJECT_FIXTURE_PATH);
const globalFixture = readJson<Record<string, unknown>>(GLOBAL_FIXTURE_PATH);
const claudeApiFixture = readJson<Record<string, unknown>>(CLAUDE_API_FIXTURE_PATH);

const runtimeStateKeySet = new Set(manifest.runtimeStateKeys);

// ---------------------------------------------------------------------------
// Helpers: dot-path traversal, type inference, category/title derivation
// ---------------------------------------------------------------------------

function getAtPath(obj: unknown, dotPath: string): unknown {
  const segments = dotPath.split('.');
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    const rec = cursor as Record<string, unknown>;
    if (!(seg in rec)) return undefined;
    cursor = rec[seg];
  }
  return cursor;
}

function firstDefined(...vals: unknown[]): unknown {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

function jsType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string' || t === 'object') return t;
  return 'string';
}

/** Priority order for type inference and default lookup across the reconciled sources. */
function sampleSources(dotPath: string): unknown[] {
  return [
    getAtPath(configDefaults, dotPath),
    getAtPath(projectFixture, dotPath),
    getAtPath(globalFixture, dotPath),
    getAtPath(claudeApiFixture, dotPath),
  ];
}

function inferType(dotPath: string): string | string[] {
  const samples = sampleSources(dotPath);
  const nonNull = samples.filter((s) => s !== undefined && s !== null);
  if (nonNull.length > 0) return jsType(nonNull[0]);
  const anyDefined = samples.some((s) => s !== undefined);
  if (anyDefined) return ['string', 'null']; // only null observed — nullable, best-guess string
  return 'string'; // no data anywhere — safe fallback
}

function inferDefault(dotPath: string): unknown {
  const [cd, pf, gf, cf] = sampleSources(dotPath);
  return firstDefined(cd, pf, gf, cf);
}

function titleCase(segment: string): string {
  return segment
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function deriveTitle(dotPath: string): string {
  const last = dotPath.split('.').pop() ?? dotPath;
  return titleCase(last);
}

function deriveCategory(dotPath: string): string {
  if (dotPath.startsWith('gates.')) return 'Gates';
  if (dotPath.startsWith('safety.')) return 'Safety';
  if (dotPath.startsWith('security.') || dotPath.startsWith('workflow.security_')) return 'Security';
  if (dotPath.startsWith('git.')) return 'Git';
  if (dotPath.startsWith('planning.')) return 'Planning';
  if (dotPath.startsWith('review.') || dotPath.startsWith('plan_review')) return 'Review';
  if (dotPath.startsWith('ship.')) return 'Ship';
  if (dotPath.startsWith('effort.') || dotPath.startsWith('fast_mode.')) return 'Effort';
  if (
    dotPath.startsWith('model_') ||
    dotPath.startsWith('models') ||
    dotPath === 'model_profile' ||
    dotPath.startsWith('dynamic_routing') ||
    dotPath.startsWith('agent_skills') ||
    dotPath.startsWith('resolve_model_ids')
  )
    return 'Model & Routing';
  if (dotPath.startsWith('claude_md')) return 'Discovery';
  if (dotPath.startsWith('workflow.') || dotPath === 'mode' || dotPath === 'granularity')
    return 'Workflow';
  if (
    dotPath.startsWith('hooks.') ||
    dotPath.startsWith('statusline.') ||
    dotPath.startsWith('features.') ||
    dotPath.startsWith('learnings.') ||
    dotPath.startsWith('graphify.') ||
    dotPath.startsWith('intel.') ||
    dotPath.startsWith('code_quality.') ||
    dotPath.startsWith('parallelization') ||
    dotPath.startsWith('capabilities.') ||
    dotPath.startsWith('executor.') ||
    dotPath.startsWith('manager.') ||
    dotPath.startsWith('mempalace.') ||
    dotPath.startsWith('profile-pipeline.')
  )
    return 'Workflow';
  return 'General';
}

// ---------------------------------------------------------------------------
// Build the flat key -> Entry map
// ---------------------------------------------------------------------------

const entries = new Map<string, Entry>();

function addEntry(dotPath: string, entry: Entry): void {
  if (runtimeStateKeySet.has(dotPath)) return; // never include runtime-state keys
  entries.set(dotPath, entry);
}

// Source 1: manifest.validKeys (D-03 primary authority)
for (const key of manifest.validKeys) {
  if (runtimeStateKeySet.has(key)) continue;
  addEntry(key, {
    type: inferType(key),
    default: inferDefault(key),
    title: deriveTitle(key),
    'x-category': deriveCategory(key),
    'x-description': '', // filled by curated-docs.json overlay (Task 2)
    'x-provenance': 'manifest',
  });
}

// Source 3: capability-registry.cjs configSchema (federated, real prose)
for (const [key, cap] of Object.entries(capabilityRegistry.configSchema)) {
  if (runtimeStateKeySet.has(key)) continue;
  const isEnum = cap.type === 'enum';
  const entry: Entry = {
    type: isEnum ? 'string' : cap.type,
    default: cap.default,
    title: deriveTitle(key),
    'x-category': deriveCategory(key),
    'x-description': cap.description ?? '',
    'x-provenance': 'capability-registry',
  };
  if (isEnum && cap.values) entry.enum = cap.values;
  addEntry(key, entry);
}

// Source 2: manifest.dynamicKeyPatterns (D-03 — pool/agent-map shapes)
// Container dot-path is derived from the pattern's own `source` regex (the
// authoritative, unambiguous signal — literal segments up to the first
// regex metacharacter), NOT parsed from the human-readable `description`
// prose (which can contain nested "<...>" placeholders that don't split
// cleanly, e.g. dynamic_routing's alternation).
function deriveContainerPath(source: string): string {
  const stripped = source.replace(/^\^/, '').replace(/\$$/, '');
  const segments = stripped.split('\\.');
  const literal: string[] = [];
  for (const seg of segments) {
    if (/^[A-Za-z0-9_-]+$/.test(seg)) {
      literal.push(seg);
    } else {
      break;
    }
  }
  return literal.join('.');
}

/** Best-effort leaf type for a dynamic pattern's sub-values, based on observed shapes. */
function derivePatternLeafType(containerPath: string): string | string[] {
  const KNOWN: Record<string, string | string[]> = {
    model_overrides: 'string',
    model_profile_overrides: 'string',
    'model_policy.runtime_tiers': 'string',
    'effort.routing_tier_defaults': 'string',
    'effort.agent_overrides': 'string',
    'fast_mode.routing_tier_defaults': 'boolean',
    'fast_mode.agent_overrides': 'boolean',
    'review.max_prompt_tokens_per_reviewer': 'number',
    'review.models': 'string',
    granularities: 'string',
    models: 'string',
    features: 'boolean',
    'claude_md_assembly.blocks': 'string',
    agent_skills: ['object', 'null'],
    dynamic_routing: ['string', 'number', 'boolean', 'null'],
  };
  return KNOWN[containerPath] ?? 'string';
}

for (const pattern of manifest.dynamicKeyPatterns) {
  const containerPath = deriveContainerPath(pattern.source);
  if (!containerPath) continue; // defensive — should never happen for well-formed manifest entries
  const leafType = derivePatternLeafType(containerPath);
  const leafEntry: Entry = {
    type: leafType,
    title: `${deriveTitle(containerPath)} Entry`,
    'x-category': deriveCategory(containerPath),
    'x-description': `See ${containerPath} — ${pattern.description}`,
    'x-provenance': `dynamicKeyPattern:${pattern.topLevel}`,
  };
  addEntry(containerPath, {
    type: ['object', 'null'], // an empty {} or null container must validate (RESEARCH § Critical Finding)
    title: deriveTitle(containerPath),
    'x-category': deriveCategory(containerPath),
    'x-description': '', // filled by curated-docs.json overlay (Task 2)
    'x-provenance': `dynamicKeyPattern:${pattern.topLevel}`,
    'x-dynamic-key-hint': pattern.description,
    patternProperties: { [pattern.source]: leafEntry },
  });
}

// Fixture-observed: gates.* (8) and safety.* (2) — present, consistent, and
// actively consumed at runtime across all three real fixtures, but declared
// in none of the three schema sources (RESEARCH.md § Critical Finding, USER
// DECISION). Modeled from the observed shape (all boolean leaves).
const FIXTURE_OBSERVED_BOOLEAN_KEYS = [
  'gates.confirm_project',
  'gates.confirm_phases',
  'gates.confirm_roadmap',
  'gates.confirm_breakdown',
  'gates.confirm_plan',
  'gates.execute_next_plan',
  'gates.issues_review',
  'gates.confirm_transition',
  'safety.always_confirm_destructive',
  'safety.always_confirm_external_services',
];

for (const key of FIXTURE_OBSERVED_BOOLEAN_KEYS) {
  const observedDefault = inferDefault(key);
  addEntry(key, {
    type: 'boolean',
    default: observedDefault === undefined ? true : observedDefault,
    title: deriveTitle(key),
    'x-category': deriveCategory(key),
    'x-description': '', // filled by curated-docs.json overlay (Task 2)
    'x-provenance': 'fixture-observed',
  });
}

// Fixture-observed: parallelization.* (6 leaves) — this project's own real
// fixture (test/fixtures/project-config.json, and the other two real
// fixtures) expand `parallelization` into a nested object with 6 sub-keys.
// None of the four reconciled sources declare this expanded shape (only the
// bare top-level `parallelization: boolean|object` is documented — see
// planning-config.md § Field Interactions #4). Discovered empirically while
// authoring the Task 3 completeness test (deviation Rule 2 — same treatment
// as gates.*/safety.*: modeled from the observed, consistent real-fixture
// shape and tagged fixture-observed).
const FIXTURE_OBSERVED_TYPED_KEYS: Record<string, string> = {
  'parallelization.enabled': 'boolean',
  'parallelization.plan_level': 'boolean',
  'parallelization.task_level': 'boolean',
  'parallelization.skip_checkpoints': 'boolean',
  'parallelization.max_concurrent_agents': 'number',
  'parallelization.min_plans_for_parallel': 'number',
};

for (const [key, type] of Object.entries(FIXTURE_OBSERVED_TYPED_KEYS)) {
  addEntry(key, {
    type,
    default: inferDefault(key),
    title: deriveTitle(key),
    'x-category': deriveCategory(key),
    'x-description': '', // filled by curated-docs.json overlay (Task 2)
    'x-provenance': 'fixture-observed',
  });
}

// `parallelization` itself accepts both a bare boolean and an object form
// (docs: "loadConfig() normalizes either form to a boolean" — polymorphic).
// The validKeys-derived entry above inferred a plain "boolean" from
// CONFIG_DEFAULTS' sample value; widen it now that the object form's own
// sub-keys are known too.
{
  const existing = entries.get('parallelization');
  if (existing) existing.type = ['boolean', 'object'];
}

// ---------------------------------------------------------------------------
// Merge the curated-docs.json overlay OVER the generated skeleton (curated
// prose wins). Absent on Task 1's first run; present from Task 2 onward.
// ---------------------------------------------------------------------------

if (fs.existsSync(CURATED_DOCS_PATH)) {
  const overlay = readJson<Record<string, Partial<Entry>>>(CURATED_DOCS_PATH);
  for (const [key, overrides] of Object.entries(overlay)) {
    const existing = entries.get(key);
    if (existing) {
      entries.set(key, { ...existing, ...overrides });
    } else {
      // Defensive: curated-docs.json referenced a key outside the
      // reconciled skeleton. Don't silently drop authored prose — add a
      // minimal entry so it still surfaces in the artifact.
      entries.set(key, {
        type: 'string',
        title: deriveTitle(key),
        'x-category': deriveCategory(key),
        'x-description': '',
        'x-provenance': 'curated-docs-only',
        ...overrides,
      } as Entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-generate x-options stubs for every enum-valued entry (D-01: the slot
// is designed now so Phase 3 can fill per-option prose later without a
// structural change). Mechanical — not prose — so it belongs in the script,
// not curated-docs.json.
// ---------------------------------------------------------------------------

for (const entry of entries.values()) {
  if (!entry.enum) continue;
  const options = entry['x-options'] ?? {};
  for (const value of entry.enum) {
    const key = String(value);
    if (!(key in options)) options[key] = { 'x-description': '' };
  }
  entry['x-options'] = options;
}

// Preserve source-confirmed specialized editor metadata already stored in the
// generated artifact. The four source inputs describe ordinary config shape,
// not the Phase 4 editor contract, so regeneration must not erase that
// independently verified metadata when upstream adds unrelated schema keys.
for (const [path, metadata] of Object.entries(specializedMetadata)) {
  const entry = entries.get(path);
  if (entry) entry['x-specialized'] = metadata;
}

// Built-in model profiles are a source-confirmed constrained selector. They
// are not represented as an enum in the general manifest, so retain this
// validated editor contract when regenerating the structural schema.
const modelProfile = entries.get('model_profile');
if (modelProfile) {
  modelProfile.enum = ['quality', 'balanced', 'budget', 'adaptive', 'inherit'];
  modelProfile['x-options'] = Object.fromEntries(
    modelProfile.enum.map((profile) => [profile, { 'x-description': '' }]),
  );
}

// ---------------------------------------------------------------------------
// Emit a deterministic, sorted-key artifact
// ---------------------------------------------------------------------------

const sortedKeys = Array.from(entries.keys()).sort();
const output: Record<string, Entry> = {};
for (const key of sortedKeys) output[key] = entries.get(key)!;

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(
  `build-schema: wrote ${sortedKeys.length} keys to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`,
);
