import { Differ, type DiffResult } from 'json-diff-kit';
import { SPECIALIZED_METADATA } from '../schema/specializedMetadata';

export const HISTORY_REDACTION_MARKER = '••••••';
const DISPLAY_REDACTION_MARKER = '[redacted]';
const COMPARISON_UNAVAILABLE = 'History comparison unavailable';

type DiffSide = 'before' | 'current';

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

interface ParsedLeaf {
  cursor: number;
  path: string;
  parentPath: string;
  type: DiffResult['type'];
  value: unknown;
}

interface ParsedContainer {
  path: string;
  parentPath: string;
}

interface ContainerContext extends ParsedContainer {
  kind: 'object' | 'array';
  level: number;
  nextIndex: number;
}

const sensitiveRoots = SPECIALIZED_METADATA
  .filter((descriptor) => descriptor.sensitive)
  .map((descriptor) => descriptor.path.split('.'));

function unavailable(): never {
  throw new Error(COMPARISON_UNAVAILABLE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneAndProject(value: unknown, segments: string[] = []): unknown {
  if (sensitiveRoots.some((root) => root.length === segments.length && root.every((part, index) => part === segments[index]))) {
    return HISTORY_REDACTION_MARKER;
  }
  if (Array.isArray(value)) return value.map((item) => cloneAndProject(item, segments));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAndProject(item, [...segments, key])]));
  return value;
}

/** Creates a deep presentation copy that masks catalog-defined sensitive roots. */
export function projectHistoryDocument(document: object): object {
  return cloneAndProject(document) as object;
}

function joinPath(parent: string, key: string, arrayItem: boolean): string {
  return arrayItem ? `${parent}[${key}]` : parent ? `${parent}.${key}` : key;
}

function displayValue(value: unknown): unknown {
  return value === HISTORY_REDACTION_MARKER ? DISPLAY_REDACTION_MARKER : value;
}

function validRow(row: unknown): row is DiffResult {
  if (!isRecord(row)) return false;
  const level = row.level;
  if (typeof level !== 'number' || !Number.isFinite(level) || !Number.isInteger(level) || level < 0 || typeof row.text !== 'string') return false;
  return row.type === 'equal' || row.type === 'modify' || row.type === 'add' || row.type === 'remove';
}

function parseMember(text: string): { key?: string; valueText: string } {
  const match = /^(?:"((?:\\.|[^"\\])*)"\s*:\s*)?([\s\S]+)$/.exec(text.trim());
  if (!match) unavailable();
  let key: string | undefined;
  if (match[1] !== undefined) {
    try { key = JSON.parse(`"${match[1]}"`) as string; } catch { unavailable(); }
  }
  return { key, valueText: match[2] };
}

function parseValue(text: string): unknown {
  try { return JSON.parse(text); } catch { return unavailable(); }
}

function parseStream(rows: readonly DiffResult[], side: DiffSide): { leaves: ParsedLeaf[]; containers: ParsedContainer[] } {
  if (!Array.isArray(rows)) unavailable();
  const leaves: ParsedLeaf[] = [];
  const containers: ParsedContainer[] = [];
  const stack: ContainerContext[] = [];

  for (let cursor = 0; cursor < rows.length; cursor += 1) {
    const row = rows[cursor];
    if (!validRow(row)) unavailable();
    const text = row.text.trim();
    const parent = stack.at(-1);
    // json-diff-kit emits blank equal rows for one-sided alignment. In arrays
    // the blank reserves that stream's structural position; object blanks are
    // separators and carry no member path.
    if (text === '') {
      if (row.type !== 'equal' || !parent || row.level !== parent.level + 1) unavailable();
      if (parent.kind === 'array') parent.nextIndex += 1;
      continue;
    }

    if (text === '}' || text === ']') {
      if (!parent || (text === '}' && parent.kind !== 'object') || (text === ']' && parent.kind !== 'array') || parent.level !== row.level) unavailable();
      stack.pop();
      continue;
    }

    const member = parseMember(text);
    const isObject = member.valueText === '{';
    const isArray = member.valueText === '[';
    let path: string;
    if (parent?.kind === 'array') {
      if (member.key !== undefined) unavailable();
      const index = parent.nextIndex;
      parent.nextIndex += 1;
      path = joinPath(parent.path, String(index), true);
    } else if (member.key !== undefined) {
      path = joinPath(parent?.path ?? '', member.key, false);
    } else if (!parent && stack.length === 0 && (isObject || isArray)) {
      path = '';
    } else if (!parent && stack.length === 0) {
      // A controlled public tuple can contain a top-level member without braces.
      path = '';
    } else {
      unavailable();
    }

    if (isObject || isArray) {
      if (row.type !== 'equal' && row.type !== 'modify' && row.type !== 'add' && row.type !== 'remove') unavailable();
      if (parent && row.level !== parent.level + 1) unavailable();
      if (!parent && row.level !== 0 && path === '') unavailable();
      const context: ContainerContext = { path, parentPath: parent?.path ?? '', kind: isArray ? 'array' : 'object', level: row.level, nextIndex: 0 };
      containers.push(context);
      stack.push(context);
      continue;
    }

    if (parent && row.level !== parent.level + 1) unavailable();
    if (!parent && row.level !== 0) unavailable();
    const scalarPath = path || member.key;
    if (!scalarPath) unavailable();
    leaves.push({ cursor, path: scalarPath, parentPath: parent?.path ?? '', type: row.type, value: parseValue(member.valueText) });
  }

  if (stack.length !== 0) unavailable();
  return { leaves, containers };
}

