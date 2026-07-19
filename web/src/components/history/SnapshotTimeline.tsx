import type { HistorySnapshotMeta } from '../../../../packages/server/src/api-types';

export interface SnapshotChangeCount {
  added: number;
  removed: number;
  changed: number;
}

interface SnapshotTimelineProps {
  snapshots: HistorySnapshotMeta[];
  selectedSeq: number | null;
  counts: Map<number, SnapshotChangeCount>;
  onSelect: (seq: number) => void;
}

function formatExact(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function formatRelative(timestamp: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function dateGroup(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startDate === startToday) return 'Today';
  if (startDate === startToday - 86_400_000) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function countText(count?: SnapshotChangeCount): string {
  if (!count) return 'Calculating changes…';
  const total = count.added + count.removed + count.changed;
  if (total === 0) return 'No key changes';
  return `${total} key${total === 1 ? '' : 's'} changed`;
}

export function SnapshotTimeline({ snapshots, selectedSeq, counts, onSelect }: SnapshotTimelineProps) {
  const groups = new Map<string, HistorySnapshotMeta[]>();
  [...snapshots].sort((a, b) => b.seq - a.seq).forEach((snapshot) => {
    const group = dateGroup(snapshot.timestamp);
    groups.set(group, [...(groups.get(group) ?? []), snapshot]);
  });

  return <nav className="gsd-history-timeline" aria-label="Saved versions">
    {[...groups].map(([group, entries]) => <section key={group} className="gsd-history-timeline__group" aria-label={group}>
      <h2 className="gsd-history-timeline__date">{group}</h2>
      <ul className="gsd-history-timeline__list">
        {entries.map((snapshot) => <li key={snapshot.seq}>
          <button type="button" className="gsd-history-timeline__row" aria-current={selectedSeq === snapshot.seq ? 'true' : undefined} onClick={() => onSelect(snapshot.seq)}>
            <span className="gsd-history-timeline__relative">{formatRelative(snapshot.timestamp)}</span>
            <span className="gsd-history-timeline__exact">{formatExact(snapshot.timestamp)}</span>
            <span className="gsd-history-timeline__sequence">Snapshot #{snapshot.seq}</span>
            <span className="gsd-history-timeline__count">{countText(counts.get(snapshot.seq))}</span>
          </button>
        </li>)}
      </ul>
    </section>)}
  </nav>;
}
