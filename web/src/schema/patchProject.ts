import type { LoadResult } from '../../../packages/config-io/src/types';

export const FORBIDDEN_SEGMENTS: Set<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function checkSegments(segments: string[]): void {
  for (const seg of segments) {
    if (FORBIDDEN_SEGMENTS.has(seg)) {
      throw new Error(`Refusing to patch unsafe path segment: ${seg}`);
    }
  }
}

export function setDotPath(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const segments = dotPath.split('.');
  checkSegments(segments);
  let cursor: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }

  const last = segments[segments.length - 1];
  cursor[last] = value;
}

export function deleteDotPath(obj: Record<string, unknown>, dotPath: string): void {
  const segments = dotPath.split('.');
  checkSegments(segments);
  const flatKey = dotPath;
  if (Object.prototype.hasOwnProperty.call(obj, flatKey)) {
    delete obj[flatKey];
    return;
  }
  let cursor: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) return;
    cursor = cursor[seg] as Record<string, unknown>;
  }

  delete cursor[segments[segments.length - 1]];
}

export interface ProjectChange {
  path: string;
  value: unknown;
}

export function buildProjectSaveCandidate(
  loadResult: LoadResult,
  changes: ProjectChange[],
  resets: string[],
): Record<string, unknown> {
  const candidate = structuredClone(loadResult.raw.project) as Record<string, unknown>;

  for (const change of changes) {
    setDotPath(candidate, change.path, change.value);
  }

  for (const reset of resets) {
    deleteDotPath(candidate, reset);
  }

  return candidate;
}
