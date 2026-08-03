/**
 * load() — the read side of the data layer (DISC-06 + SAVE-03).
 *
 * Reads the raw project config, locates + reads the global defaults layer
 * (DISC-06), computes the layered effective-value tree with provenance
 * (project > global > canonical), and produces the flat unknown-key bucket
 * (SAVE-03) — returning the frozen `LoadResult` contract (types.ts).
 *
 * Composes Plan 04's discovery.ts/merge.ts with Plan 02's bundled schema
 * (via known-keys.ts) — see 01-RESEARCH.md § Architecture Patterns → System
 * Architecture Diagram for the data-flow this function assembles.
 *
 * Never logs the whole raw config on error (Information Disclosure guard,
 * threat T-01-InfoDisc-L) — only static messages + file paths.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlobalDefaults, resolveGlobalDefaultsPath } from './discovery.js';
import { buildEffectiveTree, getAtPath } from './merge.js';
import { buildKnownKeySet, canonicalDefaultsFromSchema, isKnownKey } from './known-keys.js';
import { safeSet } from './patch.js';
import type { KnownKeySet } from './known-keys.js';
import type { LoadResult, SchemaEntry, UnknownKeyEntry } from './types.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
/** packages/config-io/src -> packages/schema-data/bundled-schema.json */
const DEFAULT_SCHEMA_PATH = path.resolve(MODULE_DIR, '..', '..', 'schema-data', 'bundled-schema.json');

export interface LoadOptions {
  /** Override the bundled schema (defaults to packages/schema-data/bundled-schema.json). Test seam. */
  schema?: Record<string, SchemaEntry>;
  /** Override process.env for global-defaults discovery. Test seam (see discovery.ts). */
  env?: NodeJS.ProcessEnv;
}

function readAndParseJson(absPath: string, kind: string): Record<string, unknown> {
  const raw = fs.readFileSync(absPath, 'utf8');
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Information Disclosure guard (T-01-InfoDisc-L): path only, never file contents.
    throw new Error(`Failed to parse ${kind} JSON at path: ${absPath}`);
  }
}

function loadSchema(schemaPath: string): Record<string, SchemaEntry> {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw) as Record<string, SchemaEntry>;
}

/**
 * Recursively collects unknown leaf paths from a raw config layer.
 *
 * Descent rule: a node whose own dot-path is already known (exact key or
 * dynamic-pattern match) is skipped entirely — the schema has declared
 * that whole subtree, so nothing under it needs individual classification
 * (this also correctly handles dynamic-map containers like
 * `model_overrides`, whose arbitrary children are known by construction).
 *
 * A node that is NOT known but has at least one known descendant path
 * (e.g. `workflow` itself is never an exact schema key — only
 * `workflow.tdd_mode` etc. are) is still descended into, so sibling
 * unknown leaves like `workflow.x_test_unknown_toggle` are still caught
 * individually rather than the whole `workflow` object being flagged.
 *
 * A node that is NOT known AND has no known descendants at all (e.g. a
 * fabricated top-level namespace like `x_gsdcm_test_future_key`) is
 * captured as ONE unknown entry carrying its entire value — SAVE-03's
 * "surface, don't drop" guarantee does not require decomposing an
 * entirely foreign subtree into synthetic per-leaf entries.
 */
function collectUnknownPaths(
  obj: Record<string, unknown>,
  knownSet: KnownKeySet,
  prefix: string,
): Array<{ path: string; value: unknown }> {
  const out: Array<{ path: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (isKnownKey(dotPath, knownSet)) continue;

    const isPlainNonEmptyObject =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0;

    if (isPlainNonEmptyObject && knownSet.prefixes.has(dotPath)) {
      out.push(...collectUnknownPaths(value as Record<string, unknown>, knownSet, dotPath));
    } else {
      out.push({ path: dotPath, value });
    }
  }

  return out;
}

