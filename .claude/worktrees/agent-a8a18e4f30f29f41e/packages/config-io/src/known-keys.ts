/**
 * Known-key classification + canonical defaults extraction from the bundled
 * schema (SAVE-03 foundation, DISC-06 composition target for load.ts).
 *
 * Pure functions over a caller-supplied `schema` object (the parsed
 * `packages/schema-data/bundled-schema.json` content, or an equivalent
 * fixture in tests) — this module does no file I/O itself, matching the
 * discovery.ts/merge.ts pattern established in Plan 04.
 *
 * Source: 01-RESEARCH.md § Decision: Effective-Value / Provenance Contract
 * (point 3: flatten every leaf and classify against the reconciled
 * known-key set) and § Critical Finding (dynamic-pattern matching for
 * `model_overrides.<agent>` etc., sourced from the schema's own
 * `patternProperties`, never re-authored here).
 */
import type { SchemaEntry } from './types.js';

/**
 * A compiled view of the bundled schema for O(1)-ish key classification:
 *  - `exactKeys`: every flat dot-path the schema declares directly
 *    (including bare dynamic-map container keys, e.g. `model_overrides`).
 *  - `patterns`: every dynamic-map `patternProperties` regex source,
 *    compiled once, reused for every classification call.
 *  - `prefixes`: every proper dot-path prefix of every exact key (e.g.
 *    `workflow.tdd_mode` contributes the prefix `workflow`). Used by
 *    load.ts's unknown-key walk to decide whether an unrecognized
 *    intermediate node (like `workflow`, which is never itself an exact
 *    schema key — only its children are) still needs to be descended into
 *    because *some* of its children are known.
 */
export interface KnownKeySet {
  exactKeys: Set<string>;
  patterns: RegExp[];
  prefixes: Set<string>;
}

/**
 * Builds a `KnownKeySet` from the bundled schema's flat dot-path map.
 * Reuses each dynamic-map entry's own `patternProperties` regex source
 * verbatim — never authors new patterns (01-RESEARCH.md § Critical
 * Finding).
 */
export function buildKnownKeySet(schema: Record<string, SchemaEntry>): KnownKeySet {
  const exactKeys = new Set(Object.keys(schema));
  const patterns: RegExp[] = [];
  const prefixes = new Set<string>();

  for (const [dotPath, entry] of Object.entries(schema)) {
    const segments = dotPath.split('.');
    for (let i = 1; i < segments.length; i++) {
      prefixes.add(segments.slice(0, i).join('.'));
    }

    if (entry.patternProperties) {
      for (const patternSource of Object.keys(entry.patternProperties)) {
        patterns.push(new RegExp(patternSource));
      }
    }
  }

  return { exactKeys, patterns, prefixes };
}

/**
 * True if `dotPath` is a known schema key: an exact declared key (which
 * covers bare dynamic-map containers like `model_overrides` with no
 * sub-key, since the container itself is a declared entry) OR a match
 * against any dynamic-map `patternProperties` regex (e.g.
 * `model_overrides.gsd-planner` matching `model_overrides.<agent-id>`).
 */
export function isKnownKey(dotPath: string, knownSet: KnownKeySet): boolean {
  if (knownSet.exactKeys.has(dotPath)) return true;
  return knownSet.patterns.some((re) => re.test(dotPath));
}

/**
 * Produces the canonical-layer object: every schema key that declares a
 * `default`, expanded into a nested object by dot-path (so merge.ts's
 * `getAtPath`/`resolveLeaf` can read it as the lowest-priority layer).
 * Keys with no declared `default` are simply absent here — load.ts is
 * responsible for deciding how to handle a known key with no default and
 * no value in any raw layer.
 */
export function canonicalDefaultsFromSchema(schema: Record<string, SchemaEntry>): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};

  for (const [dotPath, entry] of Object.entries(schema)) {
    if (!('default' in entry) || entry.default === undefined) continue;

    const segments = dotPath.split('.');
    let cursor: Record<string, unknown> = canonical;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = entry.default;
  }

  return canonical;
}
