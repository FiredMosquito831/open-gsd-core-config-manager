import { Differ, type DiffResult } from 'json-diff-kit';
import { SPECIALIZED_METADATA } from '../schema/specializedMetadata';

export const HISTORY_REDACTION_MARKER = '••••••';
const DISPLAY_REDACTION_MARKER = '[redacted]';
const COMPARISON_UNAVAILABLE = 'History comparison unavailable';

type DiffSide = 'before' | 'current';
type PathToken = { kind: 'object'; key: string } | { kind: 'array'; index: number };

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

export interface HistoryComparison { nodes: HistoryDiffNode[]; summary: HistoryChangeSummary; }

interface ParsedLeaf { identity: string; path: string; parentIdentity: string; parentPath: string; type: DiffResult['type']; value: unknown; }
interface ParsedContainer extends Omit<ParsedLeaf, 'type'> { tokens: PathToken[]; kind: 'object' | 'array'; }
interface ContainerContext extends ParsedContainer { level: number; nextIndex: number; memberKey?: string; sourceKey?: string; value: Record<string, unknown> | unknown[]; }

const sensitiveRoots = SPECIALIZED_METADATA.filter((descriptor) => descriptor.sensitive).map((descriptor) => descriptor.path.split('.'));

function unavailable(): never { throw new Error(COMPARISON_UNAVAILABLE); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function cloneAndProject(value: unknown, segments: string[] = []): unknown {
  if (sensitiveRoots.some((root) => root.length === segments.length && root.every((part, index) => part === segments[index]))) return HISTORY_REDACTION_MARKER;
  if (Array.isArray(value)) return value.map((item) => cloneAndProject(item, segments));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAndProject(item, [...segments, key])]));
  return value;
}
/** Creates a deep presentation copy that masks catalog-defined sensitive roots. */
export function projectHistoryDocument(document: object): object { return cloneAndProject(document) as object; }

function encodePathIdentity(tokens: readonly PathToken[]): string {
  return tokens.map((token) => token.kind === 'object' ? `o:${token.key.replace(/~/g, '~0').replace(/\//g, '~1')}` : `a:${token.index}`).join('/');
}
function isSimpleKey(key: string): boolean { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key); }
function formatDisplayPath(tokens: readonly PathToken[]): string {
  return tokens.reduce((path, token) => {
    if (token.kind === 'array') return `${path}[${token.index}]`;
    return isSimpleKey(token.key) ? (path ? `${path}.${token.key}` : token.key) : `${path}[${JSON.stringify(token.key)}]`;
  }, '');
}
function displayValue(value: unknown): unknown { return value === HISTORY_REDACTION_MARKER ? DISPLAY_REDACTION_MARKER : value; }
function validRow(row: unknown): row is DiffResult {
  if (!isRecord(row)) return false;
  return typeof row.level === 'number' && Number.isFinite(row.level) && Number.isInteger(row.level) && row.level >= 0 && typeof row.text === 'string' && ['equal', 'modify', 'add', 'remove'].includes(String(row.type));
}
function parseMember(text: string): { key?: string; valueText: string } {
  const trimmed = text.trim();
  const match = /^("(?:\\.|[^"\\])*")\s*:\s*([\s\S]+)$/.exec(trimmed);
  if (!match) return { valueText: trimmed };
  try {
    // json-diff-kit prints literal backslashes in member labels; normalize only
    // invalid JSON escape starts before decoding, without altering valid escapes.
    const keyText = match[1]!.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    return { key: JSON.parse(keyText) as string, valueText: match[2]!.replace(/,\s*$/, '') };
  } catch { return unavailable(); }
}
function parseValue(text: string): unknown { try { return JSON.parse(text); } catch { return unavailable(); } }
function assign(parent: ContainerContext | undefined, key: string | undefined, value: unknown): void {
  if (!parent) return;
  if (parent.kind === 'array') { if (key !== undefined) unavailable(); (parent.value as unknown[]).push(value); return; }
  if (key === undefined) unavailable(); (parent.value as Record<string, unknown>)[key] = value;
}
function isDescendant(identity: string, ancestor: string): boolean { return identity === ancestor || identity.startsWith(`${ancestor}/`); }

