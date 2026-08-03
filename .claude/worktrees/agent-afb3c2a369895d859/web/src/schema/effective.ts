import type { EffectiveNode, EffectiveLeaf, Provenance } from '../../../packages/config-io/src/types';

export function getEffectiveLeaf(
  effective: Record<string, EffectiveNode>,
  dotPath: string,
): EffectiveLeaf | null {
  const segments = dotPath.split('.');
  let cursor: EffectiveNode | undefined = effective;

  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return null;
    }
    if (segment in cursor) {
      cursor = (cursor as Record<string, EffectiveNode>)[segment];
    } else {
      return null;
    }
  }

  if (
    cursor !== null &&
    typeof cursor === 'object' &&
    !Array.isArray(cursor) &&
    'from' in cursor
  ) {
    return cursor as EffectiveLeaf;
  }
  return null;
}

export interface LayeredValue {
  project: unknown;
  global: unknown;
  effective: unknown;
}

function readDotPath(value: unknown, dotPath: string): unknown {
  let cursor = value;
  for (const segment of dotPath.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || !(segment in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function getLayeredValue(loadResult: { raw: { project: Record<string, unknown>; global: Record<string, unknown> | null }; effective: Record<string, EffectiveNode> }, dotPath: string): LayeredValue {
  return {
    project: readDotPath(loadResult.raw.project, dotPath),
    global: readDotPath(loadResult.raw.global, dotPath),
    effective: getEffectiveLeaf(loadResult.effective, dotPath)?.value,
  };
}

export function buildSpecializedProjectDraft(
  loadResult: { raw: { project: Record<string, unknown> } },
  paths: string[],
): Record<string, unknown> {
  const draft: Record<string, unknown> = {};
  for (const path of paths) {
    const value = readDotPath(loadResult.raw.project, path);
    if (value !== undefined) draft[path] = structuredClone(value);
  }
  return draft;
}

export function materializeInheritedValue(
  loadResult: { raw: { project: Record<string, unknown> } },
  path: string,
  value: unknown,
): void {
  const segments = path.split('.');
  let cursor = loadResult.raw.project;
  for (const segment of segments.slice(0, -1)) {
    if (cursor[segment] === null || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = structuredClone(value);
}

export function provenanceLabel(from: Provenance): string {
  return {
    canonical: 'Canonical default',
    global: 'Global default',
    project: 'Project override',
  }[from];
}
