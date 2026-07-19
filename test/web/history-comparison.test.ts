import { describe, expect, it, vi } from 'vitest';
import { Differ, type DiffResult } from 'json-diff-kit';
import {
  HISTORY_REDACTION_MARKER,
  adaptHistoryDiffResult,
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
    expect(reorder.summary).toMatchObject({ added: 1, removed: 1, changed: 0, addedPaths: ['agents[0]'], removedPaths: ['agents[2]'] });
  });

  it('aligns repeated and adversarial array values using the longest common subsequence', () => {
    const repeated = buildHistoryComparison({ agents: ['a', 'b', 'a'] }, { agents: ['b', 'a', 'c'] });
    expect(repeated.summary).toEqual(expect.objectContaining({
      added: 1,
      removed: 1,
      changed: 0,
      addedPaths: ['agents[3]'],
      removedPaths: ['agents[0]'],
    }));

    const repeatedObjects = buildHistoryComparison(
      { agents: [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }] },
      { agents: [{ id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'a' }] },
    );
    expect(repeatedObjects.summary).toEqual(expect.objectContaining({
      added: 0,
      removed: 0,
      changed: 4,
      changedPaths: ['agents[0].id', 'agents[1].id', 'agents[2].id', 'agents[3].id'],
    }));
  });

  it('redacts before Differ', () => {
    const secret = 'history-sensitive-sentinel-never-display';
    const snapshot = { brave_search: { apiKey: secret }, normal: 'before' };
    const current = { brave_search: { apiKey: 'new-secret' }, normal: 'after' };
    const originalDiff = Differ.prototype.diff;
    const spy = vi.spyOn(Differ.prototype, 'diff');

    try {
      const projected = projectHistoryDocument(snapshot);
      const comparison = buildHistoryComparison(snapshot, current);

      expect(projected).toEqual({ brave_search: HISTORY_REDACTION_MARKER, normal: 'before' });
      expect(spy).toHaveBeenCalledWith(
        { brave_search: HISTORY_REDACTION_MARKER, normal: 'before' },
        { brave_search: HISTORY_REDACTION_MARKER, normal: 'after' },
      );
      expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(comparison)).not.toContain(secret);
      expect(JSON.stringify(comparison)).not.toContain(HISTORY_REDACTION_MARKER);
    } finally {
      Differ.prototype.diff = originalDiff;
      spy.mockRestore();
    }
  });

  it('DiffResult authority adapts a nested object tuple without source documents', () => {
    const tuple: readonly [DiffResult[], DiffResult[]] = [
      [
        { level: 0, type: 'equal', text: '{' },
        { level: 1, type: 'equal', text: '"nested": {' },
        { level: 2, type: 'modify', text: '"changed": 1' },
        { level: 2, type: 'remove', text: '"removed": true' },
        { level: 1, type: 'equal', text: '}' },
        { level: 0, type: 'equal', text: '}' },
      ],
      [
        { level: 0, type: 'equal', text: '{' },
        { level: 1, type: 'equal', text: '"nested": {' },
        { level: 2, type: 'modify', text: '"changed": 2' },
        { level: 2, type: 'add', text: '"added": true' },
        { level: 1, type: 'equal', text: '}' },
        { level: 0, type: 'equal', text: '}' },
      ],
    ];

    expect(adaptHistoryDiffResult(tuple)).toMatchObject({
      summary: {
        added: 1,
        removed: 1,
        changed: 1,
        addedPaths: ['nested.added'],
        removedPaths: ['nested.removed'],
        changedPaths: ['nested.changed'],
      },
    });
  });

  it('DiffResult authority follows the controlled Differ tuple', () => {
    const controlled: readonly [DiffResult[], DiffResult[]] = [
      [{ level: 0, type: 'remove', text: '"tupleRemoved": "before"' }],
      [{ level: 0, type: 'add', text: '"tupleAdded": "after"' }],
    ];
    const spy = vi.spyOn(Differ.prototype, 'diff').mockReturnValue(controlled);

    try {
      expect(buildHistoryComparison({ ignored: 'snapshot' }, { ignored: 'current' }).summary).toEqual({
        added: 1,
        removed: 1,
        changed: 0,
        addedPaths: ['tupleAdded'],
        removedPaths: ['tupleRemoved'],
        changedPaths: [],
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('adapter rejects malformed DiffResult streams without disclosing values', () => {
    const malformed: readonly [DiffResult[], DiffResult[]][] = [
      [[{ level: 0, type: 'equal', text: '{' }], [{ level: 0, type: 'equal', text: '}' }]],
      [[{ level: Number.NaN, type: 'equal', text: 'fixture-secret' }], []],
      [[{ level: 0, type: 'unsupported' as DiffResult['type'], text: 'fixture-secret' }], []],
    ];

    for (const tuple of malformed) {
      expect(() => adaptHistoryDiffResult(tuple)).toThrow('History comparison unavailable');
      try {
        adaptHistoryDiffResult(tuple);
      } catch (error) {
        expect(String(error)).not.toContain('fixture-secret');
      }
    }
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

  it('groups yesterday by local calendar date across a DST-shortened day', () => {
    const groups = groupSnapshotsByLocalDate([
      { seq: 2, timestamp: '2026-03-09T07:30:00.000Z' }, // Mar 9, 00:30 PDT
      { seq: 1, timestamp: '2026-03-08T08:30:00.000Z' }, // Mar 8, 00:30 PST (23 hours earlier)
    ], {
      now: new Date('2026-03-09T07:30:00.000Z'),
      timeZone: 'America/Los_Angeles',
      locale: 'en-US',
    });

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
  });
});
