import { useState } from 'react';
import type { HistoryDiffNode } from '../../history/compare';

/** Long/structural value text; absent and empty string are made explicit. */
function blockText(value: unknown): string {
  if (value === undefined) return '(not present)';
  if (value === '') return '"" — empty string';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2) ?? '';
}

/** Inline Before/After value with explicit absent / empty-string states. */
function DiffValue({ value }: { value: unknown }) {
  if (value === undefined) return <span className="gsd-history-diff-tree__value gsd-history-diff-tree__value--absent">(not present)</span>;
  if (value === '') return <span className="gsd-history-diff-tree__value gsd-history-diff-tree__value--empty">"" — empty string</span>;
  if (typeof value === 'string') return <span className="gsd-history-diff-tree__value"><code>{value}</code></span>;
  return <span className="gsd-history-diff-tree__value"><code>{JSON.stringify(value)}</code></span>;
}

function DiffNode({ node }: { node: HistoryDiffNode }) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(node.state !== 'unchanged');
  const longValue = [node.before, node.current].some((value) => typeof value === 'string' && value.length > 80 || typeof value === 'object' && value !== null);
  const label = node.path || 'root';
  return <li className={`gsd-history-diff-tree__node gsd-history-diff-tree__node--${node.state}`}>
    <div className="gsd-history-diff-tree__line">
      {hasChildren && <button type="button" className="gsd-history-diff-tree__toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`} onClick={() => setExpanded(!expanded)}>{expanded ? '−' : '+'}</button>}
      <span className="gsd-history-diff-tree__state" aria-label={node.state}>{node.state === 'added' ? '+ Added' : node.state === 'removed' ? '− Removed' : node.state === 'changed' ? '↔ Changed' : 'Unchanged'}</span>
      <code>{label}</code>
    </div>
    {!hasChildren && node.state !== 'unchanged' && (longValue ? <div className="gsd-history-diff-tree__values">
      <p>Snapshot value</p>
      <pre className={node.before === undefined || node.before === '' ? 'gsd-history-diff-tree__value--absent' : ''}>{blockText(node.before)}</pre>
      <p>Current saved file value</p>
      <pre className={node.current === undefined || node.current === '' ? 'gsd-history-diff-tree__value--absent' : ''}>{blockText(node.current)}</pre>
    </div> : <p className="gsd-history-diff-tree__scalar"><DiffValue value={node.before} /> <span aria-hidden="true">→</span> <DiffValue value={node.current} /></p>)}
    {hasChildren && expanded && <ul>{node.children.map((child) => <DiffNode node={child} key={child.path} />)}</ul>}
  </li>;
}

export function HistoryDiffTree({ nodes }: { nodes: HistoryDiffNode[] }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const visibleNodes = showUnchanged ? nodes : nodes.filter((node) => node.state !== 'unchanged');
  return <section className="gsd-history-diff-tree" aria-label="Structural comparison">
    <button type="button" className="gsd-button gsd-button--ghost gsd-button--sm" aria-expanded={showUnchanged} onClick={() => setShowUnchanged(!showUnchanged)}>{showUnchanged ? 'Collapse unchanged branches' : 'Expand unchanged branches'}</button>
    <ul>{visibleNodes.map((node) => <DiffNode node={node} key={node.path} />)}</ul>
  </section>;
}
