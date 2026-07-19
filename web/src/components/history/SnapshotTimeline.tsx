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
            {!errors.has(snapshot.seq) && <span className="gsd-history-timeline__count">{countText(counts.get(snapshot.seq))}</span>}
          </button>
          {errors.has(snapshot.seq) && <span className="gsd-history-timeline__count" role="alert">Comparison could not be loaded. <button type="button" className="gsd-button gsd-button--ghost" aria-label={`Retry snapshot #${snapshot.seq} comparison`} onClick={() => onRetry(snapshot.seq)}>Retry</button></span>}
        </li>;
        })}
      </ul>
    </section>)}
  </nav>;
}
