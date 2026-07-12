/**
 * Completeness test — zero missing keys after 4-source reconciliation
 * (SCHEMA-01 / success criterion #2).
 *
 * Part A (D-03 primary-authority coverage): every key declared by the
 * manifest (`validKeys`), the capability-registry (`configSchema`), the
 * config-defaults (`CONFIG_DEFAULTS`, flattened) — plus the fixture-observed
 * `gates.*`/`safety.*` leaves — must be present in `bundled-schema.json`,
 * either as an exact key or matched by a dynamic-map `patternProperties`
 * pattern. Zero missing.
 *
 * Part B (zero missing keys in real fixtures): every leaf dot-path in the
 * three real fixtures must classify as known against the bundled schema
 * (exact key, dynamic pattern, or the explicit allowlist below). Any
 * fixture leaf outside that allowlist that is unknown is a hard FAIL — a
 * real, undocumented gap in the bundled schema.
 *
 * This is the permanent, checked-in version of the flatten-and-diff script
 * prototyped in 01-RESEARCH.md § Critical Finding.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const GSD_HOME = process.env.GSD_HOME || os.homedir();
const GSD_CORE_BIN = path.join(GSD_HOME, '.claude', 'gsd-core', 'bin');
const MANIFEST_PATH = path.join(GSD_CORE_BIN, 'shared', 'config-schema.manifest.json');
const DEFAULTS_PATH = path.join(GSD_CORE_BIN, 'shared', 'config-defaults.manifest.json');
const CAPABILITY_REGISTRY_PATH = path.join(GSD_CORE_BIN, 'lib', 'capability-registry.cjs');

const BUNDLED_SCHEMA_PATH = path.join(REPO_ROOT, 'packages', 'schema-data', 'bundled-schema.json');

interface Manifest {
  validKeys: string[];
  runtimeStateKeys: string[];
  dynamicKeyPatterns: Array<{ topLevel: string; source: string; description: string }>;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const capabilityRegistry = require(CAPABILITY_REGISTRY_PATH) as {
  configSchema: Record<string, unknown>;
};

const manifest = readJson<Manifest>(MANIFEST_PATH);
const configDefaults = readJson<Record<string, unknown>>(DEFAULTS_PATH);
const bundledSchema = readJson<Record<string, { patternProperties?: Record<string, unknown> }>>(
  BUNDLED_SCHEMA_PATH,
);

/**
 * Fixture-observed gates.* / safety.* leaves — present, consistent, and
 * actively consumed at runtime across all three real fixtures, but declared
 * in none of the three schema sources (RESEARCH.md Critical Finding, USER
 * DECISION). Part of Part A's required-known set.
 */
const FIXTURE_OBSERVED_KEYS = [
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

/**
 * Keys intentionally excluded from Part A's required-known set —
 * documented, resolved exceptions, not gaps:
 *   - `workflow._auto_chain_active`: internal runtime state (runtimeStateKeys),
 *     never a user-configurable key (RESEARCH.md, Task 1 acceptance).
 *   - `planning.granularity`: present in CONFIG_DEFAULTS as a nested default
 *     but absent from validKeys and unused by any real fixture — vestigial.
 *     RESEARCH.md Open Question 2 resolved to omit it from known-keys; the
 *     open-additionalProperties design still surfaces it via unknown[] if a
 *     future gsd-core version ever writes it.
 *   - `_comment`: a documentation-only JSON string convention used by both
 *     manifest files (see config-schema.manifest.json's own `_comment`
 *     field) — a JSON key holding prose, never a real config key.
 */
const PART_A_EXCLUDED_KEYS = new Set([
  'workflow._auto_chain_active',
  'planning.granularity',
  '_comment',
]);

function flattenLeaves(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) {
      out.push(...flattenLeaves(v as Record<string, unknown>, p));
    } else {
      out.push(p);
    }
  }
  return out;
}

const bundledSchemaKeys = new Set(Object.keys(bundledSchema));
const patternRegexes: RegExp[] = [];
for (const entry of Object.values(bundledSchema)) {
  if (entry.patternProperties) {
    for (const pattern of Object.keys(entry.patternProperties)) {
      patternRegexes.push(new RegExp(pattern));
    }
  }
}

function isKnown(dotPath: string): boolean {
  if (bundledSchemaKeys.has(dotPath)) return true;
  return patternRegexes.some((re) => re.test(dotPath));
}