function nodeState(before?: ParsedLeaf, current?: ParsedLeaf): HistoryDiffState {
  if (!before && current) return 'added';
  if (before && !current) return 'removed';
  if (!before || !current) unavailable();
  if (before.type === 'add' || current.type === 'add') return 'added';
  if (before.type === 'remove' || current.type === 'remove') return 'removed';
  if (before.type === 'modify' || current.type === 'modify') return 'changed';
  if (before.type === 'equal' && current.type === 'equal') return 'unchanged';
  unavailable();
}

/** Adapts only json-diff-kit's documented two-stream result into renderer nodes. */
export function adaptHistoryDiffResult(diffResult: readonly [DiffResult[], DiffResult[]]): HistoryComparison {
  if (!Array.isArray(diffResult) || diffResult.length !== 2 || !Array.isArray(diffResult[0]) || !Array.isArray(diffResult[1])) unavailable();

  const before = parseStream(diffResult[0], 'before');
  const current = parseStream(diffResult[1], 'current');
  const beforeLeaves = new Map(before.leaves.map((leaf) => [leaf.path, leaf]));
  const currentLeaves = new Map(current.leaves.map((leaf) => [leaf.path, leaf]));
  if (beforeLeaves.size !== before.leaves.length || currentLeaves.size !== current.leaves.length) unavailable();

  const root: HistoryDiffNode = { path: '', state: 'unchanged', children: [] };
  const nodes = new Map<string, HistoryDiffNode>([['', root]]);
  const containers = [...before.containers, ...current.containers];
  for (const container of containers) {
    if (container.path === '') continue;
    if (!nodes.has(container.path)) nodes.set(container.path, { path: container.path, parentPath: container.parentPath, state: 'unchanged', children: [], collapsed: true });
  }

  const leaves: HistoryDiffNode[] = [];
  for (const path of new Set([...beforeLeaves.keys(), ...currentLeaves.keys()])) {
    const left = beforeLeaves.get(path);
    const right = currentLeaves.get(path);
    const state = nodeState(left, right);
    const parentPath = left?.parentPath ?? right?.parentPath;
    if (left && right && left.parentPath !== right.parentPath) unavailable();
    const node: HistoryDiffNode = { path, parentPath, state, before: left && displayValue(left.value), current: right && displayValue(right.value), children: [], collapsed: state === 'unchanged' };
    if (nodes.has(path)) unavailable();
    nodes.set(path, node);
    leaves.push(node);
  }

  for (const node of [...nodes.values()].filter((node) => node.path).sort((a, b) => a.path.split(/[.[]/).length - b.path.split(/[.[]/).length)) {
    const parent = nodes.get(node.parentPath ?? '');
    if (!parent) unavailable();
    parent.children.push(node);
  }

  const updateState = (node: HistoryDiffNode): HistoryDiffState => {
    if (!node.children.length) return node.state;
    const states = node.children.map(updateState);
    node.state = states.some((state) => state !== 'unchanged') ? 'changed' : 'unchanged';
    node.collapsed = node.state === 'unchanged';
    return node.state;
  };
  updateState(root);
  for (const node of nodes.values()) node.children.sort((left, right) => left.path.localeCompare(right.path));

  const changedLeaves = leaves.filter((node) => node.state !== 'unchanged');
  const paths = (state: HistoryDiffState) => changedLeaves.filter((node) => node.state === state).map((node) => node.path).sort();
  return { nodes: [root], summary: { added: paths('added').length, removed: paths('removed').length, changed: paths('changed').length, addedPaths: paths('added'), removedPaths: paths('removed'), changedPaths: paths('changed') } };
}

/** Produces a redaction-first Snapshot → Current comparison from one library result. */
export function buildHistoryComparison(snapshot: object, current: object): HistoryComparison {
  const before = projectHistoryDocument(snapshot);
  const after = projectHistoryDocument(current);
  const diffResult = new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff(before, after);
  return adaptHistoryDiffResult(diffResult);
}
