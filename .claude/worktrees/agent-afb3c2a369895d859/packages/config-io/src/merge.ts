/**
 * Layered effective-value merge with provenance (SAVE-03 provenance,
 * success criterion #5).
 *
 * Pure, schema-agnostic functions — merge.ts imports no schema data. The
 * caller (Plan 05's `load()`) supplies `canonical` (schema defaults) and
 * the `knownKeyPaths` list; this keeps merge testable with inline layer
 * objects (01-RESEARCH.md § Code Examples: Layered Merge).
 *
 * Precedence order is fixed: project > global > canonical.
 */
import type { EffectiveLeaf, EffectiveNode, Provenance } from './types.js';

/** The three raw layers a leaf/tree resolution walks, in precedence order. */
export interface MergeLayers {
  project: unknown;
  global: unknown;
  canonical: unknown;
}

/**
 * Walks `dotPath`'s segments inside `obj`. Returns `found: false` if any
 * segment is absent (a present-but-`undefined` value only counts as found
 * if the key actually exists via `in`).
 */
export function getAtPath(obj: unknown, dotPath: string): { found: boolean; value: unknown } {
  const segments = dotPath.split('.');
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object' || !(seg in (cursor as Record<string, unknown>))) {
      return { found: false, value: undefined };
    }
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return { found: true, value: cursor };
}

/**
 * Resolves `path` to the highest-priority layer that defines it
 * (project > global > canonical), tagging the result's `from` with the
 * supplying layer. Throws a descriptive error if no layer supplies the
 * path — this signals a schema-default gap upstream.
 */
export function resolveLeaf(path: string, layers: MergeLayers): EffectiveLeaf {
  for (const from of ['project', 'global', 'canonical'] as const) {
    const { found, value } = getAtPath(layers[from], path);
    if (found) return { path, value, from: from as Provenance };
  }
  throw new Error(`No layer supplies a value for "${path}" — schema default is missing`);
}

/**
 * Resolves every path in `knownKeyPaths` via `resolveLeaf` and assembles
 * the results into a nested `EffectiveNode` tree, splitting each dot-path
 * into intermediate object nodes with the resolved `EffectiveLeaf` placed
 * at the final segment.
 */
export function buildEffectiveTree(
  knownKeyPaths: string[],
  layers: MergeLayers
): Record<string, EffectiveNode> {
  const tree: Record<string, EffectiveNode> = {};

  for (const keyPath of knownKeyPaths) {
    const leaf = resolveLeaf(keyPath, layers);
    const segments = keyPath.split('.');
    let cursor: Record<string, EffectiveNode> = tree;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (cursor[seg] === undefined) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Record<string, EffectiveNode>;
    }

    cursor[segments[segments.length - 1]] = leaf;
  }

  return tree;
}