describe('SCHEMA-01: bundled schema completeness (zero missing keys)', () => {
  it('Part A: every manifest validKeys entry is known to the bundled schema', () => {
    const missing = manifest.validKeys.filter(
      (k) => !PART_A_EXCLUDED_KEYS.has(k) && !isKnown(k),
    );
    expect(missing, `missing manifest validKeys: ${missing.join(', ')}`).toEqual([]);
  });

  it('Part A: every capability-registry configSchema key is known to the bundled schema', () => {
    const capKeys = Object.keys(capabilityRegistry.configSchema);
    const missing = capKeys.filter((k) => !PART_A_EXCLUDED_KEYS.has(k) && !isKnown(k));
    expect(missing, `missing capability-registry keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('Part A: every config-defaults CONFIG_DEFAULTS leaf is known to the bundled schema', () => {
    const defaultLeaves = flattenLeaves(configDefaults);
    const missing = defaultLeaves.filter((k) => !PART_A_EXCLUDED_KEYS.has(k) && !isKnown(k));
    expect(missing, `missing config-defaults leaves: ${missing.join(', ')}`).toEqual([]);
  });

  it('Part A: every fixture-observed gates.*/safety.* leaf is known to the bundled schema', () => {
    const missing = FIXTURE_OBSERVED_KEYS.filter((k) => !isKnown(k));
    expect(missing, `missing fixture-observed keys: ${missing.join(', ')}`).toEqual([]);
    // And explicitly tagged as such — not conflated with an authoritative source.
    for (const k of FIXTURE_OBSERVED_KEYS) {
      expect(bundledSchema[k]?.['x-provenance' as never]).toBe('fixture-observed');
    }
  });

  /**
   * Part B allowlist: the ONLY fixture leaves permitted to remain unknown.
   * NOT a blanket "ignore all unknowns" — every entry here is a bare
   * dynamic-map CONTAINER path (declared by build-schema.ts as a
   * dynamicKeyPattern container with `patternProperties`, but the manifest
   * itself only recognizes the pattern-matched children, never the bare
   * container — RESEARCH.md § Critical Finding). In practice these
   * classify as KNOWN via the container's own exact-key entry in
   * bundled-schema.json, so this allowlist is a documented safety net, not
   * load-bearing today.
   *
   * `workflow._auto_chain_active` is listed separately (not a container —
   * internal runtime state, intentionally excluded from the schema so it
   * surfaces via the unknown[] bucket at runtime per the SAVE-03 design).
   *
   * gates.* and safety.* are explicitly NOT here — they are KNOWN
   * (fixture-observed), not allowed drift.
   */
  const BARE_DYNAMIC_CONTAINER_ALLOWLIST = new Set([
    'model_overrides',
    'dynamic_routing',
    'model_profile_overrides',
    'granularities',
    'model_policy.runtime_tiers',
    'agent_skills',
    'review.models',
  ]);
  const RUNTIME_STATE_ALLOWLIST = new Set(['workflow._auto_chain_active']);

  const fixtureFiles = [
    'project-config.json',
    'global-defaults.json',
    'global-defaults-claude-api.json',
  ];

  it.each(fixtureFiles)(
    'Part B: %s has zero unknown leaves outside the documented allowlist',
    (fixtureFile) => {
      const data = readJson<Record<string, unknown>>(
        path.join(REPO_ROOT, 'test', 'fixtures', fixtureFile),
      );
      const leaves = flattenLeaves(data);
      expect(leaves.length).toBeGreaterThan(0); // sanity: fixture actually has leaves

      const unknowns = leaves.filter((l) => !isKnown(l));
      const undocumented = unknowns.filter(
        (l) => !BARE_DYNAMIC_CONTAINER_ALLOWLIST.has(l) && !RUNTIME_STATE_ALLOWLIST.has(l),
      );

      expect(
        undocumented,
        `undocumented unknown leaves in ${fixtureFile} (real schema gap): ${undocumented.join(', ')}`,
      ).toEqual([]);

      // gates.*/safety.* must never appear in the unknown set for a fixture
      // that declares them (they are KNOWN, fixture-observed — not allowed
      // drift).
      const leakedGatesOrSafety = unknowns.filter(
        (l) => l.startsWith('gates.') || l.startsWith('safety.'),
      );
      expect(leakedGatesOrSafety).toEqual([]);
    },
  );
});
