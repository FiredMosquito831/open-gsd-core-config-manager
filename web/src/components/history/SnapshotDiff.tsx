import type { HistorySnapshotDetail } from '../../../../packages/server/src/api-types';
import { buildHistoryComparison, type HistoryComparison } from '../../history/compare';
import { HistoryDiffTree } from './HistoryDiffTree';

interface SnapshotDiffProps {
  sequence: number;
  detail?: HistorySnapshotDetail;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function countLabel(label: string, count: number): string {
  return `${label}: ${count}`;
}

export function SnapshotDiff({ sequence, detail, isLoading, isError, onRetry }: SnapshotDiffProps) {
  if (isLoading) return <div className="gsd-history__state" role="status">Loading comparison…</div>;
  if (isError || !detail) return <div className="gsd-history__state" role="alert"><p>We couldn’t load this comparison. Your config was not changed. Try again, or choose another saved version.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={onRetry}>Try again</button></div>;
  const comparison = buildComparison(detail);
  const timestamp = new Date(detail.snapshot.timestamp).toLocaleString();
  const paths = [...comparison.summary.addedPaths, ...comparison.summary.removedPaths, ...comparison.summary.changedPaths];
  const hasChanges = paths.length > 0;
  return <div className="gsd-history-diff">
    <header className="gsd-history-diff__header">
      <div><h2>Snapshot #{sequence}</h2><p>{timestamp}</p><p>Snapshot → Current saved file</p></div>
      <button type="button" className="gsd-button gsd-button--danger gsd-button--md" disabled>Restore this snapshot</button>
    </header>
    <section className="gsd-history-diff__summary" aria-label="Change summary">
      <div className="gsd-history-diff__counts"><span>{countLabel('Added', comparison.summary.added)}</span><span>{countLabel('Removed', comparison.summary.removed)}</span><span>{countLabel('Changed', comparison.summary.changed)}</span></div>
      {!hasChanges ? <p>This snapshot matches the current saved file.</p> : <ul className="gsd-history-diff__paths">{paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul>}
    </section>
    <HistoryDiffTree nodes={comparison.nodes} />
  </div>;
}

export function buildComparison(detail: HistorySnapshotDetail): HistoryComparison {
  return buildHistoryComparison(detail.snapshot.document, detail.current);
}
