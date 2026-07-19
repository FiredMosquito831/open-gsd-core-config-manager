import { describe, expect, it } from 'vitest';
import {
  HISTORY_REDACTION_MARKER,
  buildHistoryComparison,
  projectHistoryDocument,
} from '../../web/src/history/compare.js';
import { formatSnapshotTime, groupSnapshotsByLocalDate } from '../../web/src/history/time.js';

describe('history comparison', () => {
  it('compares Snapshot to Current structurally with exhaustive paths and exact counts', () => {
    const snapshot = {
      mode: 'interactive',
      nested: { removeMe: true, changed: 1 },
      agents: ['planner', 'reviewer'],
    };
    const current = {
      mode: 'autonomous',
      nested: { changed: 2, addMe: true },
      agents: ['planner', 'executor'],
    };

    const comparison = buildHistoryComparison(snapshot, current);

    expect(comparison.summary).toEqual({
      added: 1,
      removed: 1,
      changed: 3,
      addedPaths: ['nested.addMe'],
      removedPaths: ['nested.removeMe'],
      changedPaths: ['agents[1]', 'mode', 'nested.changed'],
    });
    expect(comparison.nodes[0]?.children.map((node) => node.path))
      .toEqual(['agents', 'mode', 'nested']);
    expect(comparison.nodes[0]?.children.find((node) => node.path === 'nested')?.children.map((node) => node.path))
      .toEqual(['nested.addMe', 'nested.changed', 'nested.removeMe']);
    expect(snapshot).toEqual({
      mode: 'interactive',
      nested: { removeMe: true, changed: 1 },
      agents: ['planner', 'reviewer'],
    });
  });

  it('uses LCS alignment for array insertion, deletion, and reorder summaries', () => {
    const headInsertion = buildHistoryComparison({ agents: ['a', 'b'] }, { agents: ['x', 'a', 'b'] });
    expect(headInsertion.summary).toMatchObject({ added: 1, removed: 0, changed: 0, addedPaths: ['agents[0]'] });

    const middleDeletion = buildHistoryComparison({ agents: ['a', 'b', 'c'] }, { agents: ['a', 'c'] });
    expect(middleDeletion.summary).toMatchObject({ added: 0, removed: 1, changed: 0, removedPaths: ['agents[1]'] });

    const reorder = buildHistoryComparison({ agents: ['a', 'b', 'c'] }, { agents: ['b', 'a', 'c'] });
    expect(reorder.summary).toMatchObject({ added: 1, removed: 1, changed: 0 });
  });

  it('redacts descriptor roots before comparison values and summaries', () => {
    const secret = 'history-sensitive-sentinel-never-display';
    const snapshot = { brave_search: { apiKey: secret }, normal: 'before' };
    const current = { brave_search: { apiKey: 'new-secret' }, normal: 'after' };

    const projected = projectHistoryDocument(snapshot);
    const comparison = buildHistoryComparison(snapshot, current);

    expect(projected).toEqual({ brave_search: HISTORY_REDACTION_MARKER, normal: 'before' });
    expect(JSON.stringify(comparison)).not.toContain(secret);
    expect(JSON.stringify(comparison)).not.toContain(HISTORY_REDACTION_MARKER);
  });
});

describe('history timeline', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('groups complete newest-first history across local date boundaries with exact grammar', () => {
    const groups = groupSnapshotsByLocalDate([
      { seq: 2, timestamp: '2026-07-19T11:00:00.000Z' },
      { seq: 4, timestamp: '2026-07-19T11:00:00.000Z' },
      { seq: 1, timestamp: '2026-07-18T12:00:00.000Z' },
      { seq: 3, timestamp: '2026-07-17T12:00:00.000Z' },
      { seq: 5, timestamp: 'invalid' },
    ], { now, timeZone: 'UTC', locale: 'en-US' });

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday', 'July 17, 2026', 'Unknown date']);
    expect(groups[0]?.snapshots.map((snapshot) => snapshot.seq)).toEqual([4, 2]);
    expect(formatSnapshotTime('2026-07-19T11:59:00.000Z', { now, timeZone: 'UTC', locale: 'en-US' }))
      .toMatchObject({ relative: '1 minute ago', exact: expect.any(String) });
    expect(formatSnapshotTime('invalid', { now, timeZone: 'UTC', locale: 'en-US' }))
      .toEqual({ relative: 'Unknown time', exact: 'Unknown date' });
  });
});
