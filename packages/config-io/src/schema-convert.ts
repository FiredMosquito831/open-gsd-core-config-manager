/**
 * Flat-dot-path-schema -> nested-Ajv-schema converter.
 *
 * `packages/schema-data/bundled-schema.json` (Plan 02) is a FLAT, dot-path-keyed
 * metadata catalog (`Record<string, SchemaEntry>` — e.g. the key
 * `"workflow.tdd_mode"` maps directly to a `SchemaEntry`). It is intentionally
 * shaped this way for known-key classification and canonical-defaults lookup
 * (known-keys.ts, load.ts — see 01-02-SUMMARY.md's "Flat dot-path-keyed schema
 * artifact (not a nested JSON-Schema tree)" pattern note) and its top-level
 * keys are NOT JSON Schema keywords — passing it directly to
 * `createValidator()`/`ajv.compile()` fails immediately under Ajv's strict
 * mode ("unknown keyword: <dot-path>").
 *
 * `buildAjvSchema()` bridges the two shapes: every dot-path becomes a nested
 * `properties` chain, and every dynamic-map container's own FULL-dot-path
 * `patternProperties` regex (e.g. `^model_overrides\.[a-zA-Z0-9_-]+$`, written
 * relative to the flat map) is relativized to the LOCAL key-name pattern Ajv
 * actually evaluates once that regex lives inside a nested object
 * (`^[a-zA-Z0-9_-]+$`).
 *
 * `additionalProperties` is never set (at any depth, anywhere in the
 * generated tree) — matching validate.ts's Pitfall 5 guarantee: a config
 * carrying an unknown/future key must always validate so newer-gsd-core keys
 * never block a save. Omitting the keyword (rather than declaring it `true`)
 * is JSON Schema's own default-open behavior.
 *
 * Deviation (Rule 2 — missing critical functionality, auto-fixed in Plan 07):
 * without this converter, `createValidator(bundledSchema)` — the exact call
 * 01-07-PLAN.md's Task 2 instructs and Phase 2's server is expected to make
 * verbatim against the frozen index.ts barrel — cannot compile at all. This
 * is exported from index.ts alongside `createValidator` for that reason.
 */
import type { SchemaEntry } from './types.js';

interface AjvSchemaNode {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, AjvSchemaNode>;
  patternProperties?: Record<string, AjvSchemaNode>;
}

/**
 * Strips the container's own escaped dot-path prefix (`^<dotPath-escaped>\.`)
 * from a flat-map patternProperties regex source, leaving the LOCAL pattern
 * Ajv should match against a single nested key name. Falls back to the
 * original (unmodified) pattern source if it doesn't match the expected
 * `^<container-dot-path>\.<local-pattern>$` shape — defensive, so a single
 * unexpected future schema entry cannot crash the whole validator at compile
 * time; Ajv will still compile the fallback pattern, just potentially
 * matching a different (likely empty) key set.
 */
function relativizePattern(containerDotPath: string, patternSource: string): string {
  const escapedDotPath = containerDotPath.replace(/\./g, '\\.');
  const prefix = `^${escapedDotPath}\\.`;
  if (!patternSource.startsWith(prefix)) {
    return patternSource;
  }
  return `^${patternSource.slice(prefix.length)}`;
}

/**
 * Converts one flat `SchemaEntry` (and, recursively, its `patternProperties`
 * sub-entries) into an Ajv-compilable leaf/container node. `ownDotPath` is
 * the entry's own flat-map key — the reference point `relativizePattern`
 * strips from that entry's `patternProperties` regex sources.
 */
function toAjvNode(entry: SchemaEntry, ownDotPath: string): AjvSchemaNode {
  const node: AjvSchemaNode = { type: entry.type };
  if (entry.enum) {
    node.enum = entry.enum;
  }
  if (entry.patternProperties) {
    node.patternProperties = {};
    for (const [patternSource, subEntry] of Object.entries(entry.patternProperties)) {
      const relativePattern = relativizePattern(ownDotPath, patternSource);
      node.patternProperties[relativePattern] = toAjvNode(subEntry, ownDotPath);
    }
  }
  return node;
}

/**
 * Builds a nested, Ajv-2020-12-compilable JSON Schema object from the flat
 * `bundled-schema.json` map. Pure — no file I/O, no schema-artifact opinions
 * (the caller supplies the parsed flat schema, matching load.ts/known-keys.ts's
 * existing pattern of accepting a schema object rather than a path).
 */
export function buildAjvSchema(flatSchema: Record<string, SchemaEntry>): object {
  const root: AjvSchemaNode = { type: 'object', properties: {} };

  for (const [dotPath, entry] of Object.entries(flatSchema)) {
    const segments = dotPath.split('.');
    let cursor: AjvSchemaNode = root;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!cursor.properties) cursor.properties = {};
      if (!cursor.properties[seg]) {
        cursor.properties[seg] = { type: 'object', properties: {} };
      }
      cursor = cursor.properties[seg];
    }

    const leafKey = segments[segments.length - 1];
    if (!cursor.properties) cursor.properties = {};
    cursor.properties[leafKey] = toAjvNode(entry, dotPath);
  }

  return root;
}
