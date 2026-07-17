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

export function provenanceLabel(from: Provenance): string {
  return {
    canonical: 'Canonical default',
    global: 'Global default',
    project: 'Project override',
  }[from];
}
