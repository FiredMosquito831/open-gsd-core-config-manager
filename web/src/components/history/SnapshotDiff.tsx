import { useQuery } from '@tanstack/react-query';
import type { HistorySnapshotDetail } from '../../../../packages/server/src/api-types';
import type { SchemaEntry } from '../../../../packages/config-io/src/types';
import { getSchema } from '../../api/schema';
import { indexSchema, type IndexedField } from '../../schema/indexSchema';
import { buildHistoryComparison, type HistoryComparison } from '../../history/compare';
import { HistoryDiffTree } from './HistoryDiffTree';

interface SnapshotDiffProps {
  sequence: number;
  detail?: HistorySnapshotDetail;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRestore: (summary: HistoryComparison['summary']) => void;
}

function countLabel(label: string, count: number): string {
  return `${label}: ${count}`;
}


/** Resolve a raw dot/index path to a friendly field label, chapter and description. */
function describeChange(path: string, fields: Map<string, IndexedField>) {
  const field = fields.get(path);
  return {
    label: field?.title || path,
    category: field?.category || '',
    description: field?.description || '',
  };
}

export function SnapshotDiff({ sequence, detail, isLoading, isError, onRetry, onRestore }: SnapshotDiffProps) {
  // Reuses the editor's cached ['schema'] query; react-query shares it, so no
  // duplicate network request and no prop-plumbing seam into the history path.
  const schemaQuery = useQuery({ queryKey: ['schema'], queryFn: getSchema });
  const fields = new Map<string, IndexedField>();
  if (schemaQuery.data) {
    for (const field of indexSchema(schemaQuery.data as Record<string, SchemaEntry>).searchable) {
      fields.set(field.path, field);
    }
  }
  if (isLoading) return <div className="gsd-history__state" role="status">Loading comparison…</div>;
  if (isError || !detail) return <div className="gsd-history__state" role="alert"><p>We couldn’t load this comparison. Your config was not changed. Try again, or choose another saved version.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={onRetry}>Try again</button></div>;
  const comparison = buildComparison(detail);
  const timestamp = new Date(detail.snapshot.timestamp).toLocaleString();
  const addedPaths = comparison.summary.addedPaths;
  const removedPaths = comparison.summary.removedPaths;
  const changedPaths = comparison.summary.changedPaths;
  const allPaths = [...addedPaths, ...removedPaths, ...changedPaths];
  const hasChanges = allPaths.length > 0;
  return <div className="gsd-history-diff">
    <header className="gsd-history-diff__header">
      <div>
        <h2>Snapshot #{sequence}</h2>
        <p>{timestamp}</p>
        <p className="gsd-history-diff__sides"><span className="gsd-history-diff__side">Before: snapshot</span><span aria-hidden="true">→</span><span className="gsd-history-diff__side">After: current saved file</span></p>
      </div>
      <button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => onRestore(comparison.summary)}>Restore this snapshot</button>
    </header>
    <section className="gsd-history-diff__summary" aria-label="Change summary">
      <div className="gsd-history-diff__counts">
        {comparison.summary.added > 0 && <span className="gsd-history-diff__count gsd-history-diff__count--added">{countLabel('Added', comparison.summary.added)}</span>}
        {comparison.summary.changed > 0 && <span className="gsd-history-diff__count gsd-history-diff__count--changed">{countLabel('Changed', comparison.summary.changed)}</span>}
        {comparison.summary.removed > 0 && <span className="gsd-history-diff__count gsd-history-diff__count--removed">{countLabel('Removed', comparison.summary.removed)}</span>}
      </div>
      {!hasChanges ? <p>This snapshot matches the current saved file.</p> : (
        <ul className="gsd-history-diff__changes">
          {allPaths.map((path) => {
            const changeState = addedPaths.includes(path) ? 'added' : removedPaths.includes(path) ? 'removed' : 'changed';
            const { label, category, description } = describeChange(path, fields);
            return <li key={path} className={`gsd-history-diff__change gsd-history-diff__change--${changeState}`}>
              <div className="gsd-history-diff__change-primary">
                <span className="gsd-history-diff__state">{changeState === 'added' ? '+ Added' : changeState === 'removed' ? '− Removed' : '↔ Changed'}</span>
                <span className="gsd-history-diff__label">{label}</span>
                {category && <span className="gsd-history-diff__chapter">{category}</span>}
              </div>
              {description && <p className="gsd-history-diff__desc">{description}</p>}
              <details className="gsd-history-diff__technical">
                <summary>Technical details</summary>
                <code>{path}</code>
              </details>
            </li>;
          })}
        </ul>
      )}
    </section>
    <HistoryDiffTree nodes={comparison.nodes} />
  </div>;
}

export function buildComparison(detail: HistorySnapshotDetail): HistoryComparison {
  return buildHistoryComparison(detail.snapshot.document, detail.current);
}
