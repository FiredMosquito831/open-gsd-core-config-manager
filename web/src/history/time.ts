export interface SnapshotTimestamp {
  seq: number;
  timestamp: string;
}

export interface HistoryTimeOptions {
  now?: Date;
  locale?: string;
  timeZone?: string;
}

export interface SnapshotTime {
  relative: string;
  exact: string;
}

export interface SnapshotGroup<T extends SnapshotTimestamp> {
  label: string;
  snapshots: T[];
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

function dateParts(date: Date, locale: string, timeZone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function dayIndex(date: Date, locale: string, timeZone: string): number {
  const parts = dateParts(date, locale, timeZone);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000;
}

export function formatSnapshotTime(timestamp: string, options: HistoryTimeOptions = {}): SnapshotTime {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return { relative: 'Unknown time', exact: 'Unknown date' };

  const now = options.now ?? new Date();
  const locale = options.locale ?? 'en-US';
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const difference = Math.max(0, now.getTime() - date.getTime());
  const seconds = Math.floor(difference / 1_000);
  const exact = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);

  if (seconds < 60) return { relative: 'just now', exact };
  if (seconds < 3_600) return { relative: plural(Math.floor(seconds / 60), 'minute'), exact };
  if (seconds < 86_400) return { relative: plural(Math.floor(seconds / 3_600), 'hour'), exact };
  return { relative: plural(Math.floor(seconds / 86_400), 'day'), exact };
}

export function groupSnapshotsByLocalDate<T extends SnapshotTimestamp>(snapshots: T[], options: HistoryTimeOptions = {}): SnapshotGroup<T>[] {
  const now = options.now ?? new Date();
  const locale = options.locale ?? 'en-US';
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const today = dayIndex(now, locale, timeZone);
  const groups = new Map<string, T[]>();

  const ordered = [...snapshots].sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    if (Number.isNaN(leftTime)) return Number.isNaN(rightTime) ? right.seq - left.seq : 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime || right.seq - left.seq;
  });

  for (const snapshot of ordered) {
    const date = new Date(snapshot.timestamp);
    let label = 'Unknown date';
    if (!Number.isNaN(date.getTime())) {
      const age = today - dayIndex(date, locale, timeZone);
      if (age === 0) label = 'Today';
      else if (age === 1) label = 'Yesterday';
      else label = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(date);
    }
    const group = groups.get(label) ?? [];
    group.push(snapshot);
    groups.set(label, group);
  }
  return [...groups].map(([label, grouped]) => ({ label, snapshots: grouped }));
}
