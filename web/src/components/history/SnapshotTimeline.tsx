import type { HistorySnapshotMeta } from '../../../../packages/server/src/api-types';
import { formatSnapshotTime, groupSnapshotsByLocalDate } from '../../history/time';

export interface SnapshotChangeCount {
  added: number;
  removed: number;
  changed: number;
}

interface SnapshotTimelineProps {
  snapshots: HistorySnapshotMeta[];
  selectedSeq: number | null;
  counts: Map<number, SnapshotChangeCount>;
  errors: Set<number>;
  onRetry: (seq: number) => void;
  onSelect: (seq: number) => void;
}


function countText(count?: SnapshotChangeCount): string {
  if (!count) return 'Calculating changes…';
  const total = count.added + count.removed + count.changed;
  if (total === 0) return 'No key changes';
  return `${total} key${total === 1 ? '' : 's'} changed`;
}

/** Compact, scannable breakdown so a safe tweak is distinguishable from a deletion-heavy revision. */
function CountBreakdown({ count }: { count: SnapshotChangeCount }) {
  if (count.added === 0 && count.changed === 0 && count.removed === 0) {
    return <span className="gsd-history-timeline__count">No key changes</span>;
  }
  const parts: Array<{ cls: string; label: string }> = [];
  if (count.changed > 0) parts.push({ cls: 'changed', label: `${count.changed} changed` });
  if (count.added > 0) parts.push({ cls: 'added', label: `${count.added} added` });
  if (count.removed > 0) parts.push({ cls: 'removed', label: `${count.removed} removed` });
  return <span className="gsd-history-timeline__count">{parts.map((part, index) => <span key={part.cls} className={`gsd-history-timeline__count-part gsd-history-timeline__count-part--${part.cls}`}>{index > 0 && <span aria-hidden="true"> · </span>}{part.label}</span>)}</span>;
}

export function SnapshotTimeline({ snapshots, selectedSeq, counts, errors, onRetry, onSelect }: SnapshotTimelineProps) {
  const groups = groupSnapshotsByLocalDate(snapshots);

  return <nav className="gsd-history-timeline" aria-label="Saved versions">
    {groups.map(({ label, snapshots: entries }) => <section key={label} className="gsd-history-timeline__group" aria-label={label}>
      <h2 className="gsd-history-timeline__date">{label}</h2>
      <ul className="gsd-history-timeline__list">
        {entries.map((snapshot) => {
          const { relative, exact } = formatSnapshotTime(snapshot.timestamp);
          return <li key={snapshot.seq}>
          <button type="button" className="gsd-history-timeline__row" aria-current={selectedSeq === snapshot.seq ? 'true' : undefined} onClick={() => onSelect(snapshot.seq)}>
            <span className="gsd-history-timeline__relative">{relative}</span>
            <span className="gsd-history-timeline__exact">{exact}</span>
            <span className="gsd-history-timeline__sequence">Snapshot #{snapshot.seq}</span>
            {!errors.has(snapshot.seq) && <span className="gsd-history-timeline__count">{counts.get(snapshot.seq) ? <CountBreakdown count={counts.get(snapshot.seq)!} /> : countText(counts.get(snapshot.seq))}</span>}
          </button>
          {errors.has(snapshot.seq) && <span className="gsd-history-timeline__count" role="alert">Comparison could not be loaded. <button type="button" className="gsd-button gsd-button--ghost" aria-label={`Retry snapshot #${snapshot.seq} comparison`} onClick={() => onRetry(snapshot.seq)}>Retry</button></span>}
        </li>;
        })}
      </ul>
    </section>)}
  </nav>;
}