function parseStream(rows: readonly DiffResult[], _side: DiffSide): { leaves: ParsedLeaf[]; containers: ParsedContainer[] } {
  if (!Array.isArray(rows)) unavailable();
  const leaves: ParsedLeaf[] = []; const containers: ParsedContainer[] = []; const stack: ContainerContext[] = [];
  for (const row of rows) {
    if (!validRow(row)) unavailable();
    const text = row.text.trim(); const parent = stack.at(-1);
    if (text === '') {
      // Equal blanks are established LCS array alignment; modify blanks are only
      // tolerated as inert counterpart padding in a container/scalar replacement.
      if (!parent || row.level !== parent.level + 1 || (row.type !== 'equal' && row.type !== 'modify')) unavailable();
      if (row.type === 'equal' && parent.kind === 'array') parent.nextIndex += 1;
      continue;
    }
    if (text === '}' || text === ']') {
      if (!parent || row.level !== parent.level || (text === '}' && parent.kind !== 'object') || (text === ']' && parent.kind !== 'array')) unavailable();
      stack.pop();
      containers.push({ identity: parent.identity, path: parent.path, parentIdentity: parent.parentIdentity, parentPath: parent.parentPath, tokens: parent.tokens, kind: parent.kind, value: parent.value });
      assign(stack.at(-1), parent.memberKey, parent.value);
      continue;
    }
    const member = parseMember(text); const isObject = member.valueText === '{'; const isArray = member.valueText === '[';
    if (parent && row.level !== parent.level + 1) unavailable(); if (!parent && row.level !== 0) unavailable();
    let token: PathToken | undefined;
    if (parent?.kind === 'array') {
      // json-diff-kit renders nested array openings using the enclosing object
      // member label (for example, `"x": [` inside the array for `{ x: [[]] }`).
      // The label is presentation-only: validate it against the inherited label,
      // then retain the array index as this node's semantic identity.
      if (member.key !== undefined && (!isArray || parent.sourceKey !== member.key)) unavailable();
      token = { kind: 'array', index: parent.nextIndex++ };
    }
    else if (member.key !== undefined) token = { kind: 'object', key: member.key };
    else if (parent || !(isObject || isArray)) unavailable();
    const tokens = token ? [...(parent?.tokens ?? []), token] : [];
    const identity = encodePathIdentity(tokens); const path = formatDisplayPath(tokens); const parentTokens = tokens.slice(0, -1);
    const parentIdentity = encodePathIdentity(parentTokens); const parentPath = formatDisplayPath(parentTokens);
    if (isObject || isArray) {
      stack.push({ identity, path, parentIdentity, parentPath, tokens, kind: isArray ? 'array' : 'object', level: row.level, nextIndex: 0, memberKey: parent?.kind === 'array' ? undefined : member.key, sourceKey: member.key ?? parent?.sourceKey, value: isArray ? [] : {} });
      continue;
    }
    if (!token) unavailable();
    const value = parseValue(member.valueText); assign(parent, member.key, value);
    leaves.push({ identity, path, parentIdentity, parentPath, type: row.type, value });
  }
  if (stack.length !== 0) unavailable();
  return { leaves, containers };
}
function nodeState(before?: ParsedLeaf, current?: ParsedLeaf): HistoryDiffState {
  if (!before && current) return 'added'; if (before && !current) return 'removed'; if (!before || !current) unavailable();
  if (before.type === 'add' || current.type === 'add') return 'added'; if (before.type === 'remove' || current.type === 'remove') return 'removed';
  if (before.type === 'modify' || current.type === 'modify') return 'changed'; if (before.type === 'equal' && current.type === 'equal') return 'unchanged'; return unavailable();
}
function consumeContainerScalarReplacement(before: ReturnType<typeof parseStream>, current: ReturnType<typeof parseStream>): { before: ReturnType<typeof parseStream>; current: ReturnType<typeof parseStream> } {
  const beforeLeaves = [...before.leaves]; const currentLeaves = [...current.leaves]; const beforeContainers = [...before.containers]; const currentContainers = [...current.containers];
  for (const container of [...beforeContainers]) {
    const scalar = currentLeaves.find((leaf) => leaf.identity === container.identity && leaf.type === 'modify');
    if (!scalar) continue;
    if (!container.value || typeof container.value !== 'object') unavailable();
    const replacement: ParsedLeaf = { ...scalar, type: 'modify', value: container.value };
    beforeLeaves.push(replacement);
    for (let index = beforeLeaves.length - 2; index >= 0; index -= 1) if (isDescendant(beforeLeaves[index]!.identity, container.identity)) beforeLeaves.splice(index, 1);
    for (let index = beforeContainers.length - 1; index >= 0; index -= 1) if (isDescendant(beforeContainers[index]!.identity, container.identity)) beforeContainers.splice(index, 1);
  }
  for (const container of [...currentContainers]) {
    const scalar = beforeLeaves.find((leaf) => leaf.identity === container.identity && leaf.type === 'modify');
    if (!scalar) continue;
    const replacement: ParsedLeaf = { ...scalar, type: 'modify', value: container.value };
    currentLeaves.push(replacement);
    for (let index = currentLeaves.length - 2; index >= 0; index -= 1) if (isDescendant(currentLeaves[index]!.identity, container.identity)) currentLeaves.splice(index, 1);
    for (let index = currentContainers.length - 1; index >= 0; index -= 1) if (isDescendant(currentContainers[index]!.identity, container.identity)) currentContainers.splice(index, 1);
  }
  return { before: { leaves: beforeLeaves, containers: beforeContainers }, current: { leaves: currentLeaves, containers: currentContainers } };
}