/**
 * Fills any known schema key that declares no `default` (and therefore is
 * absent from `canonicalDefaultsFromSchema`'s output) with a `null`
 * fallback, IN PLACE on a fresh copy — never mutating the caller's
 * canonical object.
 *
 * Deviation (Rule 2 — missing critical functionality, auto-fixed): 25 of
 * the 158 bundled-schema.json keys declare no `default` (mostly
 * dynamic-map containers and rarely-set optional overrides — see
 * 01-05-SUMMARY.md). At least 14 of those are absent from EVERY real
 * fixture (project + both global-defaults fixtures) too. Without this
 * fallback, merge.ts's `resolveLeaf` (frozen Plan 04 contract) throws "No
 * layer supplies a value" for any such key — meaning `load()` would crash
 * on realistic, real-world configs that simply never set an obscure
 * optional key. A `null` sentinel keeps every known key resolvable while
 * leaving `canonicalDefaultsFromSchema`'s own contract (Task 1: maps only
 * keys that declare a schema `default`) unchanged.
 */
function fillMissingCanonicalDefaults(
  canonical: Record<string, unknown>,
  schema: Record<string, SchemaEntry>,
): Record<string, unknown> {
  const filled: Record<string, unknown> = JSON.parse(JSON.stringify(canonical));
  for (const dotPath of Object.keys(schema)) {
    if (!getAtPath(filled, dotPath).found) {
      safeSet(filled, dotPath, null);
    }
  }
  return filled;
}

/**
 * Reads `projectConfigPath`, locates + reads the global defaults layer
 * (DISC-06), and assembles the frozen `LoadResult`: unmodified raw
 * project object, provenance-tagged effective tree, and a flat
 * unknown-key bucket (SAVE-03).
 */
export async function load(projectConfigPath: string, opts: LoadOptions = {}): Promise<LoadResult> {
  // (1) Read the ORIGINAL project object — never cloned/normalized. The
  // SAVE-03 patch-in-place invariant depends on this exact reference
  // being returned unmutated (types.ts LoadResult doc comment).
  const project = readAndParseJson(projectConfigPath, 'project config');

  // (2) Global defaults layer via discovery (DISC-06).
  const env = opts.env ?? process.env;
  const globalDefaultsPath = resolveGlobalDefaultsPath(env);
  const { found: globalDefaultsFound, data: global } = readGlobalDefaults(globalDefaultsPath);

  // (3) Bundled schema -> known-key set + canonical defaults.
  const schema = opts.schema ?? loadSchema(DEFAULT_SCHEMA_PATH);
  const knownSet = buildKnownKeySet(schema);
  const canonical = fillMissingCanonicalDefaults(canonicalDefaultsFromSchema(schema), schema);
  const knownKeyPaths = Object.keys(schema);

  // (4) Layered effective tree (project > global > canonical), provenance-tagged.
  const effective = buildEffectiveTree(knownKeyPaths, {
    project,
    global: global ?? {},
    canonical,
  });

  // (5) Flat unknown[] bucket — every leaf path in project + global that is
  // NOT a known key, merging presentIn across layers for the same path.
  const unknownMap = new Map<string, UnknownKeyEntry>();

  for (const { path: dotPath, value } of collectUnknownPaths(project, knownSet, '')) {
    unknownMap.set(dotPath, { path: dotPath, value, presentIn: ['project'] });
  }

  if (global) {
    for (const { path: dotPath, value } of collectUnknownPaths(global, knownSet, '')) {
      const existing = unknownMap.get(dotPath);
      if (existing) {
        if (!existing.presentIn.includes('global')) existing.presentIn.push('global');
      } else {
        unknownMap.set(dotPath, { path: dotPath, value, presentIn: ['global'] });
      }
    }
  }

  return {
    raw: { project, global },
    effective,
    unknown: Array.from(unknownMap.values()),
    meta: { globalDefaultsPath, globalDefaultsFound },
  };
}
