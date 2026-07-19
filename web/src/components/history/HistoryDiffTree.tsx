import { useState } from 'react';
import type { HistoryDiffNode } from '../../history/compare';

function valueText(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2) ?? '';
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
    {!hasChildren && node.state !== 'unchanged' && (longValue ? <div className="gsd-history-diff-tree__values"><p>Snapshot value</p><pre>{valueText(node.before)}</pre><p>Current saved file value</p><pre>{valueText(node.current)}</pre></div> : <p className="gsd-history-diff-tree__scalar"><span>{valueText(node.before)}</span> → <span>{valueText(node.current)}</span></p>)}
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