/** Adapts only json-diff-kit's documented two-stream result into renderer nodes. */
export function adaptHistoryDiffResult(diffResult: readonly [DiffResult[], DiffResult[]]): HistoryComparison {
  if (!Array.isArray(diffResult) || diffResult.length !== 2 || !Array.isArray(diffResult[0]) || !Array.isArray(diffResult[1])) unavailable();
  let before = parseStream(diffResult[0], 'before'); let current = parseStream(diffResult[1], 'current');
  ({ before, current } = consumeContainerScalarReplacement(before, current));
  const beforeLeaves = new Map(before.leaves.map((leaf) => [leaf.identity, leaf])); const currentLeaves = new Map(current.leaves.map((leaf) => [leaf.identity, leaf]));
  if (beforeLeaves.size !== before.leaves.length || currentLeaves.size !== current.leaves.length) unavailable();
  const root: HistoryDiffNode = { path: '', state: 'unchanged', children: [] }; const nodes = new Map<string, HistoryDiffNode>([['', root]]);
  for (const container of [...before.containers, ...current.containers]) if (container.identity && !nodes.has(container.identity)) nodes.set(container.identity, { path: container.path, parentPath: container.parentPath, state: 'unchanged', children: [], collapsed: true });
  const leaves: Array<HistoryDiffNode & { identity: string; parentIdentity: string }> = [];
  for (const identity of new Set([...beforeLeaves.keys(), ...currentLeaves.keys()])) {
    const left = beforeLeaves.get(identity); const right = currentLeaves.get(identity); const state = nodeState(left, right); const source = left ?? right!;
    if (left && right && left.parentIdentity !== right.parentIdentity) unavailable(); if (nodes.has(identity)) unavailable();
    const node = { identity, parentIdentity: source.parentIdentity, path: source.path, parentPath: source.parentPath, state, before: left && displayValue(left.value), current: right && displayValue(right.value), children: [], collapsed: state === 'unchanged' };
    nodes.set(identity, node); leaves.push(node);
  }
  const nodeDetails = new Map<string, { parentIdentity: string }>();
  for (const container of [...before.containers, ...current.containers]) nodeDetails.set(container.identity, { parentIdentity: container.parentIdentity });
  for (const leaf of leaves) nodeDetails.set(leaf.identity, { parentIdentity: leaf.parentIdentity });
  for (const [identity, node] of nodes) if (identity) { const parent = nodes.get(nodeDetails.get(identity)?.parentIdentity ?? ''); if (!parent) unavailable(); parent.children.push(node); }
  const updateState = (node: HistoryDiffNode): HistoryDiffState => { if (!node.children.length) return node.state; const states = node.children.map(updateState); node.state = states.some((state) => state !== 'unchanged') ? 'changed' : 'unchanged'; node.collapsed = node.state === 'unchanged'; return node.state; };
  updateState(root); for (const node of nodes.values()) node.children.sort((left, right) => left.path.localeCompare(right.path));
  const changedLeaves = leaves.filter((node) => node.state !== 'unchanged'); const paths = (state: HistoryDiffState) => changedLeaves.filter((node) => node.state === state).map((node) => node.path).sort();
  return { nodes: [root], summary: { added: paths('added').length, removed: paths('removed').length, changed: paths('changed').length, addedPaths: paths('added'), removedPaths: paths('removed'), changedPaths: paths('changed') } };
}
/** Produces a redaction-first Snapshot → Current comparison from one library result. */
export function buildHistoryComparison(snapshot: object, current: object): HistoryComparison {
  const before = projectHistoryDocument(snapshot); const after = projectHistoryDocument(current);
  return adaptHistoryDiffResult(new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff(before, after));
}
