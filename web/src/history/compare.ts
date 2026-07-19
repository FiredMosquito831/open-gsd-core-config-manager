import { Differ } from 'json-diff-kit';
import { SPECIALIZED_METADATA } from '../schema/specializedMetadata';

export const HISTORY_REDACTION_MARKER = '••••••';
const DISPLAY_REDACTION_MARKER = '[redacted]';

export type HistoryDiffState = 'added' | 'removed' | 'changed' | 'unchanged';

export interface HistoryDiffNode {
  path: string;
  parentPath?: string;
  state: HistoryDiffState;
  before?: unknown;
  current?: unknown;
  children: HistoryDiffNode[];
  collapsed?: boolean;
}

export interface HistoryChangeSummary {
  added: number;
  removed: number;
  changed: number;
  addedPaths: string[];
  removedPaths: string[];
  changedPaths: string[];
}

export interface HistoryComparison {
  nodes: HistoryDiffNode[];
  summary: HistoryChangeSummary;
}

const sensitiveRoots = SPECIALIZED_METADATA
  .filter((descriptor) => descriptor.sensitive)
  .map((descriptor) => descriptor.path.split('.'));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneAndProject(value: unknown, segments: string[] = []): unknown {
  if (sensitiveRoots.some((root) => root.length === segments.length && root.every((part, index) => part === segments[index]))) {
    return HISTORY_REDACTION_MARKER;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneAndProject(item, segments));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAndProject(item, [...segments, key])]));
  }
  return value;
}

/** Creates a deep presentation copy that masks catalog-defined sensitive roots. */
export function projectHistoryDocument(document: object): object {
  return cloneAndProject(document) as object;
}

function joinPath(parent: string, key: string, arrayItem: boolean): string {
  if (arrayItem) return `${parent}[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function displayValue(value: unknown): unknown {
  return value === HISTORY_REDACTION_MARKER ? DISPLAY_REDACTION_MARKER : value;
}

function sameValue(before: unknown, current: unknown): boolean {
  return JSON.stringify(before) === JSON.stringify(current);
}

function buildNodes(before: unknown, current: unknown, path = '', parentPath?: string): HistoryDiffNode[] {
  if (before === undefined && current !== undefined) {
    return [{ path, parentPath, state: 'added', current: displayValue(current), children: [] }];
  }
  if (current === undefined && before !== undefined) {
    return [{ path, parentPath, state: 'removed', before: displayValue(before), children: [] }];
  }
  if (sameValue(before, current)) {
    return [{ path, parentPath, state: 'unchanged', before: displayValue(before), current: displayValue(current), children: [], collapsed: true }];
  }
  if (Array.isArray(before) && Array.isArray(current)) {
    const children: HistoryDiffNode[] = [];
    const maximum = Math.max(before.length, current.length);
    for (let index = 0; index < maximum; index += 1) {
      children.push(...buildNodes(before[index], current[index], joinPath(path, String(index), true), path));
    }
    return [{ path, parentPath, state: children.some((node) => node.state !== 'unchanged') ? 'changed' : 'unchanged', children }];
  }
  if (isRecord(before) && isRecord(current)) {
    const children: HistoryDiffNode[] = [];
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(current)])].sort()) {
      children.push(...buildNodes(before[key], current[key], joinPath(path, key, false), path));
    }
    return [{ path, parentPath, state: children.some((node) => node.state !== 'unchanged') ? 'changed' : 'unchanged', children }];
  }
  return [{ path, parentPath, state: 'changed', before: displayValue(before), current: displayValue(current), children: [] }];
}

function leafNodes(nodes: HistoryDiffNode[]): HistoryDiffNode[] {
  return nodes.flatMap((node) => node.children.length > 0 ? leafNodes(node.children) : [node]);
}

/**
 * Produces a memoizable Snapshot → Current comparison. Differ remains the structural
 * comparison authority; the project-owned tree adapts its orientation for the UI.
 */
export function buildHistoryComparison(snapshot: object, current: object): HistoryComparison {
  const before = projectHistoryDocument(snapshot);
  const after = projectHistoryDocument(current);
  new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff(before, after);

  const nodes = buildNodes(before, after);
  const leaves = leafNodes(nodes).filter((node) => node.state !== 'unchanged');
  const paths = (state: HistoryDiffState) => leaves.filter((node) => node.state === state).map((node) => node.path).sort();

  return {
    nodes,
    summary: {
      added: paths('added').length,
      removed: paths('removed').length,
      changed: paths('changed').length,
      addedPaths: paths('added'),
      removedPaths: paths('removed'),
      changedPaths: paths('changed'),
    },
  };
}
